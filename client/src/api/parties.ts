import { apiClient } from './client';
import { Party } from '../types';

export async function listParties(): Promise<Party[]> {
  const { data } = await apiClient.get('/parties');
  return data;
}

export interface CreatePartyInput {
  type: 'individual' | 'organization';
  organizationId?: number;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
}

export async function createParty(input: CreatePartyInput): Promise<Party> {
  const { data } = await apiClient.post('/parties', input);
  return data;
}

export async function invitePartyToPortal(
  partyId: string,
  email: string,
): Promise<{ temporaryPassword: string }> {
  const { data } = await apiClient.post(`/parties/${partyId}/invite`, { email });
  return data;
}
