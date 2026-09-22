<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $table = 'projects';
    const UPDATED_AT = null;

    protected $fillable = ['name', 'description', 'sector', 'value', 'currency', 'location'];

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function cases(): HasMany
    {
        return $this->hasMany(ArbitrationCase::class);
    }
}
