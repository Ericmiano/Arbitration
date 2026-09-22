<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_shares', function (Blueprint $table) {
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->foreignId('party_id')->constrained('parties')->cascadeOnDelete();
            $table->foreignId('granted_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('granted_at')->useCurrent();

            $table->primary(['document_id', 'party_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_shares');
    }
};
