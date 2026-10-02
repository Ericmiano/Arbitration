<?php

namespace App\Support;

class Ids
{
    /**
     * Parses a route param / query value into a safe positive integer id, or
     * null if invalid. Mirrors the Node API's parseId() - the fix for a real,
     * audited bug: a value like "999999999999999999999" has no fractional
     * part so naive int-cast/is_numeric checks accept it, but it's outside
     * PHP's (and originally JS's) safe integer range and would either
     * silently misbehave or blow up deep in the ORM with a leaked stack
     * trace. Reject anything outside PHP_INT_MAX up front, before it ever
     * reaches a query.
     */
    public static function parse(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value > 0 ? $value : null;
        }

        if (! is_string($value) || $value === '' || ! ctype_digit($value)) {
            return null;
        }

        if (strlen($value) > strlen((string) PHP_INT_MAX)) {
            return null;
        }

        $int = (int) $value;

        return ($int > 0 && (string) $int === $value) ? $int : null;
    }
}
