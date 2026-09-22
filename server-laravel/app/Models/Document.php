<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    protected $table = 'documents';
    const UPDATED_AT = null;

    protected $fillable = [
        'case_id', 'uploaded_by', 'document_type', 'visibility', 'file_name',
        'storage_path', 'mime_type', 'file_size', 'version', 'checksum_sha256', 'scan_status',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(ArbitrationCase::class, 'case_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function shares(): HasMany
    {
        return $this->hasMany(DocumentShare::class);
    }
}
