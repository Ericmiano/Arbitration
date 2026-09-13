import { z } from 'zod';

/**
 * A positive integer ID, safe to pass to Prisma's BigInt-backed columns.
 * `z.number().int()` alone is not enough - it accepts values like
 * `999999999999999999999` (parses to `1e+21`, which has no fractional part
 * so passes `.int()`, but is far outside safe-integer range). Prisma then
 * rejects it as an invalid BigInt with a raw error exposing the query and
 * server file paths. `.safe()` closes that gap - the same one
 * server/src/lib/parseId.ts closes for raw `req.params` values.
 */
export const idSchema = z.coerce.number().int().positive().safe();
