import { Router } from 'express';
import rateLimit from 'express-rate-limit';

export const authRoutes = Router();

// Brute-force protection on login specifically.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// TODO: implement once Prisma models exist (see prisma/schema.prisma workflow notes) -
// look up the user by email, bcryptjs.compare the password, then set req.session.user.
authRoutes.post('/login', loginLimiter, (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

authRoutes.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

authRoutes.get('/me', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(req.session.user);
});
