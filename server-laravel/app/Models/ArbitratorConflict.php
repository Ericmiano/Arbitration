<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArbitratorConflict extends Model
{
    protected $table = 'arbitrator_conflicts';
    public $timestamps = false;

    protected $fillable = ['arbitrator_id', 'conflicted_party_id', 'conflicted_organization_id', 'reason', 'declared_at', 'expires_at'];

    protected function casts(): array
    {
        return ['declared_at' => 'datetime', 'expires_at' => 'date'];
    }

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }

    public function conflictedParty(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'conflicted_party_id');
    }

    public function conflictedOrganization(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'conflicted_organization_id');
    }
}
