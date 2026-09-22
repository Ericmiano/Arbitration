<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arbitrator_conflicts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('arbitrator_id')->constrained('arbitrators')->cascadeOnDelete();
            $table->foreignId('conflicted_party_id')->nullable()->constrained('parties')->cascadeOnDelete();
            $table->foreignId('conflicted_organization_id')->nullable()->constrained('organizations')->cascadeOnDelete();
            $table->string('reason', 500);
            $table->dateTime('declared_at')->useCurrent();
            $table->date('expires_at')->nullable();

            $table->index('arbitrator_id', 'idx_conflicts_arbitrator');
            $table->index('conflicted_party_id', 'idx_conflicts_party');
            $table->index('conflicted_organization_id', 'idx_conflicts_org');
        });

        // Laravel's Schema Builder has no first-class CHECK constraint helper -
        // added via raw SQL, matching schema.sql's chk_conflict_target exactly.
        DB::statement(
            'ALTER TABLE arbitrator_conflicts ADD CONSTRAINT chk_conflict_target '
            . 'CHECK (conflicted_party_id IS NOT NULL OR conflicted_organization_id IS NOT NULL)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('arbitrator_conflicts');
    }
};
