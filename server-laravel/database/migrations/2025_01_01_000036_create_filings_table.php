<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A formal procedural submission (e.g. "Respondent's Statement of
 * Defence") as its own object, distinct from the documents making it up -
 * a filing groups a main document with its exhibits via filing_documents.
 * Optional: plain /documents uploads (ID/KYC, correspondence) keep
 * working completely unchanged for anything that isn't a formal filing.
 *
 * party_id points straight at `parties`, not at the case_parties pivot -
 * case_parties has no surrogate id (composite PK on case_id+party_id), and
 * this table already carries case_id, so (case_id, party_id) already
 * uniquely identifies the same participation without needing one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('filings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignId('submitted_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('filing_type', 100);
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->dateTime('submitted_at')->useCurrent();
            $table->enum('status', ['submitted', 'accepted', 'rejected'])->default('submitted');
            $table->dateTime('accepted_at')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('rejected_at')->nullable();
            $table->string('rejection_reason', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('case_id', 'idx_filings_case');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('filings');
    }
};
