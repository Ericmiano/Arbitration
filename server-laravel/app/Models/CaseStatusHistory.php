<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Written exclusively through CaseTimelineService - never update or delete rows here.
class CaseStatusHistory extends Model
{
    protected $table = 'case_status_history';
    const UPDATED_AT = null;

    protected $fillable = ['case_id', 'from_status', 'to_status', 'changed_by_user_id', 'reason', 'notes'];

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}
