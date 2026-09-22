<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArbitratorSpecialization extends Model
{
    protected $table = 'arbitrator_specializations';
    public $timestamps = false;
    public $incrementing = false;

    protected $fillable = ['arbitrator_id', 'specialization'];

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }
}
