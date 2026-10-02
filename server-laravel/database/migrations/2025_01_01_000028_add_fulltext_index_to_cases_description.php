<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Case search (CaseController::applySearch) matched `description` with a
 * leading-wildcard LIKE ('%term%'), which can never use a B-tree index -
 * every search was a full table scan of every case's free-text
 * description. A FULLTEXT index lets MySQL search it directly instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->fullText('description', 'ft_cases_description');
        });
    }

    public function down(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->dropFullText('ft_cases_description');
        });
    }
};
