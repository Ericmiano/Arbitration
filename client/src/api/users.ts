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

export async function createUser(input: {
  email: string;
  fullName: string;
  role: 'admin' | 'registrar' | 'staff';
}): Promise<UserSummary> {
  const { data } = await apiClient.post('/users', input);
  return data;
}

export async function updateUser(
  userId: string,
  input: { role?: string; status?: string },
): Promise<{ id: string; role: string; status: string }> {
  const { data } = await apiClient.patch(`/users/${userId}`, input);
  return data;
}
