<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArbitratorQualification extends Model
{
    protected $table = 'arbitrator_qualifications';
    public $timestamps = false;

    protected $fillable = ['arbitrator_id', 'qualification'];

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }
}
