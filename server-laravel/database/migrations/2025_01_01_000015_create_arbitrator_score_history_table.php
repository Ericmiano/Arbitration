<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arbitrator_score_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->cascadeOnDelete();
            $table->foreignId('case_id')->nullable()->constrained('cases')->nullOnDelete();
            $table->decimal('score', 5, 2);
            $table->decimal('timeliness_component', 5, 2);
            $table->decimal('outcome_component', 5, 2);
            $table->decimal('workload_component', 5, 2);
            $table->dateTime('calculated_at')->useCurrent();

            $table->index('arbitrator_id', 'idx_score_history_arbitrator');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arbitrator_score_history');
    }
};
