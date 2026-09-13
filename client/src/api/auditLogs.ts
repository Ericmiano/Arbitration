import { apiClient } from './client';
import { AuditLogEntry } from '../types';

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}

export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const { data } = await apiClient.get('/audit-logs', { params: filters });
  return data;
}
