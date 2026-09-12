import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { caseRoutes } from './cases.routes';
import { arbitratorRoutes } from './arbitrators.routes';
import { assignmentRoutes } from './assignments.routes';
import { documentRoutes } from './documents.routes';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ status: 'ok' }));

routes.use('/auth', authRoutes);
routes.use('/cases', caseRoutes);
routes.use('/arbitrators', arbitratorRoutes);
routes.use('/assignments', assignmentRoutes);
routes.use('/documents', documentRoutes);
