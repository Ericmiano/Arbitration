<?php

use Illuminate\Support\Facades\Route;

/**
 * Single-domain cPanel hosting: the built React SPA's static files
 * (index.html + assets/*) are deployed straight into this app's public/
 * alongside Laravel's own index.php (see DEPLOYMENT.md). Apache serves any
 * real file - the SPA's JS/CSS, Laravel's favicon - directly with no PHP
 * involved; only paths that don't match a real file reach here.
 *
 * /api/* is handled entirely by routes/api.php and never reaches this
 * fallback, since Laravel only falls through to it once nothing else -
 * including every defined api.php route - matched. The explicit is('api/*')
 * guard below is just a safety net for a request whose METHOD doesn't match
 * any defined api route (e.g. DELETE on a GET-only endpoint): it should
 * still 404 as an API caller expects, not get handed the SPA's HTML.
 *
 * In local dev the frontend isn't built into public/ at all - it runs on
 * its own Vite dev server (port 5173) - so this route is production-only in
 * practice, and harmlessly 404s if hit before a build exists.
 */
Route::fallback(function () {
    if (request()->is('api/*')) {
        abort(404);
    }

    $indexPath = public_path('index.html');
    if (is_file($indexPath)) {
        return response()->file($indexPath);
    }

    abort(404);
});
