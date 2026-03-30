import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../services/notifications.api';
import { getAccessToken } from '@/services/api';

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

export const useNotificationsPage = (params: {
  page?: number;
  limit?: number;
  type?: string;
  isRead?: boolean;
  search?: string;
}) =>
  useQuery({
    queryKey: ['notifications', 'page', params],
    queryFn: () => notificationsApi.getAllPaginated(params),
    staleTime: 15_000,
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

/** SSE real-time stream — invalida cache ao receber evento */
export const useNotificationStream = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';
    const url = `${base}/notifications/stream?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);

    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [qc]);
};

export const usePreferences = () =>
  useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: notificationsApi.getPreferences,
    staleTime: 5 * 60_000,
  });

export const useUpdatePreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
  });
};

export const useMarkAsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useDeleteAllNotifications = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.removeAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useBroadcast = () =>
  useMutation({ mutationFn: notificationsApi.broadcast });

export { usePushNotifications } from './usePushNotifications';
