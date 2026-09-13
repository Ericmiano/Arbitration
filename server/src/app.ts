import './lib/bigintJson';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { csrfProtection } from './middleware/csrf';
import { routes } from './routes';

const MySQLStore = MySQLStoreFactory(session);

export function createApp() {
  const app = express();

  // cPanel deployment always sits behind Apache/Passenger as a reverse proxy,
  // so without this every req.ip (used throughout for audit logging - login,
  // document access, case actions) would record the proxy's local address
  // instead of the real client's, making the audit trail useless for
  // incident investigation. Left off outside production: trusting
  // X-Forwarded-For with no actual proxy in front would let a client spoof
  // its own logged IP.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // This API only ever serves JSON and file downloads (never renders HTML
  // itself), so every directive is locked to 'none' explicitly rather than
  // taking helmet's built-in defaults (useDefaults: false) - those defaults
  // assume a server that also serves a page (script-src 'self', style-src
  // with 'unsafe-inline', font-src https:, etc.), none of which this API
  // needs or should allow.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          fontSrc: ["'none'"],
          objectSrc: ["'none'"],
          connectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);

  const sessionStore = new MySQLStore({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  app.use(
    session({
      store: sessionStore,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      },
    }),
  );

  // General API abuse ceiling. /auth/login carries its own stricter limiter
  // on top of this - this one exists because, before this, nothing at all
  // bounded request volume on document downloads, search, exports, etc.
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 100_000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter, routes);

  app.use(errorHandler);

  return app;
}
