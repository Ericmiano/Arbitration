/**
 * Hard ceiling applied to list endpoints that don't yet have real
 * pagination. Every `findMany` serving a full collection (cases, documents,
 * arbitrators, users, parties, organizations, projects) was previously
 * unbounded - fine at today's dev-scale data, but a genuine problem once
 * the register grows into the thousands: an admin's "all cases" call would
 * pull every row, every time, forever. This caps the worst case rather than
 * building full cursor pagination (a larger, separate change - see the
 * production-readiness audit notes) - a real UI pagination/filtering pass
 * should replace this before the case count gets anywhere near it.
 */
export const LIST_HARD_CAP = 500;
