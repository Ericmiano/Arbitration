import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { logAudit } from '../services/audit.service';
import { accessibleCaseIds, canAccessCase } from '../services/caseAccess.service';
import { idSchema } from '../lib/zodId';
import { LIST_HARD_CAP } from '../lib/pagination';

export const documentRoutes = Router();

documentRoutes.use(requireAuth);

const uploadMetadataSchema = z.object({
  caseId: idSchema,
  documentType: z.enum([
    'contract_copy',
    'evidence',
    'submission_agreement',
    'correspondence',
    'award',
    'id_kyc',
    'other',
  ]),
  // Only staff/arbitrator may choose to widen visibility beyond the default -
  // enforced below, not trusted from the client for party uploads.
  visibility: z.enum(['staff_arbitrator', 'shared_all_parties', 'uploader_only']).optional(),
});

documentRoutes.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'A file is required' });
      return;
    }

    const parseResult = uploadMetadataSchema.safeParse(req.body);
    if (!parseResult.success) {
      fs.unlink(req.file.path, () => undefined);
      res.status(400).json({ error: 'caseId and documentType are required' });
      return;
    }
    const { caseId, documentType } = parseResult.data;
    const sessionUser = req.session.user!;

    const hasAccess = await canAccessCase(caseId, sessionUser);
    if (!hasAccess) {
      fs.unlink(req.file.path, () => undefined);
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    const isStaffOrArbitrator = sessionUser.role !== 'party';
    const visibility = isStaffOrArbitrator ? (parseResult.data.visibility ?? 'staff_arbitrator') : 'uploader_only';

    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const document = await prisma.documents.create({
      data: {
        case_id: caseId,
        uploaded_by: sessionUser.id,
        document_type: documentType,
        visibility,
        file_name: req.file.originalname,
        storage_path: req.file.filename,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        checksum_sha256: checksum,
        scan_status: 'pending',
      },
    });

    await logAudit({
      userId: sessionUser.id,
      action: 'document_uploaded',
      entityType: 'document',
      entityId: document.id,
      metadata: { caseId, documentType },
      ipAddress: req.ip,
    });

    res.status(201).json({
      publicId: document.public_id,
      fileName: document.file_name,
      documentType: document.document_type,
      visibility: document.visibility,
      createdAt: document.created_at,
    });
  } catch (error) {
    next(error);
  }
});

const listQuerySchema = z.object({
  caseId: idSchema.optional(),
});

/**
 * Documents for one case (?caseId=), or - with no caseId - the full register
 * across every case the current user can access (staff: all; arbitrator:
 * their assigned cases; party: their own cases), for the Document register
 * screen. Either way, results are filtered per-document by canViewDocument.
 */
documentRoutes.get('/', async (req, res, next) => {
  try {
    const parseResult = listQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid caseId' });
      return;
    }
    const { caseId } = parseResult.data;
    const sessionUser = req.session.user!;

    let caseIds: number[];
    if (caseId !== undefined) {
      const hasAccess = await canAccessCase(caseId, sessionUser);
      if (!hasAccess) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }
      caseIds = [caseId];
    } else {
      caseIds = await accessibleCaseIds(sessionUser);
    }

    const documents = await prisma.documents.findMany({
      where: { case_id: { in: caseIds } },
      include: { cases_documents_case_idTocases: { select: { id: true, case_number: true } } },
      orderBy: { created_at: 'desc' },
      take: LIST_HARD_CAP,
    });

    const visible = await Promise.all(
      documents.map(async (document) => ({
        document,
        allowed: await canViewDocument(document, sessionUser),
      })),
    );

    res.json(
      visible
        .filter((v) => v.allowed)
        .map(({ document }) => ({
          publicId: document.public_id,
          fileName: document.file_name,
          documentType: document.document_type,
          visibility: document.visibility,
          uploadedBy: document.uploaded_by,
          scanStatus: document.scan_status,
          createdAt: document.created_at,
          caseId: document.cases_documents_case_idTocases.id,
          caseNumber: document.cases_documents_case_idTocases.case_number,
        })),
    );
  } catch (error) {
    next(error);
  }
});

async function canViewDocument(
  document: { case_id: bigint; visibility: string; uploaded_by: bigint; id: bigint },
  sessionUser: { id: number; role: string },
): Promise<boolean> {
  if (['admin', 'registrar', 'staff'].includes(sessionUser.role)) return true;

  if (sessionUser.role === 'arbitrator') {
    if (document.visibility === 'uploader_only') return false;
    const arbitrator = await prisma.arbitrators.findUnique({ where: { user_id: sessionUser.id } });
    if (!arbitrator) return false;
    const assignment = await prisma.assignments.findFirst({
      where: { case_id: document.case_id, arbitrator_id: arbitrator.id },
      select: { id: true },
    });
    return assignment !== null;
  }

  // role === 'party'
  const party = await prisma.parties.findFirst({ where: { user_id: sessionUser.id } });
  if (!party) return false;
  if (Number(document.uploaded_by) === sessionUser.id) return true;

  const explicitlyShared = await prisma.document_shares.findUnique({
    where: { document_id_party_id: { document_id: document.id, party_id: party.id } },
  });
  if (explicitlyShared) return true;

  if (document.visibility === 'shared_all_parties') {
    const membership = await prisma.case_parties.findFirst({
      where: { case_id: document.case_id, party_id: party.id },
    });
    return membership !== null;
  }

  return false;
}

documentRoutes.get('/:publicId', async (req, res, next) => {
  try {
    const document = await prisma.documents.findUnique({ where: { public_id: req.params.publicId } });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const sessionUser = req.session.user!;
    const allowed = await canViewDocument(document, sessionUser);
    if (!allowed) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const absolutePath = path.join(env.DOCUMENT_STORAGE_PATH, document.storage_path);
    if (!fs.existsSync(absolutePath)) {
      res.status(410).json({ error: 'File is no longer available' });
      return;
    }

    await logAudit({
      userId: sessionUser.id,
      action: 'document_downloaded',
      entityType: 'document',
      entityId: document.id,
      ipAddress: req.ip,
    });

    res.download(absolutePath, document.file_name);
  } catch (error) {
    next(error);
  }
});
