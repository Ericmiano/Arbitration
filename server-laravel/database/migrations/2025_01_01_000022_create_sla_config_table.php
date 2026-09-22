<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_config', function (Blueprint $table) {
            $table->id();
            $table->enum('tier', ['simple', 'standard', 'complex']);
            $table->char('currency', 3)->default('KES');
            $table->decimal('min_value', 18, 2);
            // NULL = no upper bound.
            $table->decimal('max_value', 18, 2)->nullable();
            $table->unsignedSmallInteger('target_days');
            $table->decimal('approaching_days_before', 5, 2)->default(14);
            $table->decimal('escalation_days_after', 5, 2)->default(30);

            $table->unique(['tier', 'currency'], 'uq_sla_tier_currency');
        });

        // Kept data-driven rather than hardcoded in application code - matches
        // the defaults seeded by schema.sql.
        DB::table('sla_config')->insert([
            ['tier' => 'simple', 'currency' => 'KES', 'min_value' => 0, 'max_value' => 5000000, 'target_days' => 60],
            ['tier' => 'standard', 'currency' => 'KES', 'min_value' => 5000000, 'max_value' => 50000000, 'target_days' => 100],
            ['tier' => 'complex', 'currency' => 'KES', 'min_value' => 50000000, 'max_value' => null, 'target_days' => 180],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_config');
    }
};
