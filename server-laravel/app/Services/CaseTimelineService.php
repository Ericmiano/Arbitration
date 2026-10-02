<?php

namespace App\Services;

use App\Models\CaseEvent;
use App\Models\CaseStatusHistory;

/**
 * The single place every status transition and procedural moment gets
 * recorded - callers should never write to case_status_history or
 * case_events directly. Two related but distinct records, per the DB
 * design: case_status_history is the strict, structured state-machine
 * record ("who moved this to ongoing, when, why"); case_events is the
 * narrative timeline a case detail screen renders ("what happened, in
 * order") - a status change produces one row in each, since both are true
 * at once, but not every case_events row is a status change (a tribunal
 * appointment or a cleared conflict check is procedurally significant
 * without ever touching cases.status).
 */
class CaseTimelineService
{
    /**
     * $eventTitle lets a caller give the timeline a more specific line
     * ("Case filed", "Submission agreement confirmed") than the generic
     * "status changed to X" - the structured before/after is always
     * recorded in case_status_history either way.
     */
    public static function statusChanged(
        int $caseId,
        ?string $from,
        string $to,
        ?int $userId,
        ?string $reason = null,
        ?string $eventTitle = null,
    ): void {
        CaseStatusHistory::create([
            'case_id' => $caseId,
            'from_status' => $from,
            'to_status' => $to,
            'changed_by_user_id' => $userId,
            'reason' => $reason,
        ]);

        self::log(
            $caseId,
            "case_status_{$to}",
            $userId,
            $eventTitle ?? self::humanizeStatus($to),
            $reason,
        );
    }

    public static function log(
        int $caseId,
        string $eventType,
        ?int $actorUserId,
        string $title,
        ?string $description = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?array $metadata = null,
    ): void {
        CaseEvent::create([
            'case_id' => $caseId,
            'event_type' => $eventType,
            'actor_user_id' => $actorUserId,
            'title' => $title,
            'description' => $description,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'metadata' => $metadata,
        ]);
    }

    private static function humanizeStatus(string $status): string
    {
        return 'Case status changed to '.str_replace('_', ' ', $status);
    }
}
