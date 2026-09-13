import { apiClient } from './client';

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  status: string;
  fullName: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function listUsers(): Promise<UserSummary[]> {
  const { data } = await apiClient.get('/users');
  return data;
}
