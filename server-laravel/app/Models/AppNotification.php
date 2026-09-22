<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Named AppNotification, not Notification - avoids shadowing Laravel's own
// Illuminate\Notifications\Notification concept. Maps to the `notifications` table.
class AppNotification extends Model
{
    protected $table = 'notifications';
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'type', 'related_entity_type', 'related_entity_id', 'message', 'read_at'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
