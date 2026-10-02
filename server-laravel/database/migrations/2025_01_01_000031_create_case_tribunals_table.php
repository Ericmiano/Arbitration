<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A case's tribunal - the actual body deciding the dispute, as distinct
 * from `assignments` (kept as-is, the administrative workload/scoring
 * record). One case can have several of these over time if a sole
 * arbitrator withdraws and a new tribunal is constituted afterward, but
 * only one is ever active (status != dissolved) at once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_tribunals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->restrictOnDelete();
            $table->enum('tribunal_type', ['sole', 'panel']);
            $table->enum('status', ['forming', 'constituted', 'dissolved'])->default('forming');
            $table->dateTime('constituted_at')->nullable();
            $table->dateTime('dissolved_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index(['case_id', 'status'], 'idx_tribunals_case_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_tribunals');
    }
};
