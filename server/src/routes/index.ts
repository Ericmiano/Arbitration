import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { auditLogRoutes } from './auditLogs.routes';
import { caseRoutes } from './cases.routes';
import { arbitratorRoutes } from './arbitrators.routes';
import { assignmentRoutes } from './assignments.routes';
import { documentRoutes } from './documents.routes';
import { hearingRoutes } from './hearings.routes';
import { notificationRoutes } from './notifications.routes';
import { organizationRoutes } from './organizations.routes';
import { partyRoutes } from './parties.routes';
import { projectRoutes } from './projects.routes';
import { reportRoutes } from './reports.routes';
import { userRoutes } from './users.routes';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ status: 'ok' }));

routes.use('/auth', authRoutes);
routes.use('/audit-logs', auditLogRoutes);
routes.use('/cases', caseRoutes);
routes.use('/arbitrators', arbitratorRoutes);
routes.use('/assignments', assignmentRoutes);
routes.use('/documents', documentRoutes);
routes.use('/hearings', hearingRoutes);
routes.use('/notifications', notificationRoutes);
routes.use('/organizations', organizationRoutes);
routes.use('/parties', partyRoutes);
routes.use('/projects', projectRoutes);
routes.use('/reports', reportRoutes);
routes.use('/users', userRoutes);
