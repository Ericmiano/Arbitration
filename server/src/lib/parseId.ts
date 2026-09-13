/**
 * Validates a route param as a positive integer ID safe to hand to Prisma's
 * BigInt-backed columns. `Number.isInteger()` alone is not enough - a value
 * like `999999999999999999999` parses to `1e+21`, which passes
 * `Number.isInteger` (it has no fractional part) but is far outside
 * MAX_SAFE_INTEGER, so Prisma's query engine rejects it as an invalid BigInt
 * with a raw error that includes the full query and server file paths -
 * an unvalidated ID was reaching the ORM layer and crashing with a 500 that
 * leaked internals. This closes that off before it gets anywhere near a query.
 */
export function parseId(value: string): number | null {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}
