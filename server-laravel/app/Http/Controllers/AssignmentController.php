<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\AssignmentExtension;
use App\Models\ArbitrationCase;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Just the per-assignment due-date extension machinery now -
 * appointing/withdrawing/concluding a case's arbitrator(s) all moved to
 * TribunalController, which keeps tribunal_members (the legal/procedural
 * record) and this table's own rows (kept for scoring/workload) in sync.
 * Extensions don't need to know about tribunals at all - a due date is
 * still a property of one arbitrator's one assignment, panel or not.
 */
class AssignmentController extends Controller
{
    private function isStaff(): bool
    {
        return Auth::user()->isStaff();
    }

    public function requestExtension(Request $request, string $assignmentId): JsonResponse
    {
        $id = Ids::parse($assignmentId);
        try {
            $data = $request->validate([
                'reason' => ['required', 'string', 'max:500'],
                'requestedDueDate' => ['required', 'date'],
            ]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'reason and requestedDueDate are required'], 400);
        }

        $assignment = Assignment::with('arbitrator')->find($id);
        if (! $assignment) {
            return response()->json(['error' => 'Assignment not found'], 404);
        }

        $user = Auth::user();
        $isOwningArbitrator = $user->role === 'arbitrator' && (int) $assignment->arbitrator->user_id === (int) $user->id;
        if (! $isOwningArbitrator && ! $this->isStaff()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $extension = AssignmentExtension::create([
            'assignment_id' => $id,
            'requested_by' => $user->id,
            'reason' => $data['reason'],
            'previous_due_date' => $assignment->due_date,
            'new_due_date' => $data['requestedDueDate'],
        ]);

        return response()->json($extension, 201);
    }

    public function listExtensions(string $assignmentId): JsonResponse
    {
        $id = Ids::parse($assignmentId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid assignment id'], 400);
        }

        $assignment = Assignment::with('arbitrator')->find($id);
        if (! $assignment) {
            return response()->json(['error' => 'Assignment not found'], 404);
        }

        $user = Auth::user();
        $isOwningArbitrator = $user->role === 'arbitrator' && (int) $assignment->arbitrator->user_id === (int) $user->id;
        if (! $isOwningArbitrator && ! $this->isStaff()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $extensions = AssignmentExtension::where('assignment_id', $id)->orderByDesc('requested_at')->get();

        return response()->json($extensions);
    }

    public function decideExtension(Request $request, string $assignmentId, string $extensionId): JsonResponse
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

        $extension = AssignmentExtension::find($id);
        if (! $extension || $extension->status !== 'pending') {
            return response()->json(['error' => 'No pending extension request found'], 404);
        }

        DB::transaction(function () use ($extension, $data, $id) {
            $extension->update(['status' => $data['decision'], 'decided_by' => Auth::id(), 'decided_at' => now()]);

            if ($data['decision'] === 'approved') {
                $assignment = Assignment::findOrFail($extension->assignment_id);
                $assignment->update(['due_date' => $extension->new_due_date, 'status' => 'ongoing']);
                ArbitrationCase::where('id', $assignment->case_id)->update(['due_date' => $extension->new_due_date]);
            }
        });

        return response()->json(['message' => "Extension {$data['decision']}"]);
    }
}
