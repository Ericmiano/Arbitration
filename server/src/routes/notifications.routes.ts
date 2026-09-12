import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: { user_id: req.session.user!.id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

notificationRoutes.patch('/:notificationId/read', async (req, res, next) => {
  try {
    const notificationId = Number(req.params.notificationId);
    if (!Number.isInteger(notificationId)) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }

    const notification = await prisma.notifications.findUnique({ where: { id: notificationId } });
    if (!notification || Number(notification.user_id) !== req.session.user!.id) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const updated = await prisma.notifications.update({
      where: { id: notificationId },
      data: { read_at: new Date() },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});
