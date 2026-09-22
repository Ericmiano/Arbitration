<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentExtension extends Model
{
    protected $table = 'assignment_extensions';
    public $timestamps = false;

    protected $fillable = [
        'assignment_id', 'requested_by', 'requested_at', 'reason',
        'previous_due_date', 'new_due_date', 'status', 'decided_by', 'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'requested_at' => 'datetime',
            'previous_due_date' => 'date',
            'new_due_date' => 'date',
            'decided_at' => 'datetime',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
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
