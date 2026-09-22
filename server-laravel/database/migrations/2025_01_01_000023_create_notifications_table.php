<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // 'case_approaching_due', 'case_overdue', 'case_escalated', 'hearing_scheduled', etc.
            $table->string('type', 100);
            $table->string('related_entity_type', 50);
            $table->unsignedBigInteger('related_entity_id');
            $table->string('message', 500);
            $table->dateTime('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'read_at'], 'idx_notifications_user_unread');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
