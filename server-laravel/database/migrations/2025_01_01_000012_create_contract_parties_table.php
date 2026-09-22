<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_parties', function (Blueprint $table) {
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignId('party_id')->constrained('parties')->restrictOnDelete();
            $table->string('role', 100);

            $table->primary(['contract_id', 'party_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_parties');
    }
};
