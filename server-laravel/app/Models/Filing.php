<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Filing extends Model
{
    protected $table = 'filings';

    protected $fillable = [
        'case_id', 'party_id', 'submitted_by_user_id', 'filing_type', 'title', 'description',
        'submitted_at', 'status', 'accepted_at', 'accepted_by', 'rejected_at', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'accepted_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'filing_documents')
            ->withPivot('document_role', 'sort_order')
            ->orderBy('filing_documents.sort_order');
    }
}
