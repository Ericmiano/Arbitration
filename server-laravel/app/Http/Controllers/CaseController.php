<?php

namespace App\Http\Controllers;

use App\Models\ArbitrationCase;
use App\Models\Arbitrator;
use App\Models\Contract;
use App\Models\Document;
use App\Services\CaseAccessService;
use App\Services\CaseNumberService;
use App\Services\SlaService;
use App\Support\Ids;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class CaseController extends Controller
{
    private function withCaseSummary(Builder $query): Builder
    {
        return $query->with([
            'parties' => fn ($q) => $q->select('parties.id', 'full_name'),
            'project:id,name,location',
            // Includes 'completed' - once a case concludes its arbitrator's
            // assignment status flips to 'completed', and without it here the
            // frontend loses track of who the arbitrator ever was on a closed
            // case. 'withdrawn'/'reassigned' stay excluded since those aren't
            // current. No limit(1) - a panel case has up to 3 of these at once.
            'assignments' => fn ($q) => $q->whereIn('status', ['ongoing', 'completed'])
                ->with('arbitrator:id,full_name')
                ->orderByDesc('assigned_at'),
            'activeTribunal.members' => fn ($q) => $q->with('arbitrator:id,full_name'),
        ]);
    }

    /**
     * Free-text search across case number, description, and party names.
     * case_number and party name are short, structured strings searched as
     * substrings (a case number's format is predictable enough that a plain
     * LIKE stays cheap even as the register grows); description is a long
     * free-text field, where a leading-wildcard LIKE can never use an index
     * - that one uses the FULLTEXT index instead (natural language mode),
     * which is also just a better match for "search this paragraph" intent.
     */
    private function applySearch(Builder $query, ?string $q): Builder
    {
        if (! $q) {
            return $query;
        }

        return $query->where(function (Builder $inner) use ($q) {
            $inner->where('case_number', 'like', "%{$q}%")
                ->orWhereFullText('description', $q)
                ->orWhereHas('parties', fn ($p) => $p->where('full_name', 'like', "%{$q}%"));
        });
    }

    /** Cases visible to the current session user, scoped by role. */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        $q = $request->query('q');
        $q = is_string($q) ? mb_substr(trim($q), 0, 200) : null;

        // Capped well above the current register size so a full-export fetch
        // (perPage=1000, see Cases.tsx) still comes back in one page.
        $perPage = max(1, min(1000, (int) $request->query('perPage', 25)));
        $page = max(1, (int) $request->query('page', 1));

        $query = $this->withCaseSummary(ArbitrationCase::query())->orderByDesc('filed_at');

        if ($user->isStaff()) {
            return $this->paginatedResponse($this->applySearch($query, $q), $perPage, $page);
        }

        if ($user->role === 'arbitrator') {
            $arbitrator = Arbitrator::where('user_id', $user->id)->first();
            if (! $arbitrator) {
                return $this->emptyPaginatedResponse($perPage);
            }
            $query->whereHas('assignments', fn ($a) => $a->where('arbitrator_id', $arbitrator->id));

            return $this->paginatedResponse($this->applySearch($query, $q), $perPage, $page);
        }

        // role === 'party'
        $query->whereHas('parties', fn ($p) => $p->where('user_id', $user->id));

        return $this->paginatedResponse($this->applySearch($query, $q), $perPage, $page);
    }

    /** Common envelope for every paginated cases listing, regardless of role scoping. */
    private function paginatedResponse(Builder $query, int $perPage, int $page): JsonResponse
    {
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => $paginator->items(),
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'total' => $paginator->total(),
            'perPage' => $paginator->perPage(),
        ]);
    }

    private function emptyPaginatedResponse(int $perPage): JsonResponse
    {
        return response()->json(['data' => [], 'currentPage' => 1, 'lastPage' => 1, 'total' => 0, 'perPage' => $perPage]);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'projectId' => ['nullable', 'integer', 'min:1'],
                'contractId' => ['nullable', 'integer', 'min:1'],
                'disputeValue' => ['required', 'numeric', 'gt:0'],
                'currency' => ['nullable', 'string', 'size:3'],
                'category' => ['required', 'string', 'max:100'],
                'description' => ['required', 'string'],
                'basis' => ['required', 'in:contractual_clause,mutual_agreement'],
                'parties' => ['required', 'array', 'min:2'],
                'parties.*.partyId' => ['required', 'integer', 'min:1'],
                'parties.*.role' => ['required', 'in:claimant,respondent,other'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $currency = $data['currency'] ?? 'KES';

        if ($data['basis'] === 'contractual_clause') {
            if (empty($data['contractId'])) {
                return response()->json(['error' => 'contractId is required when basis is contractual_clause'], 400);
            }
            $contract = Contract::find($data['contractId']);
            if (! $contract || ! $contract->has_arbitration_clause) {
                return response()->json([
                    'error' => 'The referenced contract has no arbitration clause on file - use basis "mutual_agreement" instead',
                ], 400);
            }
        }

        $slaTier = SlaService::deriveTier((float) $data['disputeValue'], $currency);
        $caseNumber = CaseNumberService::generate();
        $initialStatus = $data['basis'] === 'contractual_clause' ? 'pending_assignment' : 'pending_agreement';

        $case = ArbitrationCase::create([
            'case_number' => $caseNumber,
            'project_id' => $data['projectId'] ?? null,
            'contract_id' => $data['contractId'] ?? null,
            'dispute_value' => $data['disputeValue'],
            'currency' => $currency,
            'category' => $data['category'],
            'description' => $data['description'],
            'basis' => $data['basis'],
            'sla_tier' => $slaTier,
            'status' => $initialStatus,
            'created_by' => Auth::id(),
        ]);

        foreach ($data['parties'] as $p) {
            $case->parties()->attach($p['partyId'], ['role' => $p['role']]);
        }

        \App\Services\AuditService::log(Auth::id(), 'case_created', 'case', $case->id, null, $request->ip());
        \App\Services\CaseTimelineService::statusChanged(
            (int) $case->id, null, $initialStatus, Auth::id(),
            eventTitle: "Case {$caseNumber} filed",
        );

        return response()->json($this->withCaseSummary(ArbitrationCase::query())->find($case->id), 201);
    }

    /**
     * For basis = 'mutual_agreement' cases: staff confirm that both parties
     * have submitted a signed submission agreement (uploaded beforehand via
     * POST /documents against this case), moving the case out of
     * 'pending_agreement' into the assignable pool.
     */
    public function confirmAgreement(Request $request, string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        try {
            $data = $request->validate(['documentPublicId' => ['required', 'uuid']]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'Invalid case id or documentPublicId'], 400);
        }

        $case = ArbitrationCase::find($id);
        if (! $case) {
            return response()->json(['error' => 'Case not found'], 404);
        }
        if ($case->basis !== 'mutual_agreement' || $case->status !== 'pending_agreement') {
            return response()->json(['error' => 'Case is not awaiting a submission agreement'], 400);
        }

        $document = Document::where('public_id', $data['documentPublicId'])->first();
        if (! $document || (int) $document->case_id !== (int) $case->id || $document->document_type !== 'submission_agreement') {
            return response()->json([
                'error' => 'documentPublicId must reference a submission_agreement document already uploaded for this case',
            ], 400);
        }

        $case->update(['submission_agreement_doc_id' => $document->id, 'status' => 'pending_assignment']);

        \App\Services\AuditService::log(Auth::id(), 'case_agreement_confirmed', 'case', $id, null, $request->ip());
        \App\Services\CaseTimelineService::statusChanged(
            $id, 'pending_agreement', 'pending_assignment', Auth::id(),
            eventTitle: 'Submission agreement confirmed',
        );

        return response()->json($this->withCaseSummary(ArbitrationCase::query())->find($id));
    }

    /**
     * Staff-only CSV export of the case register, most-recently-filed
     * first, with the current/most recent arbitrator attached - the
     * counterpart to ArbitratorController::export for AAK's records.
     */
    public function export(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $cases = $this->withCaseSummary(ArbitrationCase::query())->orderByDesc('filed_at')->get();

        $filename = 'cases-export-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($cases) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'Case Number', 'Category', 'Status', 'SLA Tier', 'Dispute Value', 'Currency',
                'Filed At', 'Concluded At', 'Outcome', 'Arbitrator', 'AI Suggested Category',
            ]);

            foreach ($cases as $case) {
                $assignment = $case->assignments->first();
                fputcsv($out, [
                    $case->case_number,
                    $case->category,
                    $case->status,
                    $case->sla_tier,
                    $case->dispute_value,
                    $case->currency,
                    $case->filed_at,
                    $case->concluded_at,
                    $case->outcome,
                    $assignment?->arbitrator?->full_name ?? '',
                    $case->ai_suggested_category ?? '',
                ]);
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function show(string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }

        $hasAccess = CaseAccessService::canAccess($id, Auth::user());
        $case = $hasAccess ? $this->withCaseSummary(ArbitrationCase::query())->find($id) : null;

        if (! $case) {
            // Same response whether the case doesn't exist or the caller
            // can't see it - don't leak case existence to accounts with no
            // relationship to it.
            return response()->json(['error' => 'Case not found'], 404);
        }

        return response()->json($case);
    }

    /** The procedural timeline (case_events), newest last - for the case detail Activity tab. */
    public function timeline(string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }
        if (! CaseAccessService::canAccess($id, Auth::user())) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        $events = \App\Models\CaseEvent::where('case_id', $id)
            ->with('actor:id,full_name,email')
            ->orderBy('event_at')
            ->get();

        return response()->json($events);
    }
}
