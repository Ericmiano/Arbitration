<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class CaseNumberService
{
    /**
     * Generates the next case number for the current year, e.g. AAK/ARB/2026/0001.
     *
     * Backed by a dedicated per-year counter row (case_number_sequences),
     * incremented atomically under a row lock - the previous approach
     * (COUNT(*) matching cases + 1) could hand out the same number twice
     * under concurrent intake, which - since case_number is unique - meant
     * the second submitter got a raw database error instead of a case
     * number, right at the highest-traffic moment.
     */
    public static function generate(): string
    {
        $year = (int) date('Y');

        return DB::transaction(function () use ($year) {
            // Idempotent "create row if it doesn't exist yet" - safe even if
            // two transactions race to create the first-ever row for a new
            // year, since the second INSERT just no-ops instead of erroring.
            DB::statement(
                'INSERT INTO case_number_sequences (year, next_sequence) VALUES (?, 1) '
                .'ON DUPLICATE KEY UPDATE year = year',
                [$year]
            );

            // Locks this year's row for the rest of the transaction - any
            // concurrent caller blocks here until this one commits, so two
            // requests can never read the same next_sequence value.
            $sequence = DB::table('case_number_sequences')
                ->where('year', $year)
                ->lockForUpdate()
                ->value('next_sequence');

            DB::table('case_number_sequences')->where('year', $year)->increment('next_sequence');

            return sprintf('AAK/ARB/%d/%04d', $year, $sequence);
        });
    }
}
