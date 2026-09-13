import { apiClient } from './client';
import { Case } from '../types';

export interface CreateCaseInput {
  projectId?: number;
  contractId?: number;
  disputeValue: number;
  currency: string;
  category: string;
  description: string;
  basis: 'contractual_clause' | 'mutual_agreement';
  parties: Array<{ partyId: number; role: 'claimant' | 'respondent' | 'other' }>;
}

export async function listCases(q?: string): Promise<Case[]> {
  const { data } = await apiClient.get('/cases', { params: q ? { q } : undefined });
  return data;
}

export async function getCase(caseId: string): Promise<Case> {
  const { data } = await apiClient.get(`/cases/${caseId}`);
  return data;
}

export async function createCase(input: CreateCaseInput): Promise<Case> {
  const { data } = await apiClient.post('/cases', input);
  return data;
}

export async function confirmAgreement(caseId: string, documentPublicId: string): Promise<Case> {
  const { data } = await apiClient.patch(`/cases/${caseId}/confirm-agreement`, { documentPublicId });
  return data;
}
