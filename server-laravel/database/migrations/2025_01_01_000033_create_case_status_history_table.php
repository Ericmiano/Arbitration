<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every transition a case's status has ever made - `cases.status` only
 * ever shows where a case is now, not who moved it there, when, or why.
 * Written exclusively through CaseTimelineService::statusChanged(), never
 * directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            // Null only for a case's very first row (no prior status to record).
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            // Null for a system/scheduled-job-triggered transition.
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 500)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('case_id', 'idx_status_history_case');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_status_history');
    }
};
