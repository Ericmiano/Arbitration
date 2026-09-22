<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arbitrator_specializations', function (Blueprint $table) {
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->cascadeOnDelete();
            $table->string('specialization', 150);

            $table->primary(['arbitrator_id', 'specialization']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arbitrator_specializations');
    }
};
