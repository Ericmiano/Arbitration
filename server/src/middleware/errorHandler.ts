import { ErrorRequestHandler } from 'express';
import { env } from '../config/env';

interface HttpError extends Error {
  status?: number;
}

export const errorHandler: ErrorRequestHandler = (err: HttpError, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};
