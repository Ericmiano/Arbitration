<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    protected $table = 'assignments';

    protected $fillable = [
        'case_id', 'arbitrator_id', 'assigned_by', 'assigned_at', 'due_date',
        'status', 'completed_at', 'withdrawal_reason',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'due_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(AssignmentExtension::class);
    }
}
