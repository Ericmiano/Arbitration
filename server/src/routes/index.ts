import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { caseRoutes } from './cases.routes';
import { arbitratorRoutes } from './arbitrators.routes';
import { assignmentRoutes } from './assignments.routes';
import { documentRoutes } from './documents.routes';
import { organizationRoutes } from './organizations.routes';
import { partyRoutes } from './parties.routes';
import { projectRoutes } from './projects.routes';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ status: 'ok' }));

routes.use('/auth', authRoutes);
routes.use('/cases', caseRoutes);
routes.use('/arbitrators', arbitratorRoutes);
routes.use('/assignments', assignmentRoutes);
routes.use('/documents', documentRoutes);
routes.use('/organizations', organizationRoutes);
routes.use('/parties', partyRoutes);
routes.use('/projects', projectRoutes);
