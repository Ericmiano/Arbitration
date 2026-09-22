<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            // Used in download URLs, never the sequential id.
            $table->char('public_id', 36)->unique()->default(DB::raw('(uuid())'));
            $table->foreignId('case_id')->constrained('cases')->restrictOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->enum('document_type', [
                'contract_copy', 'evidence', 'submission_agreement',
                'correspondence', 'award', 'id_kyc', 'other',
            ]);
            $table->enum('visibility', ['staff_arbitrator', 'shared_all_parties', 'uploader_only'])->default('staff_arbitrator');
            $table->string('file_name');
            // Path on disk OUTSIDE the public web root.
            $table->string('storage_path', 500);
            $table->string('mime_type', 150);
            $table->unsignedBigInteger('file_size');
            $table->unsignedInteger('version')->default(1);
            $table->char('checksum_sha256', 64);
            $table->enum('scan_status', ['pending', 'clean', 'infected'])->default('pending');
            $table->timestamp('created_at')->useCurrent();

            $table->index('case_id', 'idx_documents_case');
            $table->index('scan_status', 'idx_documents_scan_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
