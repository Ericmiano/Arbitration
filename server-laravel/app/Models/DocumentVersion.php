<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// A superseded version, archived here when a newer one replaces the live `documents` row.
class DocumentVersion extends Model
{
    protected $table = 'document_versions';
    public $timestamps = false; // uses uploaded_at instead of created_at/updated_at

    protected $fillable = [
        'document_id', 'version_number', 'storage_path', 'checksum_sha256',
        'file_size', 'uploaded_by', 'uploaded_at', 'change_reason',
    ];

    protected function casts(): array
    {
        return ['uploaded_at' => 'datetime'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
