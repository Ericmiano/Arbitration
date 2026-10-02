<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetMail;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Services\AuditService;
use App\Services\UserProfileService;
use App\Support\Ids;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::orderByDesc('created_at')->limit(500)->get(['id', 'email', 'role', 'status', 'full_name', 'last_login_at', 'created_at']);

        $withNames = $users->map(fn (User $u) => [
            'id' => $u->id,
            'email' => $u->email,
            'role' => $u->role,
            'status' => $u->status,
            'fullName' => UserProfileService::resolveDisplayName($u->id, $u->role, $u->email),
            'lastLoginAt' => $u->last_login_at,
            'createdAt' => $u->created_at,
        ]);

        return response()->json($withNames->values());
    }

    /**
     * Onboards a new staff-side account. There was previously no way to do
     * this at all short of editing the database directly - the seed script
     * makes exactly one admin, and every other route only ever creates a
     * user as a side effect of creating an arbitrator/party record. The new
     * account gets a random, unknown, unusable password and is immediately
     * sent a password-reset link (reusing the same flow as "forgot
     * password") so it sets its own password on first login rather than an
     * admin knowing it.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'email' => ['required', 'email'],
                'fullName' => ['required', 'string', 'max:255'],
                'role' => ['required', 'in:admin,registrar,staff'],
            ]);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->errors()], 400);
        }

        if (User::where('email', $data['email'])->exists()) {
            return response()->json(['error' => 'An account with this email already exists'], 409);
        }

        $randomPassword = Str::random(40);
        $user = User::create([
            'email' => $data['email'],
            'full_name' => $data['fullName'],
            'role' => $data['role'],
            'password_hash' => Hash::make($randomPassword),
            'status' => 'active',
        ]);

        $token = Str::random(64);
        PasswordResetToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addDay(),
        ]);

        $setupUrl = rtrim(config('app.frontend_url'), '/')."/reset-password?token={$token}";
        Mail::to($data['email'])->send(new PasswordResetMail($setupUrl));

        AuditService::log(Auth::id(), 'user_created', 'user', $user->id, ['email' => $data['email'], 'role' => $data['role']], $request->ip());

        return response()->json(['id' => $user->id, 'email' => $user->email, 'role' => $user->role, 'fullName' => $data['fullName']], 201);
    }

    /**
     * Role/status editing for staff-side accounts only (admin/registrar/staff).
     * Arbitrator and party accounts are never touched here - their role is
     * fixed at creation and tied to a linked arbitrators/parties row that
     * this endpoint knows nothing about, so allowing a role change into or
     * out of those would leave that row orphaned or missing.
     */
    public function update(Request $request, string $userId): JsonResponse
    {
        $id = Ids::parse($userId);
        try {
            $data = $request->validate([
                'role' => ['sometimes', 'in:admin,registrar,staff'],
                'status' => ['sometimes', 'in:active,inactive,suspended'],
            ]);
            if (empty($data)) {
                throw ValidationException::withMessages(['role' => 'role or status is required']);
            }
        } catch (ValidationException) {
            $data = null;
        }
        if ($id === null || $data === null) {
            return response()->json(['error' => 'A valid role or status is required'], 400);
        }

        $target = User::find($id);
        if (! $target) {
            return response()->json(['error' => 'User not found'], 404);
        }
        if (! in_array($target->role, ['admin', 'registrar', 'staff'], true)) {
            return response()->json(['error' => 'Arbitrator and party accounts are managed from the Arbitrators and Parties pages, not here.'], 400);
        }

        $sessionUserId = (int) Auth::id();
        $demotingOrDeactivatingSelf = $id === $sessionUserId
            && ((isset($data['role']) && $data['role'] !== 'admin') || (isset($data['status']) && $data['status'] !== 'active'));
        if ($demotingOrDeactivatingSelf) {
            return response()->json(['error' => "You can't change your own role or deactivate your own account."], 400);
        }

        $removingAdminRights = $target->role === 'admin'
            && ((isset($data['role']) && $data['role'] !== 'admin') || (isset($data['status']) && $data['status'] !== 'active'));
        if ($removingAdminRights) {
            $otherActiveAdmins = User::where('role', 'admin')->where('status', 'active')->where('id', '!=', $id)->count();
            if ($otherActiveAdmins === 0) {
                return response()->json(['error' => 'Cannot remove the last active administrator.'], 400);
            }
        }

        $target->update(array_filter([
            'role' => $data['role'] ?? null,
            'status' => $data['status'] ?? null,
        ], fn ($v) => $v !== null));

        AuditService::log($sessionUserId, 'user_role_status_changed', 'user', $id, [
            'previousRole' => $target->getOriginal('role'),
            'previousStatus' => $target->getOriginal('status'),
            'newRole' => $data['role'] ?? null,
            'newStatus' => $data['status'] ?? null,
        ], $request->ip());

        return response()->json(['id' => $target->id, 'role' => $target->role, 'status' => $target->status]);
    }
}
