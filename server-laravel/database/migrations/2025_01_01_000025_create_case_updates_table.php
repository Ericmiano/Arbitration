<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The arbitrator's periodic progress notes on an ongoing case - what
// replaces automatic date-based "overdue" flagging. A case that's taking
// long for reasons outside the arbitrator's control (a slow party, complex
// evidence) still looks healthy here as long as they're posting updates;
// silence, not lateness, is the actual signal staff and parties care about.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->foreignId('posted_by')->constrained('users')->restrictOnDelete();
            $table->text('note');
            $table->timestamp('created_at')->useCurrent();

            $table->index('case_id', 'idx_case_updates_case');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_updates');
    }
};
