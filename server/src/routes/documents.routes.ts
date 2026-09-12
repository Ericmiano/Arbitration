import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';

export const documentRoutes = Router();

documentRoutes.use(requireAuth);

// TODO: persist document metadata (documents table) after multer saves the file
// to DOCUMENT_STORAGE_PATH; default visibility = 'staff_arbitrator' unless the
// uploader is a party, in which case default to 'uploader_only'.
documentRoutes.post('/', upload.single('file'), (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// TODO: check the requesting user against documents.visibility / document_shares
// (and their case_parties / assignment role) before streaming the file - never
// serve DOCUMENT_STORAGE_PATH as a static directory.
documentRoutes.get('/:publicId', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
