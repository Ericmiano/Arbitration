<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hearings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->restrictOnDelete();
            $table->dateTime('scheduled_at');
            $table->enum('mode', ['in_person', 'virtual'])->default('in_person');
            $table->string('venue_or_link', 500);
            $table->text('agenda')->nullable();
            $table->text('required_documents')->nullable();
            $table->enum('status', ['scheduled', 'completed', 'cancelled', 'postponed'])->default('scheduled');
            $table->foreignId('scheduled_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('case_id', 'idx_hearings_case');
            $table->index('scheduled_at', 'idx_hearings_scheduled_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hearings');
    }
};
