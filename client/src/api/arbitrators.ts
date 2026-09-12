import { apiClient } from './client';
import { Arbitrator } from '../types';

export async function listArbitrators(): Promise<Arbitrator[]> {
  const { data } = await apiClient.get('/arbitrators');
  return data;
}

export async function listEligibleArbitrators(caseId: string): Promise<Arbitrator[]> {
  const { data } = await apiClient.get('/arbitrators/eligible', { params: { caseId } });
  return data;
}

export async function getArbitrator(arbitratorId: string): Promise<Arbitrator> {
  const { data } = await apiClient.get(`/arbitrators/${arbitratorId}`);
  return data;
}

export interface CreateArbitratorInput {
  email: string;
  fullName: string;
  aakMembershipNo?: string;
  currentPosition?: string;
  currentOrganization?: string;
  aakChapter?: string;
  yearsOfPractice?: number;
  phone?: string;
  bio?: string;
  adrExperienceNotes?: string;
  specializations?: string[];
  qualifications?: string[];
  registrations?: Array<{ body: string; registrationNumber?: string }>;
}

export async function createArbitrator(
  input: CreateArbitratorInput,
): Promise<{ arbitrator: Arbitrator; temporaryPassword: string }> {
  const { data } = await apiClient.post('/arbitrators', input);
  return data;
}

export async function declareConflict(
  arbitratorId: string,
  input: { partyId?: number; organizationId?: number; reason: string },
): Promise<void> {
  await apiClient.post(`/arbitrators/${arbitratorId}/conflicts`, input);
}
