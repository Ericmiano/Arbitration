<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cases', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 36)->unique()->default(DB::raw('(uuid())'));
            $table->string('case_number', 50)->unique();
            $table->foreignId('project_id')->nullable()->constrained('projects')->restrictOnDelete();
            $table->foreignId('contract_id')->nullable()->constrained('contracts')->restrictOnDelete();
            $table->decimal('dispute_value', 18, 2);
            $table->char('currency', 3)->default('KES');
            $table->string('category', 100);
            $table->text('description');
            $table->enum('basis', ['contractual_clause', 'mutual_agreement']);
            // FK added in a later migration, once the `documents` table exists -
            // matches schema.sql's own circular-reference workaround.
            $table->unsignedBigInteger('submission_agreement_doc_id')->nullable();
            $table->enum('sla_tier', ['simple', 'standard', 'complex']);
            $table->date('due_date')->nullable();
            $table->enum('status', [
                'intake', 'pending_agreement', 'pending_assignment', 'assigned',
                'ongoing', 'concluded', 'closed', 'withdrawn',
            ])->default('intake');
            $table->dateTime('filed_at')->useCurrent();
            $table->dateTime('concluded_at')->nullable();
            $table->enum('outcome', ['award_issued', 'settled', 'withdrawn'])->nullable();
            $table->text('outcome_detail')->nullable();
            $table->boolean('award_challenged')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('status', 'idx_cases_status');
            $table->index('due_date', 'idx_cases_due_date');
            $table->index('project_id', 'idx_cases_project');
            $table->index('contract_id', 'idx_cases_contract');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cases');
    }
};
