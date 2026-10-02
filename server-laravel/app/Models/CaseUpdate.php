<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseUpdate extends Model
{
    protected $table = 'case_updates';
    const UPDATED_AT = null;

    protected $fillable = ['case_id', 'posted_by', 'note'];

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function postedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }
}
