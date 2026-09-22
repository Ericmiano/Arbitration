<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArbitratorRegistration extends Model
{
    protected $table = 'arbitrator_registrations';
    public $timestamps = false;

    protected $fillable = ['arbitrator_id', 'body', 'registration_number'];

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }
}
