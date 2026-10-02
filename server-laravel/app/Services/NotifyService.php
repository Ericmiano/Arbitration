<?php

namespace App\Services;

use App\Mail\NotificationMail;
use App\Models\AppNotification;
use App\Models\Assignment;
use App\Models\CaseParty;
use Illuminate\Support\Facades\Mail;

class NotifyService
{
    /**
     * Everyone with a personal stake in a case who might have a portal
     * login: the currently active arbitrator and any parties whose account
     * is linked. Staff aren't included - notifications here are about
     * things staff already know because they triggered them.
     */
    public static function caseParticipantUserIds(int $caseId): array
    {
        $activeAssignment = Assignment::where('case_id', $caseId)
            ->whereIn('status', ['ongoing'])
            ->with('arbitrator:id,user_id')
            ->first();

        $caseParties = CaseParty::where('case_id', $caseId)->with('party:id,user_id')->get();

        $userIds = collect();
        if ($activeAssignment) {
            $userIds->push($activeAssignment->arbitrator->user_id);
        }
        foreach ($caseParties as $cp) {
            if ($cp->party->user_id) {
                $userIds->push($cp->party->user_id);
            }
        }

        return $userIds->unique()->values()->all();
    }

    /**
     * Writes the in-app notification (always) and best-effort emails
     * everyone notified (never lets a mail failure break the action that
     * triggered it - a hearing still gets scheduled even if SMTP is down).
     */
    public static function notifyUsers(array $userIds, string $type, string $relatedEntityType, int $relatedEntityId, string $message): void
    {
        if (empty($userIds)) {
            return;
        }

        $rows = array_map(fn ($userId) => [
            'user_id' => $userId,
            'type' => $type,
            'related_entity_type' => $relatedEntityType,
            'related_entity_id' => $relatedEntityId,
            'message' => $message,
            'created_at' => now(),
        ], $userIds);

        AppNotification::insert($rows);

        $recipients = \App\Models\User::whereIn('id', $userIds)->where('status', 'active')->pluck('email');

        foreach ($recipients as $email) {
            try {
                Mail::to($email)->send(new NotificationMail($type, $message));
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }
}
