<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('filing_documents', function (Blueprint $table) {
            $table->foreignId('filing_id')->constrained('filings')->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('documents')->restrictOnDelete();
            // e.g. "main", "exhibit" - free text, not an enum: this is a
            // display/grouping label, not a state machine.
            $table->string('document_role', 50)->nullable();
            $table->unsignedInteger('sort_order')->default(0);

            $table->primary(['filing_id', 'document_id']);
            $table->index('document_id', 'idx_filing_documents_document');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('filing_documents');
    }
};
