<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Every case that already had an arbitrator before the tribunal model
 * existed only has an `assignments` row - no `case_tribunals` /
 * `tribunal_members` row at all. TribunalController::conclude() requires a
 * constituted tribunal to exist, so without this, every one of those cases
 * (226 currently-ongoing ones at the time this was written) could never
 * be concluded again through the app.
 *
 * This isn't fabricating history the way backfilling case_status_history
 * would be (we don't know the real intermediate transition dates for
 * these cases) - it's representing a structural fact we DO know: this
 * arbitrator IS the sole tribunal for this case, appointed on the date
 * their assignment itself already records.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $ongoing = DB::table('assignments')->where('status', 'ongoing')->get();
            $casesAlreadyBackfilled = DB::table('case_tribunals')->pluck('case_id')->all();

            foreach ($ongoing as $assignment) {
                // Idempotent: safe to rerun if an earlier attempt partially
                // completed (e.g. hit bad data partway through) - never
                // double-backfills a case that already has a tribunal.
                if (in_array($assignment->case_id, $casesAlreadyBackfilled, true)) {
                    continue;
                }

                $tribunalId = DB::table('case_tribunals')->insertGetId([
                    'case_id' => $assignment->case_id,
                    'tribunal_type' => 'sole',
                    'status' => 'constituted',
                    'constituted_at' => $assignment->assigned_at,
                    'created_at' => $assignment->assigned_at,
                    'updated_at' => now(),
                ]);

                DB::table('tribunal_members')->insert([
                    'tribunal_id' => $tribunalId,
                    'arbitrator_id' => $assignment->arbitrator_id,
                    'role' => 'sole_arbitrator',
                    'appointed_by' => $assignment->assigned_by,
                    'appointed_at' => $assignment->assigned_at,
                    'accepted_at' => $assignment->assigned_at,
                    'status' => 'appointed',
                    'created_at' => $assignment->assigned_at,
                    'updated_at' => now(),
                ]);

                $casesAlreadyBackfilled[] = $assignment->case_id;
            }
        });
    }

    public function down(): void
    {
        // Deliberately irreversible - there is no way to tell a backfilled
        // tribunal apart from one created through the app after this point.
    }
};
