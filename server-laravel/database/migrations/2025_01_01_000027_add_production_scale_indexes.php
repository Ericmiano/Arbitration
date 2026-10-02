<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for query patterns that exist in the application today but were
 * missing a covering index - each one below is tied to a real query, not
 * speculative. At the row counts this system runs at today none of these
 * are urgent, but they're cheap to add now and get more valuable as the
 * panel and case register grow (especially once other AAK-like bodies are
 * onboarded onto the same install).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Every case listing defaults to ORDER BY filed_at DESC
        // (CaseController::index), and the reports overview's
        // caseVolumeByMonth filters on it directly.
        Schema::table('cases', function (Blueprint $table) {
            $table->index('filed_at', 'idx_cases_filed_at');
            // Backs ArbitratorController::index's caseCategory filter
            // (whereHas('assignments.case', fn ($q) => $q->where('category', ...))).
            $table->index('category', 'idx_cases_category');
        });

        // The active-pool query (Arbitrator::where('status', 'active')
        // ->orderByDesc('score')) is the single most-hit arbitrator query in
        // the app - ArbitratorController::eligible, ::index's default sort.
        Schema::table('arbitrators', function (Blueprint $table) {
            $table->index(['status', 'score'], 'idx_arbitrators_status_score');
        });

        // ArbitratorController::index and ReportController::overview both
        // filter an arbitrator's assignments by status - a composite index
        // lets that resolve without touching the case_id-ordered rows.
        Schema::table('assignments', function (Blueprint $table) {
            $table->index(['arbitrator_id', 'status'], 'idx_assignments_arbitrator_status');
        });

        // RemindArbitratorsToPostUpdates and UserController::index filter
        // staff accounts by role + status together.
        Schema::table('users', function (Blueprint $table) {
            $table->index(['role', 'status'], 'idx_users_role_status');
        });

        // Every party-role request resolves the session user to their
        // parties row via Party::where('user_id', ...) - CaseAccessService,
        // ArbitratorController::eligible, DocumentController::canView all
        // hit this on effectively every request a party account makes, and
        // it had no index at all.
        Schema::table('parties', function (Blueprint $table) {
            $table->index('user_id', 'idx_parties_user');
        });

        // Notifications grow without bound (nothing prunes them) - an
        // eventual retention job needs this to find old rows without a
        // full scan.
        Schema::table('notifications', function (Blueprint $table) {
            $table->index('created_at', 'idx_notifications_created_at');
        });
    }

    public function down(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->dropIndex('idx_cases_filed_at');
            $table->dropIndex('idx_cases_category');
        });
        Schema::table('arbitrators', function (Blueprint $table) {
            $table->dropIndex('idx_arbitrators_status_score');
        });
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropIndex('idx_assignments_arbitrator_status');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_role_status');
        });
        Schema::table('parties', function (Blueprint $table) {
            $table->dropIndex('idx_parties_user');
        });
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('idx_notifications_created_at');
        });
    }
};
