<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Same shape as assignment_extensions, generalized to any deadline type. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deadline_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deadline_id')->constrained('deadlines')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('requested_at')->useCurrent();
            $table->dateTime('original_due_at');
            $table->dateTime('requested_due_at');
            $table->enum('decision', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('decided_at')->nullable();
            $table->string('reason', 500);

            $table->index('deadline_id', 'idx_deadline_extensions_deadline');
        });

        DB::statement(
            'ALTER TABLE deadline_extensions ADD CONSTRAINT chk_deadline_extension_pushes_forward '
            .'CHECK (requested_due_at > original_due_at)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('deadline_extensions');
    }
};
