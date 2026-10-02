<?php

namespace App\Services;

use App\Models\Arbitrator;
use App\Models\ArbitrationCase;
use App\Models\User;

class CaseAccessService
{
    private const STAFF_ROLES = ['admin', 'registrar', 'staff'];

    /** Whether the session user has any visibility into this case at all. */
    public static function canAccess(int $caseId, User $user): bool
    {
        if (in_array($user->role, self::STAFF_ROLES, true)) {
            return true;
        }

        if ($user->role === 'arbitrator') {
            $arbitrator = Arbitrator::where('user_id', $user->id)->first();
            if (! $arbitrator) {
                return false;
            }

            return $arbitrator->assignments()->where('case_id', $caseId)->exists();
        }

        // role === 'party'
        return $user->party?->cases()->where('cases.id', $caseId)->exists() ?? false;
    }

    /** Every case id the session user has any visibility into - used by cross-case list views (documents, hearings). */
    public static function accessibleCaseIds(User $user): array
    {
        if (in_array($user->role, self::STAFF_ROLES, true)) {
            return ArbitrationCase::pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        if ($user->role === 'arbitrator') {
            $arbitrator = Arbitrator::where('user_id', $user->id)->first();
            if (! $arbitrator) {
                return [];
            }

            return $arbitrator->assignments()->pluck('case_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        }

        // role === 'party'
        $party = $user->party;
        if (! $party) {
            return [];
        }

        return $party->cases()->pluck('cases.id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }
}
