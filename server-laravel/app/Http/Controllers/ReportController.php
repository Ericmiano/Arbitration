<?php

namespace App\Http\Controllers;

use App\Models\Arbitrator;
use App\Models\ArbitrationCase;
use App\Models\Assignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function overview(): JsonResponse
    {
        $caseVolumeRaw = DB::select("
            SELECT DATE_FORMAT(filed_at, '%Y-%m') AS month, COUNT(*) AS count
            FROM cases
            WHERE filed_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY month
            ORDER BY month ASC
        ");

        $casesByStatus = ArbitrationCase::select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')->get();

        $avgResolutionRaw = DB::select('
            SELECT AVG(DATEDIFF(concluded_at, filed_at)) AS avgDays
            FROM cases
            WHERE concluded_at IS NOT NULL
        ');

        $now = now();
        $staleCutoff = $now->copy()->subDays((int) config('app.case_update_target_days'));

        $ongoingAssignments = Assignment::where('status', 'ongoing')
            ->with(['case:id,case_number', 'arbitrator:id,full_name'])
            ->get();

        $latestUpdateByCase = \App\Models\CaseUpdate::select('case_id', DB::raw('MAX(created_at) as latest'))
            ->whereIn('case_id', $ongoingAssignments->pluck('case_id'))
            ->groupBy('case_id')
            ->pluck('latest', 'case_id');

        $needsUpdate = $ongoingAssignments->filter(function (Assignment $a) use ($latestUpdateByCase, $staleCutoff) {
            $lastActivity = $latestUpdateByCase[$a->case_id] ?? $a->assigned_at;

            return \Illuminate\Support\Carbon::parse($lastActivity)->lt($staleCutoff);
        })->map(function (Assignment $a) use ($latestUpdateByCase, $now) {
            $lastActivity = \Illuminate\Support\Carbon::parse($latestUpdateByCase[$a->case_id] ?? $a->assigned_at);

            return [
                'assignmentId' => $a->id,
                'caseId' => $a->case_id,
                'caseNumber' => $a->case->case_number,
                'arbitratorId' => $a->arbitrator_id,
                'arbitratorName' => $a->arbitrator->full_name,
                'lastActivityAt' => $lastActivity->toIso8601String(),
                'daysSinceLastUpdate' => (int) floor(($now->timestamp - $lastActivity->timestamp) / 86400),
            ];
        })->values();

        $arbitrators = Arbitrator::select('id', 'full_name', 'score', 'cases_closed_count', 'status', 'joined_at')
            ->with(['assignments' => fn ($q) => $q->where('status', 'ongoing')->select('id', 'arbitrator_id')])
            // No column restriction here: latestOfMany()'s generated join
            // subqueries each produce their own arbitrator_id column, and
            // restricting the outer select list makes MySQL unable to tell
            // them apart ("Column 'arbitrator_id' in field list is
            // ambiguous") once there's enough data to actually hit the join.
            ->with('lastAssignment')
            ->orderBy('full_name')
            ->get();

        return response()->json([
            'generatedAt' => $now->toIso8601String(),
            'caseVolumeByMonth' => array_map(fn ($row) => ['month' => $row->month, 'count' => (int) $row->count], $caseVolumeRaw),
            'casesByStatus' => $casesByStatus->map(fn ($row) => ['status' => $row->status, 'count' => (int) $row->count])->values(),
            'avgResolutionDays' => isset($avgResolutionRaw[0]->avgDays) && $avgResolutionRaw[0]->avgDays !== null
                ? round((float) $avgResolutionRaw[0]->avgDays, 1)
                : null,
            'needsUpdate' => $needsUpdate,
            'arbitratorWorkload' => $arbitrators->map(function (Arbitrator $a) use ($now) {
                $currentlyAssigned = $a->assignments->count() > 0;
                $idleSince = null;
                $idleSinceDays = null;

                if (! $currentlyAssigned) {
                    // Never assigned at all -> idle since they joined;
                    // otherwise idle since their last assignment wrapped up
                    // (completed_at if it has one, else when it was made).
                    $last = $a->lastAssignment;
                    $idleSince = $last
                        ? ($last->completed_at ?? $last->assigned_at)
                        : $a->joined_at;
                    $idleSinceDays = (int) floor(($now->timestamp - $idleSince->timestamp) / 86400);
                }

                return [
                    'id' => $a->id,
                    'fullName' => $a->full_name,
                    'status' => $a->status,
                    'activeCases' => $a->assignments->count(),
                    'casesClosedCount' => $a->cases_closed_count,
                    'score' => $a->score,
                    'currentlyAssigned' => $currentlyAssigned,
                    'idleSince' => $idleSince?->toIso8601String(),
                    'idleSinceDays' => $idleSinceDays,
                ];
            })->values(),
        ]);
    }
}
