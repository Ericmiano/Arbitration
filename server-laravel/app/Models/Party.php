<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Party extends Model
{
    protected $table = 'parties';
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'type', 'organization_id', 'full_name', 'email', 'phone', 'address'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function cases(): BelongsToMany
    {
        return $this->belongsToMany(ArbitrationCase::class, 'case_parties', 'party_id', 'case_id')
            ->withPivot('role');
    }

    public function conflicts(): HasMany
    {
        return $this->hasMany(ArbitratorConflict::class, 'conflicted_party_id');
    }
}
