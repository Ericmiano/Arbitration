import { apiClient } from './client';
import { SessionUser } from '../types';

// The login response's `id` is the user's public_id (UUID), not the numeric
// session id `/auth/me` returns - so callers should re-fetch the current user
// afterwards rather than trust this return value as a SessionUser.
export async function login(email: string, password: string): Promise<{ email: string; role: string }> {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return { email: data.email, role: data.role };
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<SessionUser | null> {
  try {
    const { data } = await apiClient.get('/auth/me');
    return data;
  } catch {
    return null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

export async function updateProfile(fullName: string): Promise<void> {
  await apiClient.patch('/auth/profile', { fullName });
}
