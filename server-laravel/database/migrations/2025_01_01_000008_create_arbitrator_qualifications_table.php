<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arbitrator_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->cascadeOnDelete();
            $table->string('qualification', 500);

            $table->index('arbitrator_id', 'idx_arb_qual_arbitrator');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arbitrator_qualifications');
    }
};
