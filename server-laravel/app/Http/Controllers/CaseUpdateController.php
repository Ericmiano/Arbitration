<?php

namespace App\Http\Controllers;

use App\Models\Arbitrator;
use App\Models\ArbitrationCase;
use App\Models\CaseUpdate;
use App\Services\AuditService;
use App\Services\CaseAccessService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class CaseUpdateController extends Controller
{
    public function index(string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }

        $user = Auth::user();
        if (! CaseAccessService::canAccess($id, $user)) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        $updates = CaseUpdate::where('case_id', $id)
            ->with('postedBy:id,email,full_name,role')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return response()->json($updates);
    }

    /**
     * Posts a progress note on an ongoing case - the replacement for
     * automatic date-based "overdue" flagging. Only the assigned arbitrator
     * (or staff, on their behalf) can post one; parties and other
     * arbitrators can read but not write.
     */
    public function store(Request $request, string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        try {
            $data = $request->validate(['note' => ['required', 'string', 'max:5000']]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'A note is required'], 400);
        }

        $case = ArbitrationCase::find($id);
        if (! $case) {
            return response()->json(['error' => 'Case not found'], 404);
        }

        $user = Auth::user();
        $isOwningArbitrator = false;
        if ($user->role === 'arbitrator') {
            $arbitrator = Arbitrator::where('user_id', $user->id)->first();
            $isOwningArbitrator = $arbitrator && $arbitrator->assignments()->where('case_id', $id)->where('status', 'ongoing')->exists();
        }
        if (! $isOwningArbitrator && ! $user->isStaff()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $update = CaseUpdate::create([
            'case_id' => $id,
            'posted_by' => $user->id,
            'note' => $data['note'],
        ]);

        AuditService::log($user->id, 'case_update_posted', 'case', $id, null, $request->ip());

        return response()->json($update->load('postedBy:id,email,full_name,role'), 201);
    }
}
