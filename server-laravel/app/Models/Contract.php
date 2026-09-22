<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    protected $table = 'contracts';
    const UPDATED_AT = null;

    protected $fillable = [
        'project_id', 'reference_number', 'execution_date', 'value', 'currency',
        'has_arbitration_clause', 'arbitration_clause_text', 'governing_law',
    ];

    protected function casts(): array
    {
        return ['execution_date' => 'date', 'has_arbitration_clause' => 'boolean'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function parties(): BelongsToMany
    {
        return $this->belongsToMany(Party::class, 'contract_parties')->withPivot('role');
    }

    public function cases(): HasMany
    {
        return $this->hasMany(ArbitrationCase::class);
    }
}
