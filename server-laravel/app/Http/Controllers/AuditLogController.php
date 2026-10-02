<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'action' => ['nullable', 'string', 'max:100'],
                'entityType' => ['nullable', 'string', 'max:50'],
                'userId' => ['nullable', 'integer', 'min:1'],
                'from' => ['nullable', 'date'],
                'to' => ['nullable', 'date'],
                'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        $query = AuditLog::with('user:id,email,role')->orderByDesc('created_at')->limit($data['limit'] ?? 100);

        if (! empty($data['action'])) {
            $query->where('action', 'like', '%'.$data['action'].'%');
        }
        if (! empty($data['entityType'])) {
            $query->where('entity_type', $data['entityType']);
        }
        if (! empty($data['userId'])) {
            $query->where('user_id', $data['userId']);
        }
        if (! empty($data['from']) || ! empty($data['to'])) {
            if (! empty($data['from'])) {
                $query->where('created_at', '>=', $data['from']);
            }
            if (! empty($data['to'])) {
                $query->where('created_at', '<=', $data['to']);
            }
        }

        $logs = $query->get()->map(fn (AuditLog $log) => [
            'id' => $log->id,
            'userEmail' => $log->user?->email,
            'userRole' => $log->user?->role,
            'action' => $log->action,
            'entityType' => $log->entity_type,
            'entityId' => $log->entity_id,
            'metadata' => $log->metadata,
            'ipAddress' => $log->ip_address,
            'createdAt' => $log->created_at,
        ]);

        return response()->json($logs->values());
    }
}
