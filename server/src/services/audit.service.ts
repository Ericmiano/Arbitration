import { prisma } from '../lib/prisma';

export async function logAudit(params: {
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | bigint;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await prisma.audit_logs.create({
    data: {
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      ip_address: params.ipAddress ?? null,
    },
  });
}
