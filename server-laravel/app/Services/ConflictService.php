<?php

namespace App\Services;

use App\Models\ArbitratorConflict;
use App\Models\CaseParty;
use Illuminate\Support\Carbon;

class ConflictService
{
    /**
     * Checks an arbitrator against a case's parties/organizations.
     *  - declaredConflicts: the arbitrator (or staff) explicitly declared
     *    this party/org as a conflict - this blocks assignment outright.
     *  - priorEngagements: the arbitrator has arbitrated a case involving one
     *    of these parties before - NOT a block, just a signal for staff to
     *    review, since name/party matches alone aren't reliable enough to
     *    auto-exclude.
     *
     * @return array{blocked: bool, declaredConflicts: array, priorEngagements: array}
     */
    public static function check(int $arbitratorId, int $caseId): array
    {
        $caseParties = CaseParty::where('case_id', $caseId)->with('party:id,organization_id')->get();

        $partyIds = $caseParties->pluck('party.id')->all();
        $organizationIds = $caseParties->pluck('party.organization_id')->filter()->all();

        $declared = ArbitratorConflict::where('arbitrator_id', $arbitratorId)
            ->where(function ($query) use ($partyIds, $organizationIds) {
                $query->whereIn('conflicted_party_id', $partyIds)
                    ->orWhereIn('conflicted_organization_id', $organizationIds);
            })
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', Carbon::today());
            })
            ->get();

        $priorCaseParties = CaseParty::whereIn('party_id', $partyIds)
            ->where('case_id', '!=', $caseId)
            ->whereHas('case.assignments', fn ($q) => $q->where('arbitrator_id', $arbitratorId))
            ->with('case:id,case_number')
            ->get();

        return [
            'blocked' => $declared->isNotEmpty(),
            'declaredConflicts' => $declared->map(fn (ArbitratorConflict $c) => [
                'reason' => $c->reason,
                'partyId' => $c->conflicted_party_id,
                'organizationId' => $c->conflicted_organization_id,
            ])->values()->all(),
            'priorEngagements' => $priorCaseParties->map(fn (CaseParty $cp) => [
                'caseId' => $cp->case->id,
                'caseNumber' => $cp->case->case_number,
                'partyId' => $cp->party_id,
            ])->values()->all(),
        ];
    }
}
