<?php

namespace App\Http\Controllers;

use App\Models\Arbitrator;
use App\Models\ArbitrationCase;
use App\Models\User;
use App\Services\ConflictService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ArbitratorController extends Controller
{
    /**
     * Onboards a new arbitrator: creates their login (role='arbitrator') and
     * profile together. Returns a one-time temporary password - AAK is
     * responsible for delivering it to the arbitrator out of band and
     * should have them change it on first login (no forced-change flow exists yet).
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'email' => ['required', 'email'],
                'fullName' => ['required', 'string', 'max:255'],
                'aakMembershipNo' => ['nullable', 'string', 'max:50'],
                'currentPosition' => ['nullable', 'string', 'max:255'],
                'currentOrganization' => ['nullable', 'string', 'max:255'],
                'aakChapter' => ['nullable', 'string', 'max:150'],
                'yearsOfPractice' => ['nullable', 'integer', 'min:0', 'max:100'],
                'phone' => ['nullable', 'string', 'max:50'],
                'bio' => ['nullable', 'string'],
                'adrExperienceNotes' => ['nullable', 'string'],
                'specializations' => ['nullable', 'array'],
                'specializations.*' => ['string', 'max:150'],
                'qualifications' => ['nullable', 'array'],
                'qualifications.*' => ['string', 'max:500'],
                'registrations' => ['nullable', 'array'],
                'registrations.*.body' => ['required_with:registrations', 'string', 'max:150'],
                'registrations.*.registrationNumber' => ['nullable', 'string', 'max:100'],
                'joinedAt' => ['nullable', 'date'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        if (User::where('email', $data['email'])->exists()) {
            return response()->json(['error' => 'A user with this email already exists'], 409);
        }

        $temporaryPassword = Str::random(12);

        $arbitrator = DB::transaction(function () use ($data, $temporaryPassword) {
            $user = User::create([
                'email' => $data['email'],
                'password_hash' => Hash::make($temporaryPassword),
                'role' => 'arbitrator',
                'status' => 'active',
            ]);

            $arbitrator = Arbitrator::create([
                'user_id' => $user->id,
                'full_name' => $data['fullName'],
                'aak_membership_no' => $data['aakMembershipNo'] ?? null,
                'current_position' => $data['currentPosition'] ?? null,
                'current_organization' => $data['currentOrganization'] ?? null,
                'aak_chapter' => $data['aakChapter'] ?? null,
                'years_of_practice' => $data['yearsOfPractice'] ?? null,
                'phone' => $data['phone'] ?? null,
                'bio' => $data['bio'] ?? null,
                'adr_experience_notes' => $data['adrExperienceNotes'] ?? null,
                'joined_at' => $data['joinedAt'] ?? now(),
            ]);

            foreach ($data['specializations'] ?? [] as $s) {
                $arbitrator->specializations()->create(['specialization' => $s]);
            }
            foreach ($data['qualifications'] ?? [] as $q) {
                $arbitrator->qualifications()->create(['qualification' => $q]);
            }
            foreach ($data['registrations'] ?? [] as $r) {
                $arbitrator->registrations()->create(['body' => $r['body'], 'registration_number' => $r['registrationNumber'] ?? null]);
            }

            return $arbitrator->load('specializations', 'qualifications', 'registrations');
        });

        return response()->json(['arbitrator' => $arbitrator, 'temporaryPassword' => $temporaryPassword], 201);
    }

    /**
     * The arbitrator directory/panel. Supports filtering and sorting so
     * staff can find panelists by field, track record, or by the kind of
     * case they've actually handled before - not just a flat score-ranked
     * list:
     *   - q: free-text match against name, current position, bio, and
     *     experience notes (FULLTEXT, natural language mode), plus an exact
     *     membership-number match
     *   - status: active|inactive|suspended
     *   - specialization: matches arbitrator_specializations.specialization
     *   - caseCategory: only arbitrators who have at least one assignment
     *     on a case of this category (i.e. "filter by what case they've
     *     been assigned to")
     *   - minYearsOfPractice / minYearsAsArbitrator
     *   - sortBy: score (default) | casesClosedCount | yearsOfPractice |
     *     yearsAsArbitrator | totalCasesAssigned
     *   - sortDir: desc (default) | asc
     */
    public function index(Request $request): JsonResponse
    {
        $query = Arbitrator::with(['specializations', 'qualifications', 'registrations'])
            ->withCount('assignments as total_cases_assigned')
            ->with(['assignments' => fn ($q) => $q->whereIn('status', ['ongoing'])
                ->select('id', 'case_id', 'arbitrator_id', 'status', 'due_date')]);

        if ($q = $request->query('q')) {
            $query->where(function ($inner) use ($q) {
                $inner->whereFullText(['full_name', 'current_position', 'bio', 'adr_experience_notes'], $q)
                    ->orWhere('aak_membership_no', $q);
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($specialization = $request->query('specialization')) {
            $query->whereHas('specializations', fn ($q) => $q->where('specialization', $specialization));
        }

        if ($caseCategory = $request->query('caseCategory')) {
            $query->whereHas('assignments.case', fn ($q) => $q->where('category', $caseCategory));
        }

        if ($minYearsOfPractice = $request->query('minYearsOfPractice')) {
            $query->where('years_of_practice', '>=', (int) $minYearsOfPractice);
        }

        if ($minYearsAsArbitrator = $request->query('minYearsAsArbitrator')) {
            $query->where('joined_at', '<=', now()->subYears((int) $minYearsAsArbitrator));
        }

        $sortDir = $request->query('sortDir') === 'asc' ? 'asc' : 'desc';
        switch ($request->query('sortBy')) {
            case 'casesClosedCount':
                $query->orderBy('cases_closed_count', $sortDir);
                break;
            case 'yearsOfPractice':
                $query->orderBy('years_of_practice', $sortDir);
                break;
            case 'yearsAsArbitrator':
                // Earlier joined_at = more years of experience, so the
                // date-ordering direction is the inverse of the requested one.
                $query->orderBy('joined_at', $sortDir === 'asc' ? 'desc' : 'asc');
                break;
            case 'totalCasesAssigned':
                $query->orderBy('total_cases_assigned', $sortDir);
                break;
            default:
                $query->orderBy('score', $sortDir);
        }

        $arbitrators = $query->limit(500)->get();

        return response()->json($arbitrators);
    }

    /**
     * Staff-only CSV export for AAK's records: one row per (arbitrator,
     * case assignment), so each arbitrator's assignment history reads
     * newest-first; arbitrators with no assignments still get one row with
     * blank case columns. Covers the admin request to see, per arbitrator,
     * how long they've been doing arbitration and the cases they've
     * handled starting from the most recent.
     */
    public function export(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $arbitrators = Arbitrator::with(['assignments' => fn ($q) => $q->with('case:id,case_number,category,status')->orderByDesc('assigned_at')])
            ->orderBy('full_name')
            ->get();

        $filename = 'arbitrators-export-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($arbitrators) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'Arbitrator ID', 'Full Name', 'Status', 'Joined AAK Panel', 'Years As Arbitrator',
                'Years Of Practice', 'Cases Closed', 'Score', 'Case Number', 'Case Category',
                'Assignment Status', 'Assigned At', 'Completed At',
            ]);

            foreach ($arbitrators as $arbitrator) {
                $base = [
                    $arbitrator->id,
                    $arbitrator->full_name,
                    $arbitrator->status,
                    $arbitrator->joined_at?->toDateString(),
                    $arbitrator->years_as_arbitrator,
                    $arbitrator->years_of_practice,
                    $arbitrator->cases_closed_count,
                    $arbitrator->score,
                ];

                if ($arbitrator->assignments->isEmpty()) {
                    fputcsv($out, [...$base, '', '', '', '', '']);
                    continue;
                }

                foreach ($arbitrator->assignments as $assignment) {
                    fputcsv($out, [
                        ...$base,
                        $assignment->case->case_number ?? '',
                        $assignment->case->category ?? '',
                        $assignment->status,
                        $assignment->assigned_at,
                        $assignment->completed_at,
                    ]);
                }
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /**
     * The conflict-cleared, active arbitrator pool for a case, sorted by
     * score (soft ranking - staff can still assign directly, and a
     * case's own parties can now pick from this same list themselves; see
     * AssignmentController::store). Arbitrators with a declared conflict are
     * excluded outright; arbitrators with a prior-engagement signal are
     * included but flagged, since name/party matches alone aren't reliable
     * enough to auto-exclude.
     *
     * Open to staff (any case) and to a party linked to this specific case
     * (only while it's actually awaiting assignment) - not to arbitrators,
     * who have no business browsing the pool they might be assigned from.
     */
    public function eligible(Request $request): JsonResponse
    {
        $caseId = Ids::parse($request->query('caseId'));
        if ($caseId === null) {
            return response()->json(['error' => 'caseId query parameter is required'], 400);
        }

        $case = ArbitrationCase::find($caseId);
        if (! $case) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        $user = Auth::user();
        $isLinkedParty = $user->role === 'party' && \App\Models\CaseParty::where('case_id', $caseId)
            ->whereHas('party', fn ($q) => $q->where('user_id', $user->id))->exists();
        if (! $user->isStaff() && ! $isLinkedParty) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        if ($isLinkedParty && $case->status !== 'pending_assignment') {
            return response()->json(['error' => 'This case is not awaiting an arbitrator'], 400);
        }

        $activeArbitrators = Arbitrator::where('status', 'active')
            ->with('specializations')
            ->orderByDesc('score')
            ->get();

        // Best-effort AI suggestion from DocumentAiService (see
        // DocumentController::store) - never authoritative, just used to
        // surface a likely-good match first for whoever is assigning.
        $suggestedSpecializations = collect($case->ai_suggested_specializations ?? [])
            ->map(fn ($s) => mb_strtolower($s))->all();
        $suggestedCategory = $case->ai_suggested_category ? mb_strtolower($case->ai_suggested_category) : null;

        $eligible = $activeArbitrators
            ->map(function (Arbitrator $arbitrator) use ($caseId) {
                $conflicts = ConflictService::check((int) $arbitrator->id, $caseId);

                return ['arbitrator' => $arbitrator, 'conflicts' => $conflicts];
            })
            ->filter(fn ($row) => ! $row['conflicts']['blocked'])
            ->map(function ($row) use ($suggestedSpecializations, $suggestedCategory) {
                $data = $row['arbitrator']->toArray();
                $data['priorEngagementFlags'] = $row['conflicts']['priorEngagements'];

                $arbitratorSpecializations = collect($data['specializations'] ?? [])
                    ->map(fn ($s) => mb_strtolower($s['specialization'] ?? ''));
                $data['aiRecommended'] = (
                    $suggestedSpecializations !== [] && $arbitratorSpecializations->intersect($suggestedSpecializations)->isNotEmpty()
                ) || ($suggestedCategory !== null && $arbitratorSpecializations->contains($suggestedCategory));

                return $data;
            })
            // Stable sort: AI-recommended matches float to the top, but the
            // existing score ordering is preserved within each group.
            ->sortByDesc('aiRecommended')
            ->values();

        return response()->json($eligible);
    }

    public function declareConflict(Request $request, string $arbitratorId): JsonResponse
    {
        $id = Ids::parse($arbitratorId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid request'], 400);
        }

        try {
            $data = $request->validate([
                'partyId' => ['nullable', 'integer', 'min:1'],
                'organizationId' => ['nullable', 'integer', 'min:1'],
                'reason' => ['required', 'string', 'max:500'],
                'expiresAt' => ['nullable', 'date'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'Invalid request'], 400);
        }

        if (empty($data['partyId']) && empty($data['organizationId'])) {
            return response()->json(['error' => 'Either partyId or organizationId is required'], 400);
        }

        $conflict = \App\Models\ArbitratorConflict::create([
            'arbitrator_id' => $id,
            'conflicted_party_id' => $data['partyId'] ?? null,
            'conflicted_organization_id' => $data['organizationId'] ?? null,
            'reason' => $data['reason'],
            'expires_at' => $data['expiresAt'] ?? null,
        ]);

        return response()->json($conflict, 201);
    }

    public function show(string $arbitratorId): JsonResponse
    {
        $id = Ids::parse($arbitratorId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid arbitrator id'], 400);
        }

        $arbitrator = Arbitrator::with([
            'specializations', 'qualifications', 'registrations', 'conflicts',
            'assignments' => fn ($q) => $q->with('case:id,case_number,status,outcome')->orderByDesc('assigned_at'),
        ])->find($id);

        if (! $arbitrator) {
            return response()->json(['error' => 'Arbitrator not found'], 404);
        }

        return response()->json($arbitrator);
    }
}
