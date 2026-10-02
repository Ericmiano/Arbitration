import { apiClient } from './client';

/**
 * Just the per-assignment due-date extension machinery -
 * appointing/withdrawing/concluding a case's arbitrator(s) moved to
 * api/tribunals.ts (see TribunalController on the backend).
 */
export async function requestExtension(
  assignmentId: string,
  reason: string,
  requestedDueDate: string,
): Promise<void> {
  await apiClient.post(`/assignments/${assignmentId}/extensions`, { reason, requestedDueDate });
}

export interface AssignmentExtension {
  id: string;
  assignment_id: string;
  requested_by: string;
  requested_at: string;
  reason: string;
  previous_due_date: string;
  new_due_date: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_by: string | null;
  decided_at: string | null;
}

export async function listExtensions(assignmentId: string): Promise<AssignmentExtension[]> {
  const { data } = await apiClient.get(`/assignments/${assignmentId}/extensions`);
  return data;
}

export async function decideExtension(
  assignmentId: string,
  extensionId: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  await apiClient.patch(`/assignments/${assignmentId}/extensions/${extensionId}`, { decision });
}
