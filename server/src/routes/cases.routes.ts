import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

export const caseRoutes = Router();

caseRoutes.use(requireAuth);

// TODO: list cases, scoped by role - staff/admin see all, arbitrators see only
// their assignments, parties see only cases they're party to.
caseRoutes.get('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// TODO: intake a new case - derive sla_tier/due_date from dispute_value via sla_config.
caseRoutes.post('/', requireRole('admin', 'registrar', 'staff'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

caseRoutes.get('/:caseId', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
