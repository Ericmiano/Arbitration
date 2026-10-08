import { apiClient } from './client';
import { Filing } from '../types';

export async function listFilings(caseId: string): Promise<Filing[]> {
  const { data } = await apiClient.get(`/cases/${caseId}/filings`);
  return data;
}

export interface CreateFilingInput {
  partyId?: number;
  filingType: string;
  title: string;
  description?: string;
  documentPublicIds?: string[];
}

export async function createFiling(caseId: string, input: CreateFilingInput): Promise<Filing> {
  const { data } = await apiClient.post(`/cases/${caseId}/filings`, input);
  return data;
}

export async function attachFilingDocument(
  filingId: string,
  documentPublicId: string,
  documentRole?: string,
): Promise<Filing> {
  const { data } = await apiClient.post(`/filings/${filingId}/documents`, { documentPublicId, documentRole });
  return data;
}

export async function decideFiling(
  filingId: string,
  status: 'accepted' | 'rejected',
  rejectionReason?: string,
): Promise<Filing> {
  const { data } = await apiClient.patch(`/filings/${filingId}`, { status, rejectionReason });
  return data;
}
