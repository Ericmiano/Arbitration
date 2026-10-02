<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the case-search pattern (see the fulltext-on-description
 * migration) to the other two tables that stood to grow large and had no
 * real search at all: parties (434 rows already, from just one AAK import)
 * and documents (unbounded - grows with every case). Arbitrators stays a
 * small reference table by nature (a panel doesn't run into the thousands),
 * but it's included too since a plain LIKE '%term%' couldn't use an index
 * either way, and the free-text fields (bio, notes) are exactly what
 * fulltext is for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('arbitrators', function (Blueprint $table) {
            $table->fullText(['full_name', 'current_position', 'bio', 'adr_experience_notes'], 'ft_arbitrators_search');
        });

        Schema::table('parties', function (Blueprint $table) {
            $table->fullText('full_name', 'ft_parties_full_name');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->fullText('file_name', 'ft_documents_file_name');
        });
    }

    public function down(): void
    {
        Schema::table('arbitrators', function (Blueprint $table) {
            $table->dropFullText('ft_arbitrators_search');
        });
        Schema::table('parties', function (Blueprint $table) {
            $table->dropFullText('ft_parties_full_name');
        });
        Schema::table('documents', function (Blueprint $table) {
            $table->dropFullText('ft_documents_file_name');
        });
    }
};
