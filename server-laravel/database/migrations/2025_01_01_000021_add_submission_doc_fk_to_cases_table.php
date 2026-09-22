<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Circular reference: cases.submission_agreement_doc_id -> documents, but
// documents.case_id -> cases. The column was created earlier; the
// constraint can only be added now that `documents` exists - same
// workaround schema.sql uses.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->foreign('submission_agreement_doc_id', 'fk_cases_submission_doc')
                ->references('id')->on('documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->dropForeign('fk_cases_submission_doc');
        });
    }
};
