<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Superseded versions of a document. The live `documents` row always
 * stays the *current* version (so public_id-based links/shares never
 * break); uploading a new version archives the row's current file info
 * here first, then overwrites it in place with the new file.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('storage_path', 500);
            $table->char('checksum_sha256', 64);
            $table->unsignedBigInteger('file_size');
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('uploaded_at');
            $table->string('change_reason', 500)->nullable();

            $table->unique(['document_id', 'version_number'], 'uq_document_versions_document_version');
        });

        DB::statement('ALTER TABLE document_versions ADD CONSTRAINT chk_document_versions_file_size CHECK (file_size > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
    }
};
