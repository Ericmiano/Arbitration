<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetMail;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Services\AuditService;
use App\Services\UserProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const MAX_FAILED_ATTEMPTS = 5;
    private const LOCKOUT_MINUTES = 15;

    public function login(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'email' => ['required', 'email'],
                'password' => ['required', 'string'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'Email and password are required'], 400);
        }

        $invalidCredentials = fn () => response()->json(['error' => 'Invalid email or password'], 401);

        $user = User::where('email', $data['email'])->first();

        if (! $user) {
            // Deliberately not audited against a specific user record - there
            // is none to attribute it to, and logging the attempted email
            // here would itself accumulate a list of guessed addresses. The
            // route's rate limiter is the control for this case, not the log.
            return $invalidCredentials();
        }

        if ($user->locked_until && $user->locked_until->isFuture()) {
            AuditService::log($user->id, 'login_blocked_locked_account', 'user', $user->id, null, $request->ip());

            return response()->json(['error' => 'Account temporarily locked. Try again later.'], 423);
        }

        if ($user->status !== 'active') {
            return response()->json(['error' => 'Account is not active'], 403);
        }

        if (! Hash::check($data['password'], $user->password_hash)) {
            $failedCount = $user->failed_login_count + 1;
            $lockingOut = $failedCount >= self::MAX_FAILED_ATTEMPTS;

            $user->update([
                'failed_login_count' => $lockingOut ? 0 : $failedCount,
                'locked_until' => $lockingOut ? now()->addMinutes(self::LOCKOUT_MINUTES) : null,
            ]);

            AuditService::log(
                $user->id,
                $lockingOut ? 'login_failed_account_locked' : 'login_failed',
                'user',
                $user->id,
                ['failedCount' => $failedCount],
                $request->ip(),
            );

            return $invalidCredentials();
        }

        $user->update(['failed_login_count' => 0, 'locked_until' => null, 'last_login_at' => now()]);

        Auth::login($user);
        $request->session()->regenerate();

        AuditService::log($user->id, 'login', 'user', $user->id, null, $request->ip());

        $fullName = UserProfileService::resolveDisplayName($user->id, $user->role, $user->email);

        return response()->json([
            'id' => $user->public_id,
            'email' => $user->email,
            'role' => $user->role,
            'fullName' => $fullName,
        ]);
    }

    public function requestPasswordReset(Request $request): JsonResponse
    {
        try {
            $data = $request->validate(['email' => ['required', 'email']]);
        } catch (ValidationException) {
            return response()->json(['error' => 'A valid email is required'], 400);
        }

        // Same response whether or not the account exists, and whether or
        // not sending actually succeeds - same enumeration reasoning as login.
        $genericResponse = fn () => response()->json(['message' => 'If that email is registered, a reset link has been sent.']);

        $user = User::where('email', $data['email'])->first();
        if (! $user || $user->status !== 'active') {
            return $genericResponse();
        }

        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);

        PasswordResetToken::create([
            'user_id' => $user->id,
            'token_hash' => $tokenHash,
            'expires_at' => now()->addHour(),
        ]);

        $resetUrl = rtrim(config('app.frontend_url'), '/')."/reset-password?token={$token}";
        Mail::to($user->email)->send(new PasswordResetMail($resetUrl));

        AuditService::log($user->id, 'password_reset_requested', 'user', $user->id, null, $request->ip());

        return $genericResponse();
    }

    public function resetPassword(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'token' => ['required', 'string'],
                'newPassword' => ['required', 'string', 'min:8'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'token and a newPassword of at least 8 characters are required'], 400);
        }

        $tokenHash = hash('sha256', $data['token']);
        $invalidToken = fn () => response()->json(['error' => 'This reset link is invalid or has expired.'], 400);

        $resetRecord = PasswordResetToken::where('token_hash', $tokenHash)->first();

        if (! $resetRecord || $resetRecord->used_at || $resetRecord->expires_at->isPast()) {
            return $invalidToken();
        }

        $user = User::findOrFail($resetRecord->user_id);
        $user->update([
            'password_hash' => Hash::make($data['newPassword']),
            'failed_login_count' => 0,
            'locked_until' => null,
        ]);
        $resetRecord->update(['used_at' => now()]);

        AuditService::log($user->id, 'password_reset_completed', 'user', $user->id, null, $request->ip());

        return response()->json(['message' => 'Password has been reset. You can now log in.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'currentPassword' => ['required', 'string'],
                'newPassword' => ['required', 'string', 'min:8'],
            ]);
        } catch (ValidationException) {
            return response()->json(['error' => 'currentPassword and a newPassword of at least 8 characters are required'], 400);
        }

        /** @var User $user */
        $user = Auth::user();

        if (! Hash::check($data['currentPassword'], $user->password_hash)) {
            return response()->json(['error' => 'Current password is incorrect'], 401);
        }

        $user->update(['password_hash' => Hash::make($data['newPassword'])]);

        AuditService::log($user->id, 'password_changed', 'user', $user->id, null, $request->ip());

        return response()->json(['message' => 'Password updated']);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();
        $fullName = UserProfileService::resolveDisplayName($user->id, $user->role, $user->email);

        return response()->json([
            'id' => $user->id,
            'role' => $user->role,
            'fullName' => $fullName,
            'email' => $user->email,
        ]);
    }

    /**
     * Self-service display-name update. Staff/admin/registrar only -
     * arbitrators and parties display their arbitrators/parties.full_name
     * instead (see UserProfileService), managed through those records, not
     * this endpoint. Accepting this from any role would silently update
     * users.full_name with no visible effect for the other roles, since
     * resolveDisplayName never reads it for them - so it's rejected outright.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();

        if (! $user->isStaff()) {
            return response()->json([
                'error' => 'Your display name is managed through your arbitrator/party record, not here.',
            ], 403);
        }

        try {
            $data = $request->validate(['fullName' => ['required', 'string', 'max:255']]);
        } catch (ValidationException) {
            return response()->json(['error' => 'fullName is required'], 400);
        }

        $user->update(['full_name' => $data['fullName']]);

        return response()->json(['message' => 'Profile updated']);
    }
}
