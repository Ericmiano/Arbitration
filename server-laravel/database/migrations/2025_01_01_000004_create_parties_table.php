<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['individual', 'organization']);
            $table->foreignId('organization_id')->nullable()->constrained('organizations')->restrictOnDelete();
            $table->string('full_name');
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('address', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('organization_id', 'idx_parties_org');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parties');
    }
};
