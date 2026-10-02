<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeadlineExtension extends Model
{
    protected $table = 'deadline_extensions';
    public $timestamps = false; // uses requested_at/decided_at instead of created_at/updated_at

    protected $fillable = [
        'deadline_id', 'requested_by', 'requested_at', 'original_due_at',
        'requested_due_at', 'decision', 'decided_by', 'decided_at', 'reason',
    ];

    protected function casts(): array
    {
        return [
            'requested_at' => 'datetime',
            'original_due_at' => 'datetime',
            'requested_due_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function deadline(): BelongsTo
    {
        return $this->belongsTo(Deadline::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
