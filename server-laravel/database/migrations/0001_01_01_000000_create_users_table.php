<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Renamed in intent (kept the original filename/timestamp so it still runs
// first): only the `sessions` table now - the AAK schema defines its own
// `users` and `password_reset_tokens` tables further down, since our design
// (role enum, MFA columns, lockout tracking, a hashed-token reset flow)
// doesn't match Laravel's defaults.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
