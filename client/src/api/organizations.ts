import { apiClient } from './client';
import { Organization } from '../types';

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get('/organizations');
  return data;
}

export interface CreateOrganizationInput {
  name: string;
  registrationNumber?: string;
  address?: string;
  sector?: string;
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const { data } = await apiClient.post('/organizations', input);
  return data;
}
