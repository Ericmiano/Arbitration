<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CaseTribunal extends Model
{
    protected $table = 'case_tribunals';

    protected $fillable = ['case_id', 'tribunal_type', 'status', 'constituted_at', 'dissolved_at'];

    protected function casts(): array
    {
        return [
            'constituted_at' => 'datetime',
            'dissolved_at' => 'datetime',
        ];
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(TribunalMember::class, 'tribunal_id');
    }

    public function activeMembers(): HasMany
    {
        return $this->hasMany(TribunalMember::class, 'tribunal_id')
            ->whereIn('status', ['nominated', 'appointed', 'accepted']);
    }

    /** How many seats this tribunal type has - 1 for sole, 3 for a panel. */
    public function seatCount(): int
    {
        return $this->tribunal_type === 'panel' ? 3 : 1;
    }
}
