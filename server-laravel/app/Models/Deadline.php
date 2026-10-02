<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Deadline extends Model
{
    protected $table = 'deadlines';

    protected $fillable = [
        'case_id', 'tribunal_member_id', 'party_id', 'deadline_type', 'title', 'description',
        'due_at', 'status', 'completed_at', 'completed_by', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function tribunalMember(): BelongsTo
    {
        return $this->belongsTo(TribunalMember::class);
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(DeadlineExtension::class);
    }
}
