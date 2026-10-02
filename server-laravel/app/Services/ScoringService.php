<?php

namespace App\Services;

use App\Models\Arbitrator;
use App\Models\ArbitratorScoreHistory;
use App\Models\CaseUpdate;
use Illuminate\Support\Facades\DB;

class ScoringService
{
    private const WEIGHT_RESPONSIVENESS = 0.45;
    private const WEIGHT_OUTCOME = 0.4;
    private const WEIGHT_WORKLOAD = 0.15;

    private const NEUTRAL_BASELINE = 70;
    private const MIN_CASES_FOR_REAL_SCORE = 3;
    private const ROLLING_WINDOW = 10; // most recent N score-history rows feed the displayed score

    /**
     * Recalculates and persists an arbitrator's score after one of their
     * cases closes. $triggeringCaseId is recorded on the
     * arbitrator_score_history row for traceability but the score itself is
     * computed from the arbitrator's full assignment history (bounded to a
     * rolling window - see ROLLING_WINDOW).
     *
     * @return array{score: float, responsivenessScore: float, outcomeScore: float, workloadScore: float}
     */
    public static function recalculate(int $arbitratorId, int $triggeringCaseId): array
    {
        return DB::transaction(fn () => self::doRecalculate($arbitratorId, $triggeringCaseId));
    }

    /**
     * The read-modify-write on cases_closed_count below only ever races two
     * completions of the *same* arbitrator's assignments landing at the
     * exact same instant - rare, but not impossible under concurrent staff
     * actions. lockForUpdate() holds the row for the whole recalculation so
     * a second concurrent call blocks until the first commits, instead of
     * both reading the same starting count and one increment getting lost.
     */
    private static function doRecalculate(int $arbitratorId, int $triggeringCaseId): array
    {
        $arbitrator = Arbitrator::where('id', $arbitratorId)->lockForUpdate()->firstOrFail();

        $allAssignments = $arbitrator->assignments()->with('case:id,outcome,award_challenged')->get();

        $completedAssignments = $allAssignments->filter(fn ($a) => $a->status === 'completed' && $a->completed_at !== null);
        $withdrawnOrReassigned = $allAssignments->filter(fn ($a) => in_array($a->status, ['withdrawn', 'reassigned'], true));

        $responsivenessScore = $completedAssignments->isEmpty()
            ? self::NEUTRAL_BASELINE
            : self::average($completedAssignments->map(fn ($a) => self::responsivenessScoreForAssignment($a))->all());

        $outcomeScore = $completedAssignments->isEmpty()
            ? self::NEUTRAL_BASELINE
            : self::average($completedAssignments->map(fn ($a) => self::outcomeScoreForCase($a->case))->all());

        $settledCount = $completedAssignments->count() + $withdrawnOrReassigned->count();
        $workloadScore = $settledCount === 0 ? 100 : ($completedAssignments->count() / $settledCount) * 100;

        $rawScore = self::WEIGHT_RESPONSIVENESS * $responsivenessScore
            + self::WEIGHT_OUTCOME * $outcomeScore
            + self::WEIGHT_WORKLOAD * $workloadScore;

        $newCasesClosedCount = $arbitrator->cases_closed_count + 1;

        ArbitratorScoreHistory::create([
            'arbitrator_id' => $arbitratorId,
            'case_id' => $triggeringCaseId,
            'score' => self::round2($rawScore),
            'responsiveness_component' => self::round2($responsivenessScore),
            'outcome_component' => self::round2($outcomeScore),
            'workload_component' => self::round2($workloadScore),
        ]);

        $displayedScore = (float) $arbitrator->score;
        if ($newCasesClosedCount >= self::MIN_CASES_FOR_REAL_SCORE) {
            $recentHistory = ArbitratorScoreHistory::where('arbitrator_id', $arbitratorId)
                ->orderByDesc('calculated_at')
                ->take(self::ROLLING_WINDOW)
                ->pluck('score');
            $displayedScore = self::round2(self::average($recentHistory->map(fn ($s) => (float) $s)->all()));
        }

        $arbitrator->update([
            'cases_closed_count' => $newCasesClosedCount,
            'score' => $displayedScore,
            'score_updated_at' => now(),
        ]);

        return [
            'score' => $displayedScore,
            'responsivenessScore' => $responsivenessScore,
            'outcomeScore' => $outcomeScore,
            'workloadScore' => $workloadScore,
        ];
    }

    /**
     * Measures whether the arbitrator kept parties/staff informed while the
     * case was open - not whether the case itself finished quickly, which
     * often depends on factors outside their control (party delays, case
     * complexity). A case that wrapped up within one update cycle needs no
     * update history to judge fairly; a longer case is judged on how close
     * its actual update cadence came to the target.
     */
    private static function responsivenessScoreForAssignment($assignment): float
    {
        if (! $assignment->completed_at) {
            return 100; // shouldn't happen for a "completed" filter, but stay safe
        }

        $targetDays = max(1, (int) config('app.case_update_target_days'));
        $durationDays = $assignment->assigned_at->diffInDays($assignment->completed_at);

        if ($durationDays <= $targetDays) {
            return 100;
        }

        $updateCount = CaseUpdate::where('case_id', $assignment->case_id)
            ->whereBetween('created_at', [$assignment->assigned_at, $assignment->completed_at])
            ->count();

        if ($updateCount === 0) {
            return 30;
        }

        $expectedUpdates = max(1, (int) floor($durationDays / $targetDays));
        $ratio = $updateCount / $expectedUpdates;

        if ($ratio >= 1) {
            return 100;
        }
        if ($ratio >= 0.5) {
            return 70;
        }

        return 40;
    }

    private static function outcomeScoreForCase($case): float
    {
        return match ($case->outcome) {
            'award_issued' => $case->award_challenged ? 40 : 100,
            'settled' => 85,
            'withdrawn' => 60,
            default => 70, // outcome not recorded yet - neutral, shouldn't normally happen at recalculation time
        };
    }

    private static function average(array $values): float
    {
        return count($values) === 0 ? 0 : array_sum($values) / count($values);
    }

    private static function round2(float $value): float
    {
        return round($value, 2);
    }
}
