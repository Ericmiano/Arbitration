import { apiClient } from './client';
import { Tribunal, TribunalMember, TribunalMemberRole, TribunalType } from '../types';

export async function createTribunal(caseId: string, tribunalType: TribunalType): Promise<Tribunal> {
  const { data } = await apiClient.post(`/cases/${caseId}/tribunal`, { tribunalType });
  return data;
}

export async function getTribunal(caseId: string): Promise<Tribunal[]> {
  const { data } = await apiClient.get(`/cases/${caseId}/tribunal`);
  return data;
}

export async function appointMember(
  tribunalId: string,
  arbitratorId: string,
  role?: TribunalMemberRole,
): Promise<TribunalMember> {
  const { data } = await apiClient.post(`/tribunals/${tribunalId}/members`, { arbitratorId, role });
  return data;
}

export async function withdrawMember(
  tribunalId: string,
  memberId: string,
  reason: string,
  status: 'withdrawn' | 'recused' | 'removed',
): Promise<void> {
  await apiClient.post(`/tribunals/${tribunalId}/members/${memberId}/withdraw`, { reason, status });
}

export interface ConcludeCaseInput {
  outcome: 'award_issued' | 'settled' | 'withdrawn';
  outcomeDetail?: string;
  awardChallenged?: boolean;
}

export async function concludeCase(caseId: string, input: ConcludeCaseInput): Promise<void> {
  await apiClient.post(`/cases/${caseId}/conclude`, input);
}
