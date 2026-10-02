<?php

namespace App\Console\Commands;

use App\Models\Assignment;
use App\Models\CaseUpdate;
use App\Models\User;
use App\Services\NotifyService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Replaces the old date-based "flag overdue" job. A case running long isn't
 * necessarily the arbitrator's fault (party delays, case complexity) - what
 * actually matters is whether they're keeping staff and parties informed.
 * This nudges an arbitrator once their case goes quiet, and separately
 * flags genuinely stale cases (silence for 2x the target cadence) to staff,
 * without touching the arbitrator's score or the assignment's status.
 *
 * Intended to run daily via cPanel Cron Job hitting
 * `php artisan cases:remind-updates` (see routes/console.php for the schedule).
 */
class RemindArbitratorsToPostUpdates extends Command
{
    protected $signature = 'cases:remind-updates';
    protected $description = 'Reminds arbitrators to post a case update once their case has gone quiet, and flags long-silent cases to staff';

    public function handle(): int
    {
        $targetDays = max(1, (int) config('app.case_update_target_days'));
        $now = Carbon::now();

        $ongoingAssignments = Assignment::where('status', 'ongoing')
            ->with(['case:id,case_number', 'arbitrator:id,user_id'])
            ->get();

        $latestUpdateByCase = CaseUpdate::select('case_id', \Illuminate\Support\Facades\DB::raw('MAX(created_at) as latest'))
            ->whereIn('case_id', $ongoingAssignments->pluck('case_id'))
            ->groupBy('case_id')
            ->pluck('latest', 'case_id');

        $registrarStaffIds = User::whereIn('role', ['admin', 'registrar'])->where('status', 'active')->pluck('id')->all();

        $reminded = 0;
        $staffAlerted = 0;

        foreach ($ongoingAssignments as $assignment) {
            $lastActivity = Carbon::parse($latestUpdateByCase[$assignment->case_id] ?? $assignment->assigned_at);
            $daysSince = $lastActivity->diffInDays($now);

            if ($daysSince < $targetDays) {
                continue;
            }

            $this->notifyOnce(
                [$assignment->arbitrator->user_id ?? null],
                'case_update_reminder',
                'assignment',
                (int) $assignment->id,
                "It's been {$daysSince} days since the last update on {$assignment->case->case_number} - please post a progress note.",
            );
            $reminded++;

            if ($daysSince >= $targetDays * 2) {
                $this->notifyOnce(
                    $registrarStaffIds,
                    'case_update_stale',
                    'assignment',
                    (int) $assignment->id,
                    "{$assignment->case->case_number} has had no arbitrator update in {$daysSince} days - may need registrar follow-up.",
                );
                $staffAlerted++;
            }
        }

        $this->info("Scanned {$ongoingAssignments->count()} ongoing assignments: {$reminded} reminders sent, {$staffAlerted} staff alerts sent.");

        return self::SUCCESS;
    }

    /**
     * Same de-dup shape as the old overdue job: skip if an identical
     * notification already went to this user for this assignment within
     * the last day, so the daily cron doesn't spam the same reminder.
     */
    private function notifyOnce(array $userIds, string $type, string $relatedEntityType, int $relatedEntityId, string $message): void
    {
        $since = Carbon::now()->subDay();

        foreach (array_filter($userIds) as $userId) {
            $exists = \App\Models\AppNotification::where('user_id', $userId)
                ->where('type', $type)
                ->where('related_entity_type', $relatedEntityType)
                ->where('related_entity_id', $relatedEntityId)
                ->where('created_at', '>=', $since)
                ->exists();

            if ($exists) {
                continue;
            }

            NotifyService::notifyUsers([$userId], $type, $relatedEntityType, $relatedEntityId, $message);
        }
    }
}
