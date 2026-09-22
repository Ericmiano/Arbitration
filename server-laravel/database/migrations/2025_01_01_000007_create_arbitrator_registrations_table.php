<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arbitrator_registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->cascadeOnDelete();
            $table->string('body', 150);
            $table->string('registration_number')->nullable();

            $table->index('arbitrator_id', 'idx_arb_reg_arbitrator');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arbitrator_registrations');
    }
};
