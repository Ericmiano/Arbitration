<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Named, environment-aware rate limiters - matches the Node API's
        // own pattern of relaxing limits under test, since PHPUnit runs many
        // test methods against one shared in-memory rate-limit store within
        // a single process, and a real limit would make later tests in the
        // same file fail for hitting a budget earlier tests already used.
        RateLimiter::for('login', function ($request) {
            return app()->environment('testing')
                ? Limit::none()
                : Limit::perMinutes(15, 10)->by($request->ip());
        });

        RateLimiter::for('password-reset', function ($request) {
            return app()->environment('testing')
                ? Limit::none()
                : Limit::perMinutes(15, 5)->by($request->ip());
        });
    }
}
