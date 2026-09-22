<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_parties', function (Blueprint $table) {
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->foreignId('party_id')->constrained('parties')->restrictOnDelete();
            $table->enum('role', ['claimant', 'respondent', 'other']);

            $table->primary(['case_id', 'party_id']);
            $table->index('party_id', 'idx_caseparties_party');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_parties');
    }
};
