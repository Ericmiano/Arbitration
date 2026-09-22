<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arbitrators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->string('full_name');
            $table->string('aak_membership_no', 50)->nullable();
            $table->string('current_position')->nullable();
            $table->string('current_organization')->nullable();
            $table->string('aak_chapter', 150)->nullable();
            $table->unsignedSmallInteger('years_of_practice')->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('bio')->nullable();
            $table->text('adr_experience_notes')->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->decimal('score', 5, 2)->default(70.00);
            $table->unsignedInteger('cases_closed_count')->default(0);
            $table->dateTime('score_updated_at')->nullable();
            $table->date('joined_at');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arbitrators');
    }
};
