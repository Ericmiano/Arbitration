import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

export const assignmentRoutes = Router();

assignmentRoutes.use(requireAuth);

// TODO: assign an arbitrator to a case - must re-check conflicts server-side
// even if the UI already filtered them out.
assignmentRoutes.post('/', requireRole('admin', 'registrar', 'staff'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// TODO: request/approve/reject a due-date extension (assignment_extensions table).
assignmentRoutes.post('/:assignmentId/extensions', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// TODO: mark an assignment completed - triggers arbitrator score recalculation.
assignmentRoutes.post('/:assignmentId/complete', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
