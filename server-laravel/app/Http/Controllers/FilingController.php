<?php

namespace App\Http\Controllers;

use App\Models\ArbitrationCase;
use App\Models\Document;
use App\Models\Filing;
use App\Services\AuditService;
use App\Services\CaseAccessService;
use App\Services\CaseTimelineService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A formal procedural submission (e.g. "Respondent's Statement of
 * Defence"), grouping a main document with its exhibits - distinct from
 * plain /documents uploads, which keep working unchanged for anything
 * that isn't a formal filing (ID/KYC, correspondence). Every document
 * referenced here must already exist via a normal document upload; this
 * is a grouping/labelling layer on top, not a separate upload path.
 */
class FilingController extends Controller
{
    public function index(string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }
        if (! CaseAccessService::canAccess($id, Auth::user())) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        $filings = Filing::where('case_id', $id)
            ->with(['party:id,full_name', 'documents:id,public_id,file_name,document_type'])
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json($filings);
    }

    public function store(Request $request, string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }

        $case = ArbitrationCase::find($id);
        if (! $case || ! CaseAccessService::canAccess($id, Auth::user())) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        try {
            $data = $request->validate([
                'partyId' => ['nullable', 'integer', 'min:1'],
                'filingType' => ['required', 'string', 'max:100'],
                'title' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'documentPublicIds' => ['nullable', 'array'],
                'documentPublicIds.*' => ['uuid'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $documents = Document::whereIn('public_id', $data['documentPublicIds'] ?? [])->where('case_id', $id)->get();
        if (count($data['documentPublicIds'] ?? []) !== $documents->count()) {
            return response()->json(['error' => 'One or more documentPublicIds do not belong to this case'], 400);
        }

        $filing = DB::transaction(function () use ($data, $id, $documents) {
            $filing = Filing::create([
                'case_id' => $id,
                'party_id' => $data['partyId'] ?? null,
                'submitted_by_user_id' => Auth::id(),
                'filing_type' => $data['filingType'],
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
            ]);

            foreach ($documents->values() as $i => $document) {
                $filing->documents()->attach($document->id, ['sort_order' => $i]);
            }

            return $filing;
        });

        AuditService::log(Auth::id(), 'filing_submitted', 'filing', $filing->id, ['caseId' => $id, 'filingType' => $data['filingType']], $request->ip());
        CaseTimelineService::log($id, 'filing_submitted', Auth::id(), "Filing submitted: {$data['title']}", referenceType: 'filing', referenceId: (int) $filing->id);

        return response()->json($filing->load('documents:id,public_id,file_name,document_type'), 201);
    }

    /** Attaches an already-uploaded document (e.g. a late exhibit) to an existing filing. */
    public function attachDocument(Request $request, string $filingId): JsonResponse
    {
        $id = Ids::parse($filingId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid filing id'], 400);
        }

        $filing = Filing::find($id);
        if (! $filing || ! CaseAccessService::canAccess((int) $filing->case_id, Auth::user())) {
            return response()->json(['error' => 'Filing not found'], 404);
        }

        try {
            $data = $request->validate([
                'documentPublicId' => ['required', 'uuid'],
                'documentRole' => ['nullable', 'string', 'max:50'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'documentPublicId is required'], 400);
        }

        $document = Document::where('public_id', $data['documentPublicId'])->where('case_id', $filing->case_id)->first();
        if (! $document) {
            return response()->json(['error' => 'Document not found for this case'], 404);
        }

        $nextOrder = $filing->documents()->count();
        $filing->documents()->syncWithoutDetaching([
            $document->id => ['document_role' => $data['documentRole'] ?? null, 'sort_order' => $nextOrder],
        ]);

        AuditService::log(Auth::id(), 'filing_document_attached', 'filing', $filing->id, ['documentPublicId' => $data['documentPublicId']], $request->ip());

        return response()->json($filing->load('documents:id,public_id,file_name,document_type'));
    }

    public function decide(Request $request, string $filingId): JsonResponse
    {
        $id = Ids::parse($filingId);
        try {
            $data = $request->validate([
                'status' => ['required', 'in:accepted,rejected'],
                'rejectionReason' => ['required_if:status,rejected', 'nullable', 'string', 'max:500'],
            ]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'A valid status is required'], 400);
        }

        $filing = Filing::find($id);
        if (! $filing || $filing->status !== 'submitted') {
            return response()->json(['error' => 'No pending filing found'], 404);
        }

        $now = now();
        $filing->update($data['status'] === 'accepted'
            ? ['status' => 'accepted', 'accepted_at' => $now, 'accepted_by' => Auth::id()]
            : ['status' => 'rejected', 'rejected_at' => $now, 'rejection_reason' => $data['rejectionReason']]);

        AuditService::log(Auth::id(), 'filing_'.$data['status'], 'filing', $id, null, $request->ip());
        CaseTimelineService::log((int) $filing->case_id, 'filing_'.$data['status'], Auth::id(), "Filing {$data['status']}: {$filing->title}", referenceType: 'filing', referenceId: $id);

        return response()->json($filing);
    }
}
