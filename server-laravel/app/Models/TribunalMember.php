<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TribunalMember extends Model
{
    protected $table = 'tribunal_members';

    protected $fillable = [
        'tribunal_id', 'arbitrator_id', 'role', 'appointed_by', 'appointed_at',
        'accepted_at', 'status', 'replaced_member_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'appointed_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function tribunal(): BelongsTo
    {
        return $this->belongsTo(CaseTribunal::class, 'tribunal_id');
    }

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }

    public function appointedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'appointed_by');
    }

    public function replacedMember(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaced_member_id');
    }

    /** The member who took over this seat after this one withdrew/recused/was removed, if any. */
    public function replacement(): HasOne
    {
        return $this->hasOne(self::class, 'replaced_member_id');
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['nominated', 'appointed', 'accepted'], true);
    }
}
