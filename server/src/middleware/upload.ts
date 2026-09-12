import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env';

// Only formats AAK actually expects for scanned dispute documents.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination: env.DOCUMENT_STORAGE_PATH,
  filename: (_req, file, cb) => {
    // Never trust the original filename for the stored path - avoids path
    // traversal and collisions. The original name is kept separately in the
    // documents.file_name DB column for display purposes only.
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});
