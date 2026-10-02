<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One arbitrator's seat on a tribunal. This - not `assignments` - is the
 * legal/procedural record of who actually sat on a case and in what
 * capacity; `assignments` keeps recording the same appointment for
 * scoring/workload purposes, unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tribunal_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tribunal_id')->constrained('case_tribunals')->cascadeOnDelete();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->restrictOnDelete();
            $table->enum('role', ['sole_arbitrator', 'co_arbitrator', 'chairperson']);
            $table->foreignId('appointed_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('appointed_at')->useCurrent();
            $table->dateTime('accepted_at')->nullable();
            $table->enum('status', [
                'nominated', 'appointed', 'accepted', 'challenged', 'recused', 'withdrawn', 'removed', 'replaced',
            ])->default('appointed');
            // Points at the seat this member filled, when they're a
            // replacement - lets a tribunal's full membership history for
            // one seat be traced across withdrawals/replacements.
            $table->foreignId('replaced_member_id')->nullable()->constrained('tribunal_members')->nullOnDelete();
            $table->string('notes', 1000)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index(['tribunal_id', 'status'], 'idx_tribunal_members_tribunal_status');
            $table->index('arbitrator_id', 'idx_tribunal_members_arbitrator');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tribunal_members');
    }
};
