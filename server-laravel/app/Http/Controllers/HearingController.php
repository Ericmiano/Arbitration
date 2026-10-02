<?php

namespace App\Http\Controllers;

use App\Models\ArbitrationCase;
use App\Models\Hearing;
use App\Services\AuditService;
use App\Services\CaseAccessService;
use App\Services\NotifyService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class HearingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        $caseIdParam = $request->query('caseId');

        if ($caseIdParam) {
            $caseId = Ids::parse($caseIdParam);
            if ($caseId === null) {
                return response()->json(['error' => 'Invalid case id'], 400);
            }
            if (! CaseAccessService::canAccess($caseId, $user)) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
            $caseIds = [$caseId];
        } else {
            $caseIds = CaseAccessService::accessibleCaseIds($user);
        }

        $hearings = Hearing::whereIn('case_id', $caseIds)
            ->with('case:id,case_number')
            ->orderBy('scheduled_at')
            ->limit(500)
            ->get();

        return response()->json($hearings);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'caseId' => ['required', 'integer', 'min:1'],
                'scheduledAt' => ['required', 'date'],
                'mode' => ['nullable', 'in:in_person,virtual'],
                'venueOrLink' => ['required', 'string', 'max:500'],
                'agenda' => ['nullable', 'string', 'max:5000'],
                'requiredDocuments' => ['nullable', 'string', 'max:2000'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $case = ArbitrationCase::find($data['caseId']);
        if (! $case) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        $hearing = Hearing::create([
            'case_id' => $data['caseId'],
            'scheduled_at' => $data['scheduledAt'],
            'mode' => $data['mode'] ?? 'in_person',
            'venue_or_link' => $data['venueOrLink'],
            'agenda' => $data['agenda'] ?? null,
            'required_documents' => $data['requiredDocuments'] ?? null,
            'scheduled_by' => Auth::id(),
        ]);

        AuditService::log(Auth::id(), 'hearing_scheduled', 'hearing', $hearing->id, ['caseId' => $data['caseId'], 'scheduledAt' => $data['scheduledAt']], $request->ip());

        $participants = NotifyService::caseParticipantUserIds($data['caseId']);
        NotifyService::notifyUsers(
            $participants,
            'hearing_scheduled',
            'hearing',
            (int) $hearing->id,
            "A hearing has been scheduled for {$case->case_number} on {$hearing->scheduled_at->format('Y-m-d H:i')}.",
        );

        return response()->json($hearing, 201);
    }

    public function update(Request $request, string $hearingId): JsonResponse
    {
        $id = Ids::parse($hearingId);
        try {
            $data = $request->validate([
                'scheduledAt' => ['nullable', 'date'],
                'mode' => ['nullable', 'in:in_person,virtual'],
                'venueOrLink' => ['nullable', 'string', 'max:500'],
                'agenda' => ['nullable', 'string', 'max:5000'],
                'requiredDocuments' => ['nullable', 'string', 'max:2000'],
                'status' => ['nullable', 'in:scheduled,completed,cancelled,postponed'],
            ]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'Invalid request'], 400);
        }

        $existing = Hearing::with('case')->find($id);
        if (! $existing) {
            return response()->json(['error' => 'Hearing not found'], 404);
        }

        $isReschedule = (isset($data['scheduledAt']) && ! $existing->scheduled_at->eq($data['scheduledAt']))
            || (isset($data['venueOrLink']) && $data['venueOrLink'] !== $existing->venue_or_link);
        $isCancellation = ($data['status'] ?? null) === 'cancelled' && $existing->status !== 'cancelled';

        $existing->update(array_filter([
            'scheduled_at' => $data['scheduledAt'] ?? null,
            'mode' => $data['mode'] ?? null,
            'venue_or_link' => $data['venueOrLink'] ?? null,
            'agenda' => $data['agenda'] ?? null,
            'required_documents' => $data['requiredDocuments'] ?? null,
            'status' => $data['status'] ?? null,
        ], fn ($v) => $v !== null));

        AuditService::log(Auth::id(), 'hearing_updated', 'hearing', $id, ['changes' => $data], $request->ip());

        if ($isReschedule || $isCancellation) {
            $participants = NotifyService::caseParticipantUserIds((int) $existing->case_id);
            $message = $isCancellation
                ? "The hearing scheduled for {$existing->case->case_number} has been cancelled."
                : "The hearing for {$existing->case->case_number} has been rescheduled to {$existing->fresh()->scheduled_at->format('Y-m-d H:i')}.";
            NotifyService::notifyUsers($participants, $isCancellation ? 'hearing_cancelled' : 'hearing_rescheduled', 'hearing', $id, $message);
        }

        return response()->json($existing->fresh());
    }
}
