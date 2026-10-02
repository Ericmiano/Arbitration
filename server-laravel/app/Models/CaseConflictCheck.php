<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseConflictCheck extends Model
{
    protected $table = 'case_conflict_checks';
    public $timestamps = false; // uses checked_at instead of created_at/updated_at

    protected $fillable = [
        'case_id', 'arbitrator_id', 'checked_at', 'checked_by', 'result',
        'disclosure', 'resolution', 'resolved_by', 'resolved_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'checked_at' => 'datetime',
            'resolved_at' => 'datetime',
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

    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
