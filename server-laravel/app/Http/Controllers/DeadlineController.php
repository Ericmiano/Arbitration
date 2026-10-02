<?php

namespace App\Http\Controllers;

use App\Models\Deadline;
use App\Models\DeadlineExtension;
use App\Services\CaseAccessService;
use App\Services\CaseTimelineService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A general procedural deadline (filing due, evidence due, award due,
 * hearing prep, ...) - deliberately separate from assignments.due_date /
 * assignment_extensions, which keep tracking the arbitrator's own overall
 * case deadline exactly as before. deadline_type is free text (not an
 * enum) since this vocabulary is expected to keep growing.
 */
class DeadlineController extends Controller
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

        $deadlines = Deadline::where('case_id', $id)->orderBy('due_at')->get();

        return response()->json($deadlines);
    }

    public function store(Request $request, string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }
        if (! CaseAccessService::canAccess($id, Auth::user())) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        try {
            $data = $request->validate([
                'tribunalMemberId' => ['nullable', 'integer', 'min:1'],
                'partyId' => ['nullable', 'integer', 'min:1'],
                'deadlineType' => ['required', 'string', 'max:100'],
                'title' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'dueAt' => ['required', 'date'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $deadline = Deadline::create([
            'case_id' => $id,
            'tribunal_member_id' => $data['tribunalMemberId'] ?? null,
            'party_id' => $data['partyId'] ?? null,
            'deadline_type' => $data['deadlineType'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_at' => $data['dueAt'],
            'created_by' => Auth::id(),
        ]);

        CaseTimelineService::log($id, 'deadline_created', Auth::id(), "Deadline set: {$data['title']}", referenceType: 'deadline', referenceId: (int) $deadline->id);

        return response()->json($deadline, 201);
    }

    public function update(Request $request, string $deadlineId): JsonResponse
    {
        $id = Ids::parse($deadlineId);
        try {
            $data = $request->validate(['status' => ['required', 'in:completed,waived,cancelled']]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'A valid status is required'], 400);
        }

        $deadline = Deadline::find($id);
        if (! $deadline || $deadline->status !== 'pending') {
            return response()->json(['error' => 'No pending deadline found'], 404);
        }
        if (! CaseAccessService::canAccess((int) $deadline->case_id, Auth::user())) {
            return response()->json(['error' => 'Deadline not found'], 404);
        }

        $deadline->update([
            'status' => $data['status'],
            'completed_at' => $data['status'] === 'completed' ? now() : null,
            'completed_by' => $data['status'] === 'completed' ? Auth::id() : null,
        ]);

        CaseTimelineService::log((int) $deadline->case_id, 'deadline_'.$data['status'], Auth::id(), "Deadline {$data['status']}: {$deadline->title}", referenceType: 'deadline', referenceId: $id);

        return response()->json($deadline);
    }

    public function requestExtension(Request $request, string $deadlineId): JsonResponse
    {
        $id = Ids::parse($deadlineId);
        try {
            $data = $request->validate([
                'reason' => ['required', 'string', 'max:500'],
                'requestedDueAt' => ['required', 'date'],
            ]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'reason and requestedDueAt are required'], 400);
        }

        $deadline = Deadline::find($id);
        if (! $deadline) {
            return response()->json(['error' => 'Deadline not found'], 404);
        }
        if (! CaseAccessService::canAccess((int) $deadline->case_id, Auth::user())) {
            return response()->json(['error' => 'Deadline not found'], 404);
        }
        if ($data['requestedDueAt'] <= $deadline->due_at->toDateTimeString()) {
            return response()->json(['error' => 'requestedDueAt must be after the current due date'], 400);
        }

        $extension = DeadlineExtension::create([
            'deadline_id' => $id,
            'requested_by' => Auth::id(),
            'original_due_at' => $deadline->due_at,
            'requested_due_at' => $data['requestedDueAt'],
            'reason' => $data['reason'],
        ]);

        return response()->json($extension, 201);
    }

    public function decideExtension(Request $request, string $deadlineId, string $extensionId): JsonResponse
    {
        $id = Ids::parse($extensionId);
        try {
            $data = $request->validate(['decision' => ['required', 'in:approved,rejected']]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'decision must be "approved" or "rejected"'], 400);
        }

        $extension = DeadlineExtension::with('deadline')->find($id);
        if (! $extension || $extension->decision !== 'pending') {
            return response()->json(['error' => 'No pending extension request found'], 404);
        }

        DB::transaction(function () use ($extension, $data) {
            $extension->update(['decision' => $data['decision'], 'decided_by' => Auth::id(), 'decided_at' => now()]);

            if ($data['decision'] === 'approved') {
                $extension->deadline->update(['due_at' => $extension->requested_due_at, 'status' => 'pending']);
            }
        });

        CaseTimelineService::log(
            (int) $extension->deadline->case_id, 'deadline_extension_'.$data['decision'], Auth::id(),
            "Deadline extension {$data['decision']}: {$extension->deadline->title}",
        );

        return response()->json(['message' => "Extension {$data['decision']}"]);
    }
}
