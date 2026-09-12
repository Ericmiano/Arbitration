import { apiClient } from './client';
import { Project, Contract } from '../types';

export async function listProjects(): Promise<Project[]> {
  const { data } = await apiClient.get('/projects');
  return data;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  sector?: string;
  value?: number;
  currency: string;
  location?: string;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data } = await apiClient.post('/projects', input);
  return data;
}

export interface CreateContractInput {
  referenceNumber?: string;
  executionDate?: string;
  value?: number;
  currency: string;
  hasArbitrationClause: boolean;
  arbitrationClauseText?: string;
  governingLaw?: string;
  parties: Array<{ partyId: number; role: string }>;
}

export async function createContract(projectId: string, input: CreateContractInput): Promise<Contract> {
  const { data } = await apiClient.post(`/projects/${projectId}/contracts`, input);
  return data;
}
