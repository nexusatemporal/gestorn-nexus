import { api } from '@/services/api';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPage {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export interface NotificationPreferences {
  [type: string]: { inApp: boolean; email: boolean; push: boolean };
}

export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    const { data } = await api.get('/notifications');
    return data;
  },

  getAllPaginated: async (params: {
    page?: number;
    limit?: number;
    type?: string;
    isRead?: boolean;
    search?: string;
  }): Promise<NotificationPage> => {
    const { data } = await api.get('/notifications', { params: { ...params, page: params.page ?? 1 } });
    return data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const { data } = await api.get('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all');
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },

  removeAll: async (): Promise<void> => {
    await api.delete('/notifications/all');
  },

  broadcast: async (body: {
    title: string;
    message: string;
    link?: string;
    targetRoles?: string[];
  }): Promise<{ count: number }> => {
    const { data } = await api.post('/notifications/broadcast', body);
    return data;
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    const { data } = await api.get('/notifications/preferences');
    return data;
  },

  updatePreferences: async (
    prefs: Array<{ type: string; inApp: boolean; email: boolean; push: boolean }>,
  ): Promise<NotificationPreferences> => {
    const { data } = await api.put('/notifications/preferences', prefs);
    return data;
  },
};
