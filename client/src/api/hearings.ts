import { apiClient } from './client';
import { Hearing } from '../types';

export async function listHearings(caseId?: string): Promise<Hearing[]> {
  const { data } = await apiClient.get('/hearings', { params: caseId ? { caseId } : undefined });
  return data;
}

export interface ScheduleHearingInput {
  caseId: string;
  scheduledAt: string;
  mode: 'in_person' | 'virtual';
  venueOrLink: string;
  agenda?: string;
  requiredDocuments?: string;
}

export async function scheduleHearing(input: ScheduleHearingInput): Promise<Hearing> {
  const { data } = await apiClient.post('/hearings', input);
  return data;
}

export interface UpdateHearingInput {
  scheduledAt?: string;
  mode?: 'in_person' | 'virtual';
  venueOrLink?: string;
  agenda?: string;
  requiredDocuments?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'postponed';
}

export async function updateHearing(hearingId: string, input: UpdateHearingInput): Promise<Hearing> {
  const { data } = await apiClient.patch(`/hearings/${hearingId}`, input);
  return data;
}
