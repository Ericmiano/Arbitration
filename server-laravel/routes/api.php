<?php

use App\Http\Controllers\ArbitratorController;
use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CaseController;
use App\Http\Controllers\CaseUpdateController;
use App\Http\Controllers\DeadlineController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\FilingController;
use App\Http\Controllers\HearingController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\PartyController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\TribunalController;
use App\Http\Controllers\UserController;
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

    // Cases - /export must be registered before /{caseId}, otherwise that
    // literal path would be captured as an id param.
    Route::get('/cases', [CaseController::class, 'index']);
    Route::post('/cases', [CaseController::class, 'store'])->middleware('role:admin,registrar,staff');
    Route::get('/cases/export', [CaseController::class, 'export'])->middleware('role:admin,registrar,staff');
    Route::patch('/cases/{caseId}/confirm-agreement', [CaseController::class, 'confirmAgreement'])->middleware('role:admin,registrar,staff');
    Route::get('/cases/{caseId}', [CaseController::class, 'show']);

    // Case updates - the arbitrator's progress notes, replacing automatic
    // date-based overdue flagging. Read is any case-linked user; write is
    // the owning arbitrator or staff (checked inside the controller).
    Route::get('/cases/{caseId}/updates', [CaseUpdateController::class, 'index']);
    Route::post('/cases/{caseId}/updates', [CaseUpdateController::class, 'store']);

    // Procedural timeline (case_events) - access mirrors document/case access.
    Route::get('/cases/{caseId}/timeline', [CaseController::class, 'timeline']);

    // Tribunal formation - open to staff and to the case's own parties
    // (picking arbitrators themselves), same access pattern as the old
    // assignment-creation endpoint it replaces; per-member/case actions
    // check ownership inside the controller since either staff or the
    // owning arbitrator(s) may act on them.
    Route::post('/cases/{caseId}/tribunal', [TribunalController::class, 'store']);
    Route::get('/cases/{caseId}/tribunal', [TribunalController::class, 'show']);
    Route::post('/tribunals/{tribunalId}/members', [TribunalController::class, 'addMember']);
    Route::post('/tribunals/{tribunalId}/members/{memberId}/accept', [TribunalController::class, 'acceptMember']);
    Route::post('/tribunals/{tribunalId}/members/{memberId}/decline', [TribunalController::class, 'declineMember']);
    Route::post('/tribunals/{tribunalId}/members/{memberId}/withdraw', [TribunalController::class, 'withdrawMember'])->middleware('role:admin,registrar,staff');
    Route::post('/cases/{caseId}/conclude', [TribunalController::class, 'conclude']);

    // Filings - a formal procedural submission grouping a main document
    // with its exhibits. Plain /documents uploads keep working unchanged
    // for anything that isn't a formal filing.
    Route::get('/cases/{caseId}/filings', [FilingController::class, 'index']);
    Route::post('/cases/{caseId}/filings', [FilingController::class, 'store']);
    Route::post('/filings/{filingId}/documents', [FilingController::class, 'attachDocument']);
    Route::patch('/filings/{filingId}', [FilingController::class, 'decide'])->middleware('role:admin,registrar,staff');

    // Deadlines - generalized version of assignment_extensions, for any
    // procedural due date (filing due, evidence due, award due, ...).
    Route::get('/cases/{caseId}/deadlines', [DeadlineController::class, 'index']);
    Route::post('/cases/{caseId}/deadlines', [DeadlineController::class, 'store'])->middleware('role:admin,registrar,staff');
    Route::patch('/deadlines/{deadlineId}', [DeadlineController::class, 'update']);
    Route::post('/deadlines/{deadlineId}/extensions', [DeadlineController::class, 'requestExtension']);
    Route::patch('/deadlines/{deadlineId}/extensions/{extensionId}', [DeadlineController::class, 'decideExtension'])->middleware('role:admin,registrar,staff');

    // Arbitrators - /eligible must be registered before /{arbitratorId},
    // otherwise that literal path would be captured as an id param.
    // /eligible is open to staff and to the case's own parties (see
    // ArbitratorController::eligible) so parties can pick their own
    // arbitrator - not role-gated here, the controller decides.
    Route::post('/arbitrators', [ArbitratorController::class, 'store'])->middleware('role:admin,registrar');
    Route::get('/arbitrators', [ArbitratorController::class, 'index'])->middleware('role:admin,registrar,staff');
    Route::get('/arbitrators/eligible', [ArbitratorController::class, 'eligible']);
    Route::get('/arbitrators/export', [ArbitratorController::class, 'export'])->middleware('role:admin,registrar,staff');
    Route::post('/arbitrators/{arbitratorId}/conflicts', [ArbitratorController::class, 'declareConflict'])->middleware('role:admin,registrar');
    Route::get('/arbitrators/{arbitratorId}', [ArbitratorController::class, 'show'])->middleware('role:admin,registrar,staff');

    // Assignment due-date extensions - the arbitrator-appointment
    // endpoints that used to live here moved to /cases/{caseId}/tribunal.
    Route::post('/assignments/{assignmentId}/extensions', [AssignmentController::class, 'requestExtension']);
    Route::get('/assignments/{assignmentId}/extensions', [AssignmentController::class, 'listExtensions']);
    Route::patch('/assignments/{assignmentId}/extensions/{extensionId}', [AssignmentController::class, 'decideExtension'])->middleware('role:admin,registrar,staff');

    // Documents
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::get('/documents/{publicId}', [DocumentController::class, 'show']);
    Route::post('/documents/{publicId}/versions', [DocumentController::class, 'storeVersion']);

    // Hearings
    Route::get('/hearings', [HearingController::class, 'index']);
    Route::post('/hearings', [HearingController::class, 'store'])->middleware('role:admin,registrar,staff');
    Route::patch('/hearings/{hearingId}', [HearingController::class, 'update'])->middleware('role:admin,registrar,staff');

    // Parties
    Route::middleware('role:admin,registrar,staff')->group(function () {
        Route::get('/parties', [PartyController::class, 'index']);
        Route::post('/parties', [PartyController::class, 'store']);
        Route::post('/parties/{partyId}/invite', [PartyController::class, 'invite']);
    });

    // Organizations
    Route::get('/organizations', [OrganizationController::class, 'index']);
    Route::post('/organizations', [OrganizationController::class, 'store'])->middleware('role:admin,registrar,staff');

    // Projects
    Route::middleware('role:admin,registrar,staff')->group(function () {
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::post('/projects/{projectId}/contracts', [ProjectController::class, 'storeContract']);
    });

    // Users (staff account management - distinct from auth's own profile endpoint)
    Route::get('/users', [UserController::class, 'index'])->middleware('role:admin,registrar,staff');
    Route::post('/users', [UserController::class, 'store'])->middleware('role:admin');
    Route::patch('/users/{userId}', [UserController::class, 'update'])->middleware('role:admin');

    // Audit log - admin-only, the record of everyone's actions across every
    // case, well beyond what a registrar or staff account needs day to day.
    Route::get('/audit-logs', [AuditLogController::class, 'index'])->middleware('role:admin');

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notificationId}/read', [NotificationController::class, 'markRead']);

    // Reports
    Route::get('/reports/overview', [ReportController::class, 'overview'])->middleware('role:admin,registrar,staff');
});
