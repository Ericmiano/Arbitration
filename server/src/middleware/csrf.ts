import crypto from 'node:crypto';
import { RequestHandler } from 'express';
import { env } from '../config/env';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit-cookie CSRF protection. The session cookie is httpOnly (by
 * design - see app.ts), so a same-site form or a compromised third-party
 * page can still make the browser send it automatically; this cookie is
 * deliberately readable by JS so the frontend can echo it back as a header,
 * which a cross-origin attacker cannot do without already being able to run
 * script on this origin (at which point cookies are the least of it).
 *
 * Runs on every request so the cookie exists before the first mutating
 * request (including login itself) - a fresh visitor's very first GET
 * (e.g. the SPA's boot-time `/auth/me` call) issues it.
 */
export const csrfProtection: RequestHandler = (req, res, next) => {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
  }

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const headerToken = req.get(CSRF_HEADER);
  if (!headerToken || headerToken.length !== token.length || !crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(token))) {
    res.status(403).json({ error: 'Invalid or missing CSRF token' });
    return;
  }
  next();
};
