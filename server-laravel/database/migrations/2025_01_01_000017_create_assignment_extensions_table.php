<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('requested_at')->useCurrent();
            $table->string('reason', 500);
            $table->date('previous_due_date');
            $table->date('new_due_date');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('decided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->dateTime('decided_at')->nullable();

            $table->index('assignment_id', 'idx_extensions_assignment');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_extensions');
    }
};
