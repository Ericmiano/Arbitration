<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditService
{
    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public static function log(
        ?int $userId,
        string $action,
        string $entityType,
        int|string $entityId,
        ?array $metadata = null,
        ?string $ipAddress = null,
    ): void {
        AuditLog::create([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata' => $metadata,
            'ip_address' => $ipAddress,
        ]);
    }
}
