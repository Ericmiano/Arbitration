<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A defensible record that a specific arbitrator was checked against a
 * specific case, not just that they hold a standing conflict record
 * somewhere (arbitrator_conflicts). Written once per (case, arbitrator)
 * appointment decision - not for every arbitrator eligibility-list render,
 * which would flood this table with checks nobody acted on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_conflict_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->restrictOnDelete();
            $table->dateTime('checked_at')->useCurrent();
            $table->foreignId('checked_by')->constrained('users')->restrictOnDelete();
            $table->enum('result', ['cleared', 'potential_conflict', 'confirmed_conflict']);
            $table->text('disclosure')->nullable();
            $table->text('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->string('notes', 1000)->nullable();

            $table->index(['case_id', 'arbitrator_id'], 'idx_conflict_checks_case_arbitrator');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_conflict_checks');
    }
};
