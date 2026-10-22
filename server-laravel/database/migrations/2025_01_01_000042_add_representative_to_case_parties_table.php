<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A party's advocate or authorized representative on this specific case -
 * not a separate reusable directory entry (the same firm may represent
 * different clients differently case to case, and AAK's own intake form
 * only ever asks for one representative per party), just contact info
 * attached to the case_parties row it belongs to.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('case_parties', function (Blueprint $table) {
            $table->string('representative_name')->nullable();
            $table->string('representative_firm')->nullable();
            $table->string('representative_email')->nullable();
            $table->string('representative_phone', 50)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('case_parties', function (Blueprint $table) {
            $table->dropColumn(['representative_name', 'representative_firm', 'representative_email', 'representative_phone']);
        });
    }
};
