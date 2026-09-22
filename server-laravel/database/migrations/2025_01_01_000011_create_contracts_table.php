<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->restrictOnDelete();
            $table->string('reference_number', 150)->nullable();
            $table->date('execution_date')->nullable();
            $table->decimal('value', 18, 2)->nullable();
            $table->char('currency', 3)->default('KES');
            $table->boolean('has_arbitration_clause')->default(false);
            $table->text('arbitration_clause_text')->nullable();
            $table->string('governing_law', 150)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('project_id', 'idx_contracts_project');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
