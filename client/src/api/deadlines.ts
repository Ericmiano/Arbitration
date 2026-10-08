import { apiClient } from './client';
import { Deadline, DeadlineExtensionRequest } from '../types';

export async function listDeadlines(caseId: string): Promise<Deadline[]> {
  const { data } = await apiClient.get(`/cases/${caseId}/deadlines`);
  return data;
}

export interface CreateDeadlineInput {
  tribunalMemberId?: number;
  partyId?: number;
  deadlineType: string;
  title: string;
  description?: string;
  dueAt: string;
}

export async function createDeadline(caseId: string, input: CreateDeadlineInput): Promise<Deadline> {
  const { data } = await apiClient.post(`/cases/${caseId}/deadlines`, input);
  return data;
}

export async function updateDeadlineStatus(
  deadlineId: string,
  status: 'completed' | 'waived' | 'cancelled',
): Promise<Deadline> {
  const { data } = await apiClient.patch(`/deadlines/${deadlineId}`, { status });
  return data;
}

export async function requestDeadlineExtension(
  deadlineId: string,
  reason: string,
  requestedDueAt: string,
): Promise<DeadlineExtensionRequest> {
  const { data } = await apiClient.post(`/deadlines/${deadlineId}/extensions`, { reason, requestedDueAt });
  return data;
}

export async function decideDeadlineExtension(
  deadlineId: string,
  extensionId: string,
  decision: 'approved' | 'rejected',
): Promise<{ message: string }> {
  const { data } = await apiClient.patch(`/deadlines/${deadlineId}/extensions/${extensionId}`, { decision });
  return data;
}
