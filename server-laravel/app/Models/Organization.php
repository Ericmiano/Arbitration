<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    protected $table = 'organizations';
    const UPDATED_AT = null;

    protected $fillable = ['name', 'registration_number', 'address', 'sector'];

    public function parties(): HasMany
    {
        return $this->hasMany(Party::class);
    }
}
