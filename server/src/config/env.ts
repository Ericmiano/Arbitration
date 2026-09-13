import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  SESSION_SECRET: z.string().min(16),

  DOCUMENT_STORAGE_PATH: z.string().min(1),
  MAX_UPLOAD_MB: z.coerce.number().default(25),

  // All optional: password reset degrades to logging the email to the
  // console (see lib/mail.ts) rather than failing when SMTP isn't set up,
  // which is the common case in local dev.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);
