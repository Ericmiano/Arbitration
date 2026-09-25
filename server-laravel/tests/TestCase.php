<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Sanctum's stateful-SPA middleware only starts a session (and
        // enforces CSRF) for requests that look like they came from the
        // configured frontend origin - exactly like a bare curl call with
        // no Origin header, a bare test request wouldn't trigger it either,
        // and controller code that calls $request->session() would fail
        // with "Session store not set on request". Matches SANCTUM_STATEFUL_
        // DOMAINS (see .env) and is what a real browser sends automatically.
        $this->withHeader('Origin', config('app.frontend_url'));
    }
}
