import { apiClient } from './client';
import { DocumentSummary } from '../types';

export async function listDocuments(caseId: string): Promise<DocumentSummary[]> {
  const { data } = await apiClient.get('/documents', { params: { caseId } });
  return data;
}

/** The full document register across every case the current user can access. */
export async function listAllDocuments(): Promise<DocumentSummary[]> {
  const { data } = await apiClient.get('/documents');
  return data;
}

export async function uploadDocument(
  caseId: string,
  documentType: string,
  file: File,
  visibility?: string,
): Promise<DocumentSummary> {
  const formData = new FormData();
  formData.append('caseId', caseId);
  formData.append('documentType', documentType);
  if (visibility) formData.append('visibility', visibility);
  formData.append('file', file);

  const { data } = await apiClient.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function documentDownloadUrl(publicId: string): string {
  const base = apiClient.defaults.baseURL ?? '';
  return `${base}/documents/${publicId}`;
}
