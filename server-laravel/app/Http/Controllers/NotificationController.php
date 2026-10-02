<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index(): JsonResponse
    {
        $notifications = AppNotification::where('user_id', Auth::id())
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json($notifications);
    }

    public function markRead(string $notificationId): JsonResponse
    {
        $id = Ids::parse($notificationId);
        if ($id === null) {
            return response()->json(['error' => 'Invalid notification id'], 400);
        }

        $notification = AppNotification::find($id);
        if (! $notification || (int) $notification->user_id !== (int) Auth::id()) {
            return response()->json(['error' => 'Notification not found'], 404);
        }

        $notification->update(['read_at' => now()]);

        return response()->json($notification);
    }
}
