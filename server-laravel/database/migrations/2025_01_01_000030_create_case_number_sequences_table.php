<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backs CaseNumberService with a real atomic counter. The previous
 * approach (COUNT(*) matching cases + 1) was explicitly documented as
 * racy under concurrent intake - two staff submitting at the same instant
 * could compute the same sequence number, and since case_number is unique,
 * the second one would fail outright with a raw SQL error at exactly the
 * highest-traffic moment. A dedicated per-year row, updated inside a
 * transaction with SELECT ... FOR UPDATE, makes this a genuine atomic
 * increment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_number_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('next_sequence')->default(1);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_number_sequences');
    }
};
