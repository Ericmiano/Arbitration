import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

export const arbitratorRoutes = Router();

arbitratorRoutes.use(requireAuth);

// TODO: list arbitrators with score, workload count, active/suspended status.
arbitratorRoutes.get('/', requireRole('admin', 'registrar', 'staff'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// TODO: for a given case, return the conflict-cleared, active arbitrator pool
// sorted by score (soft ranking only - staff make the final call).
arbitratorRoutes.get('/eligible', requireRole('admin', 'registrar', 'staff'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// TODO: create/update a declared conflict of interest for an arbitrator.
arbitratorRoutes.post(
  '/:arbitratorId/conflicts',
  requireRole('admin', 'registrar'),
  (_req, res) => {
    res.status(501).json({ message: 'Not implemented yet' });
  },
);
