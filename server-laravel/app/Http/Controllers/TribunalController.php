<?php

namespace App\Http\Controllers;

use App\Models\ArbitrationCase;
use App\Models\Arbitrator;
use App\Models\CaseConflictCheck;
use App\Models\CaseParty;
use App\Models\CaseTribunal;
use App\Models\TribunalMember;
use App\Services\AuditService;
use App\Services\CaseTimelineService;
use App\Services\ConflictService;
use App\Services\ScoringService;
use App\Services\SlaService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The tribunal is the legal/procedural record of who is deciding a case -
 * distinct from `assignments` (kept untouched, the administrative
 * workload/scoring record ScoringService and ReportController already
 * depend on). A case gets exactly one active (non-dissolved) tribunal at a
 * time, either a sole arbitrator or a 3-seat panel (2 co-arbitrators + a
 * chairperson).
 */
class TribunalController extends Controller
{
    private const PANEL_SEATS = ['co_arbitrator', 'co_arbitrator', 'chairperson'];

    private function isStaff(): bool
    {
        return Auth::user()->isStaff();
    }

    private function isLinkedParty(int $caseId): bool
    {
        $user = Auth::user();

        return $user->role === 'party' && CaseParty::where('case_id', $caseId)
            ->whereHas('party', fn ($q) => $q->where('user_id', $user->id))->exists();
    }

    /** Creates the (empty) tribunal shell - members are added one at a time via addMember(). */
    public function store(Request $request, string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }

        try {
            $data = $request->validate(['tribunalType' => ['required', 'in:sole,panel']]);
        } catch (ValidationException) {
            return response()->json(['error' => 'tribunalType must be "sole" or "panel"'], 400);
        }

        $case = ArbitrationCase::find($id);
        if (! $case) {
            return response()->json(['error' => 'Case not found'], 404);
        }
        if (! $this->isStaff() && ! $this->isLinkedParty($id)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        if ($case->status !== 'pending_assignment') {
            return response()->json(['error' => "Case is not awaiting assignment (status: {$case->status})"], 400);
        }
        if ($case->activeTribunal()->exists()) {
            return response()->json(['error' => 'This case already has a tribunal being formed or constituted'], 409);
        }

        $tribunal = CaseTribunal::create([
            'case_id' => $id,
            'tribunal_type' => $data['tribunalType'],
            'status' => 'forming',
        ]);

        AuditService::log(Auth::id(), 'tribunal_opened', 'case_tribunal', $tribunal->id, ['caseId' => $id, 'tribunalType' => $data['tribunalType']], $request->ip());
        CaseTimelineService::log($id, 'tribunal_forming', Auth::id(), ucfirst($data['tribunalType']).' tribunal opened for appointment');

        return response()->json($tribunal, 201);
    }

    public function show(string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid case id'], 400);
        }

        $user = Auth::user();
        $isOwningArbitrator = $user->role === 'arbitrator' && TribunalMember::whereHas(
            'tribunal', fn ($q) => $q->where('case_id', $id)
        )->whereHas('arbitrator', fn ($q) => $q->where('user_id', $user->id))->exists();

        if (! $this->isStaff() && ! $this->isLinkedParty($id) && ! $isOwningArbitrator) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $tribunals = CaseTribunal::where('case_id', $id)
            ->with(['members' => fn ($q) => $q->with('arbitrator:id,full_name')->orderBy('created_at')])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($tribunals);
    }

    /**
     * The open seats remaining for a tribunal, given its type and current
     * active membership - e.g. a panel with one co-arbitrator already
     * appointed has one co_arbitrator seat and one chairperson seat left.
     */
    private function openSeats(CaseTribunal $tribunal): array
    {
        if ($tribunal->tribunal_type === 'sole') {
            $filled = $tribunal->activeMembers()->count();

            return $filled === 0 ? ['sole_arbitrator'] : [];
        }

        $takenRoles = $tribunal->activeMembers()->pluck('role')->all();
        $remaining = self::PANEL_SEATS;
        foreach ($takenRoles as $role) {
            $idx = array_search($role, $remaining, true);
            if ($idx !== false) {
                unset($remaining[$idx]);
            }
        }

        return array_values($remaining);
    }

    public function addMember(Request $request, string $tribunalId): JsonResponse
    {
        $id = Ids::parse($tribunalId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid tribunal id'], 400);
        }

        $tribunal = CaseTribunal::with('case')->find($id);
        if (! $tribunal) {
            return response()->json(['error' => 'Tribunal not found'], 404);
        }
        if (! $this->isStaff() && ! $this->isLinkedParty((int) $tribunal->case_id)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        if ($tribunal->status !== 'forming') {
            return response()->json(['error' => "Tribunal is not accepting appointments (status: {$tribunal->status})"], 400);
        }

        try {
            $data = $request->validate([
                'arbitratorId' => ['required', 'integer', 'min:1'],
                'role' => ['nullable', 'in:sole_arbitrator,co_arbitrator,chairperson'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'arbitratorId is required'], 400);
        }

        $openSeats = $this->openSeats($tribunal);
        if (empty($openSeats)) {
            return response()->json(['error' => 'This tribunal has no open seats'], 409);
        }

        $role = $tribunal->tribunal_type === 'sole' ? 'sole_arbitrator' : ($data['role'] ?? null);
        if (! $role || ! in_array($role, $openSeats, true)) {
            return response()->json(['error' => 'That role has no open seat on this tribunal', 'openSeats' => array_unique($openSeats)], 400);
        }

        $arbitrator = Arbitrator::find($data['arbitratorId']);
        if (! $arbitrator || $arbitrator->status !== 'active') {
            return response()->json(['error' => 'Arbitrator is not active or does not exist'], 400);
        }

        $alreadyOnTribunal = $tribunal->activeMembers()->where('arbitrator_id', $arbitrator->id)->exists();
        if ($alreadyOnTribunal) {
            return response()->json(['error' => 'This arbitrator already holds a seat on this tribunal'], 409);
        }

        // Re-checked server-side even though the UI's own eligible-arbitrators
        // list already filtered conflicts out - never trust the client for
        // this. Logged unconditionally (cleared or not) - a defensible
        // record that this specific arbitrator was checked against this
        // specific case, not just a general standing-conflict lookup.
        $conflicts = ConflictService::check((int) $arbitrator->id, (int) $tribunal->case_id);
        $result = $conflicts['blocked']
            ? 'confirmed_conflict'
            : (! empty($conflicts['priorEngagements']) ? 'potential_conflict' : 'cleared');

        CaseConflictCheck::create([
            'case_id' => $tribunal->case_id,
            'arbitrator_id' => $arbitrator->id,
            'checked_by' => Auth::id(),
            'result' => $result,
            'notes' => $result !== 'cleared' ? json_encode($conflicts) : null,
        ]);

        if ($conflicts['blocked']) {
            return response()->json(['error' => 'Arbitrator has a declared conflict of interest for this case', 'conflicts' => $conflicts], 409);
        }

        // If this seat was vacated (withdrawn/recused/removed) rather than
        // never filled, link the new appointment back to whichever member
        // it replaces - not already linked as someone else's replacement -
        // so a seat's full membership history can be traced.
        $vacatedMember = TribunalMember::where('tribunal_id', $tribunal->id)
            ->where('role', $role)
            ->whereIn('status', ['withdrawn', 'recused', 'removed'])
            ->whereDoesntHave('replacement')
            ->latest('updated_at')
            ->first();

        $case = $tribunal->case;

        $member = DB::transaction(function () use ($tribunal, $arbitrator, $role, $vacatedMember) {
            return TribunalMember::create([
                'tribunal_id' => $tribunal->id,
                'arbitrator_id' => $arbitrator->id,
                'role' => $role,
                'appointed_by' => Auth::id(),
                'replaced_member_id' => $vacatedMember?->id,
                // Awaiting the arbitrator's own accept/decline (see accept()
                // / decline() below) - nothing is assigned or counted toward
                // their workload until they confirm.
                'status' => 'nominated',
            ]);
        });

        AuditService::log(Auth::id(), 'tribunal_member_nominated', 'tribunal_member', $member->id, ['arbitratorId' => $arbitrator->id, 'role' => $role], $request->ip());
        CaseTimelineService::log(
            (int) $tribunal->case_id, 'arbitrator_nominated', Auth::id(),
            "{$arbitrator->full_name} nominated as ".str_replace('_', ' ', $role).' - awaiting acceptance',
            referenceType: 'tribunal_member', referenceId: (int) $member->id,
        );

        \App\Services\NotifyService::notifyUsers(
            [$arbitrator->user_id], 'tribunal_nomination', 'tribunal_member', (int) $member->id,
            "You've been nominated as {$role} for case {$case->case_number}. Please accept or decline.",
        );

        return response()->json($member->load('arbitrator:id,full_name'), 201);
    }

    /**
     * The nominated arbitrator (or staff, acting on their behalf) confirms
     * the appointment. This is the moment the seat actually starts counting
     * toward their workload/scoring - creating the Assignment row - and the
     * moment that can complete the tribunal's constitution.
     */
    public function acceptMember(Request $request, string $tribunalId, string $memberId): JsonResponse
    {
        [$tribunal, $member, $errorResponse] = $this->findPendingNomination($tribunalId, $memberId);
        if ($errorResponse) {
            return $errorResponse;
        }

        $case = $tribunal->case;
        // Captured before the transaction, same reasoning as the old
        // addMember() constitution check: only a true first constitution
        // (case still pending_assignment) is a real status transition worth
        // recording - a mid-case seat replacement re-constitutes without the
        // case ever leaving 'ongoing'.
        $wasFirstConstitution = $case->status === 'pending_assignment';

        $justConstituted = DB::transaction(function () use ($tribunal, $member, $case, $wasFirstConstitution) {
            $member->update(['status' => 'accepted', 'accepted_at' => now()]);

            \App\Models\Assignment::create([
                'case_id' => $case->id,
                'arbitrator_id' => $member->arbitrator_id,
                'assigned_by' => Auth::id(),
                'due_date' => SlaService::computeDueDate($case->sla_tier, $case->currency),
                'status' => 'ongoing',
            ]);

            return $this->tryConstitute($tribunal, $case, $wasFirstConstitution);
        });

        AuditService::log(Auth::id(), 'tribunal_member_accepted', 'tribunal_member', $member->id, null, $request->ip());
        CaseTimelineService::log(
            (int) $tribunal->case_id, 'arbitrator_accepted', Auth::id(),
            "{$member->arbitrator->full_name} accepted appointment as ".str_replace('_', ' ', $member->role),
            referenceType: 'tribunal_member', referenceId: (int) $member->id,
        );

        if ($justConstituted) {
            if ($wasFirstConstitution) {
                CaseTimelineService::statusChanged(
                    (int) $tribunal->case_id, 'pending_assignment', 'ongoing', Auth::id(),
                    eventTitle: 'Tribunal constituted',
                );
            } else {
                CaseTimelineService::log((int) $tribunal->case_id, 'tribunal_reconstituted', Auth::id(), 'Tribunal reconstituted after seat replacement');
            }
        }

        return response()->json($member->fresh()->load('arbitrator:id,full_name'));
    }

    /** The nominated arbitrator (or staff) declines - the seat reopens for a new nomination. */
    public function declineMember(Request $request, string $tribunalId, string $memberId): JsonResponse
    {
        try {
            $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        } catch (ValidationException) {
            return response()->json(['error' => 'reason is required'], 400);
        }

        [$tribunal, $member, $errorResponse] = $this->findPendingNomination($tribunalId, $memberId);
        if ($errorResponse) {
            return $errorResponse;
        }

        $member->update(['status' => 'withdrawn', 'notes' => "Declined nomination: {$data['reason']}"]);

        AuditService::log(Auth::id(), 'tribunal_member_declined', 'tribunal_member', $member->id, ['reason' => $data['reason']], $request->ip());
        CaseTimelineService::log(
            (int) $tribunal->case_id, 'arbitrator_declined', Auth::id(),
            "{$member->arbitrator->full_name} declined nomination as ".str_replace('_', ' ', $member->role),
            $data['reason'], referenceType: 'tribunal_member', referenceId: (int) $member->id,
        );

        return response()->json(['message' => 'Nomination declined']);
    }

    /**
     * Shared lookup + auth for accept/decline: the nomination must still be
     * pending, and the caller must be either staff or the nominated
     * arbitrator themselves - never a different arbitrator or an unrelated party.
     */
    private function findPendingNomination(string $tribunalId, string $memberId): array
    {
        $tId = Ids::parse($tribunalId);
        $mId = Ids::parse($memberId);
        if ($tId === null || $mId === null) {
            return [null, null, response()->json(['error' => 'Invalid tribunal or member id'], 400)];
        }

        $tribunal = CaseTribunal::with('case')->find($tId);
        $member = TribunalMember::with('arbitrator')->where('tribunal_id', $tId)->find($mId);
        if (! $tribunal || ! $member || $member->status !== 'nominated') {
            return [null, null, response()->json(['error' => 'No pending nomination found'], 404)];
        }

        $user = Auth::user();
        $isNominee = $user->role === 'arbitrator' && (int) $member->arbitrator->user_id === (int) $user->id;
        if (! $this->isStaff() && ! $isNominee) {
            return [null, null, response()->json(['error' => 'Forbidden'], 403)];
        }

        return [$tribunal, $member, null];
    }

    /** True once every seat is filled and every active member has actually accepted - not merely been nominated. */
    private function tryConstitute(CaseTribunal $tribunal, ArbitrationCase $case, bool $wasFirstConstitution): bool
    {
        if (! empty($this->openSeats($tribunal->fresh()))) {
            return false;
        }

        $activeMembers = $tribunal->activeMembers()->get();
        // 'appointed' is kept as equivalent here only for data predating this
        // accept/decline flow, where appointment was recorded as immediately
        // final - no nomination created after this point ever reaches it.
        $allAccepted = $activeMembers->isNotEmpty()
            && $activeMembers->every(fn ($m) => in_array($m->status, ['accepted', 'appointed'], true));
        if (! $allAccepted) {
            return false;
        }

        $tribunal->update(['status' => 'constituted', 'constituted_at' => now()]);
        if ($wasFirstConstitution) {
            $case->update(['status' => 'ongoing', 'due_date' => SlaService::computeDueDate($case->sla_tier, $case->currency)]);
        }

        return true;
    }

    public function withdrawMember(Request $request, string $tribunalId, string $memberId): JsonResponse
    {
        $tId = Ids::parse($tribunalId);
        $mId = Ids::parse($memberId);
        try {
            $data = $request->validate([
                'reason' => ['required', 'string', 'max:500'],
                'status' => ['required', 'in:withdrawn,recused,removed'],
            ]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($tId === null || $mId === null || $data === null) {
            return response()->json(['error' => 'reason and a valid status are required'], 400);
        }

        $tribunal = CaseTribunal::with('case')->find($tId);
        $member = TribunalMember::where('tribunal_id', $tId)->find($mId);
        if (! $tribunal || ! $member || ! $member->isActive()) {
            return response()->json(['error' => 'No active tribunal member found'], 404);
        }

        $case = $tribunal->case;

        DB::transaction(function () use ($tribunal, $member, $data, $case) {
            $member->update(['status' => $data['status'], 'notes' => $data['reason']]);

            \App\Models\Assignment::where('case_id', $case->id)
                ->where('arbitrator_id', $member->arbitrator_id)
                ->where('status', 'ongoing')
                ->update(['status' => 'withdrawn', 'withdrawal_reason' => $data['reason']]);

            if ($tribunal->activeMembers()->count() === 0) {
                $tribunal->update(['status' => 'dissolved', 'dissolved_at' => now()]);
                $case->update(['status' => 'pending_assignment', 'due_date' => null]);
            } else {
                // Panel still has active members - reopen this seat for a replacement.
                $tribunal->update(['status' => 'forming']);
            }
        });

        AuditService::log(Auth::id(), 'tribunal_member_withdrawn', 'tribunal_member', $mId, ['status' => $data['status'], 'reason' => $data['reason']], $request->ip());
        CaseTimelineService::log(
            (int) $case->id, 'arbitrator_'.$data['status'], Auth::id(),
            "{$member->arbitrator->full_name} {$data['status']} from the tribunal",
            $data['reason'], referenceType: 'tribunal_member', referenceId: $mId,
        );

        if ($tribunal->fresh()->status === 'dissolved') {
            CaseTimelineService::statusChanged((int) $case->id, 'ongoing', 'pending_assignment', Auth::id(), $data['reason']);
        }

        return response()->json(['message' => 'Tribunal member '.$data['status']]);
    }

    /**
     * Concludes the case: dissolves the tribunal, completes every active
     * member's assignment, and recalculates every member's score - not
     * just one arbitrator's, since a panel decides collectively.
     */
    public function conclude(Request $request, string $caseId): JsonResponse
    {
        $id = Ids::parse($caseId);
        try {
            $data = $request->validate([
                'outcome' => ['required', 'in:award_issued,settled,withdrawn'],
                'outcomeDetail' => ['nullable', 'string', 'max:5000'],
                'awardChallenged' => ['nullable', 'boolean'],
            ]);
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'A valid outcome is required'], 400);
        }

        $case = ArbitrationCase::find($id);
        if (! $case || $case->status !== 'ongoing') {
            return response()->json(['error' => 'Case is not ongoing'], 400);
        }

        $tribunal = CaseTribunal::where('case_id', $id)->where('status', 'constituted')->with('activeMembers.arbitrator')->first();
        if (! $tribunal) {
            return response()->json(['error' => 'No constituted tribunal found for this case'], 400);
        }

        $user = Auth::user();
        $isOwningArbitrator = $user->role === 'arbitrator'
            && $tribunal->activeMembers->contains(fn ($m) => (int) $m->arbitrator->user_id === (int) $user->id);
        if (! $this->isStaff() && ! $isOwningArbitrator) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $now = now();
        $memberArbitratorIds = $tribunal->activeMembers->pluck('arbitrator_id')->all();

        DB::transaction(function () use ($tribunal, $case, $data, $now, $memberArbitratorIds) {
            \App\Models\Assignment::where('case_id', $case->id)
                ->whereIn('arbitrator_id', $memberArbitratorIds)
                ->where('status', 'ongoing')
                ->update(['status' => 'completed', 'completed_at' => $now]);

            $tribunal->update(['status' => 'dissolved', 'dissolved_at' => $now]);

            $case->update([
                'status' => 'concluded',
                'concluded_at' => $now,
                'outcome' => $data['outcome'],
                'outcome_detail' => $data['outcomeDetail'] ?? null,
                'award_challenged' => $data['awardChallenged'] ?? false,
            ]);
        });

        $scores = [];
        foreach ($memberArbitratorIds as $arbitratorId) {
            $scores[] = ScoringService::recalculate((int) $arbitratorId, $id);
        }

        AuditService::log(Auth::id(), 'case_concluded', 'case', $id, ['outcome' => $data['outcome'], 'memberCount' => count($memberArbitratorIds)], $request->ip());
        CaseTimelineService::statusChanged(
            $id, 'ongoing', 'concluded', Auth::id(),
            eventTitle: 'Case concluded: '.str_replace('_', ' ', $data['outcome']),
        );

        return response()->json(['message' => 'Case concluded', 'scores' => $scores]);
    }
}
