<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Brute-force protection on login specifically (in addition to the
// per-account lockout in AuthController, which survives across IPs/proxies).
// Named limiters (see AppServiceProvider) are relaxed under APP_ENV=testing.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Shared budget for both reset endpoints, independent of the login limiter.
Route::post('/auth/request-password-reset', [AuthController::class, 'requestPasswordReset'])->middleware('throttle:password-reset');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');

Route::middleware('auth.session')->group(function () {
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
});
