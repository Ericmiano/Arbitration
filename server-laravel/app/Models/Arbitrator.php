<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class Arbitrator extends Model
{
    protected $table = 'arbitrators';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'full_name', 'aak_membership_no', 'current_position', 'current_organization',
        'aak_chapter', 'years_of_practice', 'phone', 'bio', 'adr_experience_notes',
        'status', 'score', 'cases_closed_count', 'score_updated_at', 'joined_at',
    ];

    // yearsAsArbitrator is derived, not stored - always appended so the API
    // response carries it without every caller remembering to compute it.
    protected $appends = ['years_as_arbitrator'];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'score_updated_at' => 'datetime',
            'joined_at' => 'date',
        ];
    }

    /**
     * Experience as an arbitrator specifically (years on the AAK panel,
     * since joined_at) - distinct from years_of_practice, which is their
     * general professional field experience entered at onboarding.
     */
    protected function yearsAsArbitrator(): Attribute
    {
        // Carbon 3's diffInYears() returns a float by default (fractional
        // years) - truncate to whole years, which is what "N years as an
        // arbitrator" means to a reader.
        return Attribute::get(fn () => $this->joined_at ? (int) $this->joined_at->diffInYears(Carbon::now()) : 0);
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

    /** Most recent assignment regardless of status - used to work out how
     * long an arbitrator with no current case has gone without one. */
    public function lastAssignment(): HasOne
    {
        return $this->hasOne(Assignment::class)->latestOfMany('assigned_at');
    }

    public function tribunalMemberships(): HasMany
    {
        return $this->hasMany(TribunalMember::class);
    }
}
