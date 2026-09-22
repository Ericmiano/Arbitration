<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Append-only: application code must never update or delete rows here.
class AuditLog extends Model
{
    protected $table = 'audit_logs';
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'action', 'entity_type', 'entity_id', 'metadata', 'ip_address'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
