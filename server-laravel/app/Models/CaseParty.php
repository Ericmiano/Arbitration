<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseParty extends Model
{
    protected $table = 'case_parties';
    public $timestamps = false;
    public $incrementing = false;

    protected $fillable = ['case_id', 'party_id', 'role'];

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }
}
