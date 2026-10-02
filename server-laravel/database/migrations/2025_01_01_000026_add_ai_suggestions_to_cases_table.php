<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            // Populated by DocumentAiService after scanning an early case
            // document (submission agreement / contract / evidence) - a
            // best-effort suggestion to speed up arbitrator assignment, never
            // authoritative. Null until a scan has run (or if none ever will,
            // e.g. no AI key configured).
            $table->string('ai_suggested_category', 100)->nullable()->after('category');
            $table->json('ai_suggested_specializations')->nullable()->after('ai_suggested_category');
            $table->timestamp('ai_scanned_at')->nullable()->after('ai_suggested_specializations');
        });
    }

    public function down(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->dropColumn(['ai_suggested_category', 'ai_suggested_specializations', 'ai_scanned_at']);
        });
    }
};
