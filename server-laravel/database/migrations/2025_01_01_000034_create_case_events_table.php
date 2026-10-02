<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The procedural timeline - "what happened, in order" - as distinct from
 * case_updates (an arbitrator's own progress notes) and audit_logs
 * (system/security history keyed by arbitrary entity type). event_type is
 * a plain string, not an enum: this vocabulary will keep growing
 * (case_filed, arbitrator_appointed, filing_submitted, deadline_created,
 * ...) and none of it needs database-level rejection of unknown values
 * the way a real status column does.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->string('event_type', 100);
            $table->dateTime('event_at')->useCurrent();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            // Loose polymorphic pointer (e.g. 'tribunal_member', 'filing',
            // 'document') - same pattern as audit_logs.entity_type/id, not a
            // real FK, since it can point at several different tables.
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->enum('visibility', ['internal', 'all_parties'])->default('internal');
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['case_id', 'event_at'], 'idx_case_events_case_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_events');
    }
};
