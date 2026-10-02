<?php

namespace App\Services;

use App\Models\SlaConfig;
use Carbon\Carbon;
use RuntimeException;

class SlaService
{
    /**
     * Picks the SLA tier whose [min_value, max_value) band contains
     * disputeValue, for the given currency. Thresholds live in sla_config
     * (DB-driven) rather than hardcoded, per the agreed design - adjustable
     * without a code change. Tier depends only on value/currency, so it's
     * fixed once at case intake.
     */
    public static function deriveTier(float $disputeValue, string $currency): string
    {
        return self::findConfig($disputeValue, $currency)->tier;
    }

    /**
     * Adds the tier's target_days to $from (the assignment date) - due_date
     * is only meaningful once a case has actually been assigned to an arbitrator.
     */
    public static function computeDueDate(string $tier, string $currency, ?Carbon $from = null): Carbon
    {
        $config = SlaConfig::where('tier', $tier)->where('currency', $currency)->first();
        if (! $config) {
            throw new RuntimeException("No sla_config row for tier {$tier} / currency {$currency}");
        }

        return ($from ?? Carbon::now())->copy()->addDays($config->target_days);
    }

    private static function findConfig(float $disputeValue, string $currency): SlaConfig
    {
        $configs = SlaConfig::where('currency', $currency)->get();
        if ($configs->isEmpty()) {
            throw new RuntimeException("No sla_config rows found for currency {$currency}");
        }

        $match = $configs->first(function (SlaConfig $config) use ($disputeValue) {
            $min = (float) $config->min_value;
            $max = $config->max_value === null ? null : (float) $config->max_value;

            return $disputeValue >= $min && ($max === null || $disputeValue < $max);
        });

        if (! $match) {
            throw new RuntimeException("No sla_config tier covers dispute value {$disputeValue} {$currency}");
        }

        return $match;
    }
}
