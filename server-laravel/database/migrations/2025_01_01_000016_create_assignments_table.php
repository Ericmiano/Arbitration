<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->restrictOnDelete();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->restrictOnDelete();
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('assigned_at')->useCurrent();
            // Copy of case.due_date at assignment time; extensions update this copy.
            $table->date('due_date');
            $table->enum('status', ['ongoing', 'completed', 'overdue', 'escalated', 'withdrawn', 'reassigned'])->default('ongoing');
            $table->dateTime('completed_at')->nullable();
            $table->string('withdrawal_reason', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('arbitrator_id', 'idx_assignments_arbitrator');
            $table->index('case_id', 'idx_assignments_case');
            $table->index('status', 'idx_assignments_status');
            $table->index('due_date', 'idx_assignments_due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
