<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// On cPanel (no persistent scheduler process), a single cron entry runs
// `php artisan schedule:run` every minute and Laravel dispatches whatever's
// actually due - so this one line is the only cron entry ever needed here.
Schedule::command('cases:remind-updates')->daily();
