<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 36)->unique()->default(DB::raw('(uuid())'));
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('full_name')->nullable();
            $table->enum('role', ['admin', 'registrar', 'staff', 'arbitrator', 'party']);
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->string('mfa_secret')->nullable();
            $table->boolean('mfa_enabled')->default(false);
            $table->unsignedSmallInteger('failed_login_count')->default(0);
            $table->dateTime('locked_until')->nullable();
            $table->dateTime('last_login_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
