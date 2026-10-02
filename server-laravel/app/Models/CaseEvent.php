<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// The procedural timeline - written exclusively through CaseTimelineService.
class CaseEvent extends Model
{
    protected $table = 'case_events';
    const UPDATED_AT = null;

    protected $fillable = [
        'case_id', 'event_type', 'event_at', 'actor_user_id', 'title',
        'description', 'reference_type', 'reference_id', 'visibility', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'event_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
