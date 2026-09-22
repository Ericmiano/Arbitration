<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArbitratorScoreHistory extends Model
{
    protected $table = 'arbitrator_score_history';
    public $timestamps = false;

    protected $fillable = [
        'arbitrator_id', 'case_id', 'score', 'timeliness_component', 'outcome_component',
        'workload_component', 'calculated_at',
    ];

    protected function casts(): array
    {
        return ['calculated_at' => 'datetime'];
    }

    public function arbitrator(): BelongsTo
    {
        return $this->belongsTo(Arbitrator::class);
    }

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }
}
