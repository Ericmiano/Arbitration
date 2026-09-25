<?php

namespace App\Services;

use App\Models\Arbitrator;
use App\Models\Party;
use App\Models\User;

class UserProfileService
{
    /**
     * The display name for a user depends on role: arbitrators and parties
     * already have a full_name on their own table (set at onboarding/intake),
     * so we show that rather than users.full_name, which only really applies
     * to staff/admin/registrar accounts that have no other profile record.
     */
    public static function resolveDisplayName(int $userId, string $role, string $fallbackEmail): string
    {
        if ($role === 'arbitrator') {
            $arbitrator = Arbitrator::where('user_id', $userId)->first();
            if ($arbitrator) {
                return $arbitrator->full_name;
            }
        }

        if ($role === 'party') {
            $party = Party::where('user_id', $userId)->first();
            if ($party) {
                return $party->full_name;
            }
        }

        $user = User::find($userId);

        return $user?->full_name ?? $fallbackEmail;
    }
}
