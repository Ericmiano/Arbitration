import { apiClient } from './client';
import { AppNotification } from '../types';

export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await apiClient.get('/notifications');
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}
