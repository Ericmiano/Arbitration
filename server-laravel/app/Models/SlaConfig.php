<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SlaConfig extends Model
{
    protected $table = 'sla_config';
    public $timestamps = false;

    protected $fillable = ['tier', 'currency', 'min_value', 'max_value', 'target_days', 'approaching_days_before', 'escalation_days_after'];

    protected function casts(): array
    {
        return [
            'min_value' => 'decimal:2',
            'max_value' => 'decimal:2',
            'approaching_days_before' => 'decimal:2',
            'escalation_days_after' => 'decimal:2',
        ];
    }
}
