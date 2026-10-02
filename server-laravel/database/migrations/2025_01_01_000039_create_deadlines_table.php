<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A general procedural deadline (filing due, evidence due, award due,
 * hearing prep, ...) - deliberately not tied to `assignments`, which keeps
 * its own due_date/assignment_extensions for the arbitrator's overall case
 * deadline exactly as today. deadline_type is a free string for the same
 * reason as case_events.event_type: this vocabulary is expected to grow
 * without needing a migration each time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deadlines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->foreignId('tribunal_member_id')->nullable()->constrained('tribunal_members')->nullOnDelete();
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->string('deadline_type', 100);
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->dateTime('due_at');
            $table->enum('status', ['pending', 'completed', 'waived', 'extended', 'cancelled'])->default('pending');
            $table->dateTime('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index(['case_id', 'status'], 'idx_deadlines_case_status');
            $table->index('due_at', 'idx_deadlines_due_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deadlines');
    }
};
