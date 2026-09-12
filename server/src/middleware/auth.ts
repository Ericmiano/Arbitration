import { RequestHandler } from 'express';

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};

export const requireRole = (
  ...roles: Array<'admin' | 'registrar' | 'staff' | 'arbitrator' | 'party'>
): RequestHandler => {
  return (req, res, next) => {
    if (!req.session.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.session.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
};
