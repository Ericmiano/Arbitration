<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Arbitrator extends Model
{
    protected $table = 'arbitrators';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'full_name', 'aak_membership_no', 'current_position', 'current_organization',
        'aak_chapter', 'years_of_practice', 'phone', 'bio', 'adr_experience_notes',
        'status', 'score', 'cases_closed_count', 'score_updated_at', 'joined_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'score_updated_at' => 'datetime',
            'joined_at' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function specializations(): HasMany
    {
        return $this->hasMany(ArbitratorSpecialization::class);
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(ArbitratorRegistration::class);
    }

    public function qualifications(): HasMany
    {
        return $this->hasMany(ArbitratorQualification::class);
    }

    public function conflicts(): HasMany
    {
        return $this->hasMany(ArbitratorConflict::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function scoreHistory(): HasMany
    {
        return $this->hasMany(ArbitratorScoreHistory::class);
    }
}
