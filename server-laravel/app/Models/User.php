<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'email', 'password_hash', 'full_name', 'role', 'status',
        'mfa_secret', 'mfa_enabled', 'failed_login_count', 'locked_until', 'last_login_at',
    ];

    protected $hidden = ['password_hash', 'mfa_secret'];

    protected function casts(): array
    {
        return [
            'mfa_enabled' => 'boolean',
            'locked_until' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    /** Laravel's Auth facade looks for a password via this hook, not a fixed column name. */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function arbitrator(): HasOne
    {
        return $this->hasOne(Arbitrator::class);
    }

    public function party(): HasOne
    {
        return $this->hasOne(Party::class);
    }

    public function isStaff(): bool
    {
        return in_array($this->role, ['admin', 'registrar', 'staff'], true);
    }
}
