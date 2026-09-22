<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Named ArbitrationCase, not Case - `case` is a reserved word in PHP
// (switch statements, enums). Maps to the `cases` table.
class ArbitrationCase extends Model
{
    protected $table = 'cases';

    protected $fillable = [
        'project_id', 'contract_id', 'dispute_value', 'currency', 'category', 'description',
        'basis', 'submission_agreement_doc_id', 'sla_tier', 'due_date', 'status', 'filed_at',
        'concluded_at', 'outcome', 'outcome_detail', 'award_challenged', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'dispute_value' => 'decimal:2',
            'due_date' => 'date',
            'filed_at' => 'datetime',
            'concluded_at' => 'datetime',
            'award_challenged' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function submissionAgreementDocument(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'submission_agreement_doc_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function parties(): BelongsToMany
    {
        return $this->belongsToMany(Party::class, 'case_parties', 'case_id', 'party_id')->withPivot('role');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'case_id');
    }

    public function hearings(): HasMany
    {
        return $this->hasMany(Hearing::class, 'case_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'case_id');
    }

    public function scoreHistory(): HasMany
    {
        return $this->hasMany(ArbitratorScoreHistory::class, 'case_id');
    }

    /** The currently active (non withdrawn/reassigned) assignment, if any. */
    public function activeAssignment(): HasMany
    {
        return $this->hasMany(Assignment::class, 'case_id')
            ->whereIn('status', ['ongoing', 'overdue', 'escalated', 'completed'])
            ->latest('assigned_at');
    }
}
