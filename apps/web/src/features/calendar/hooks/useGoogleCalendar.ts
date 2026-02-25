/**
 * Google Calendar Integration Hooks
 * React Query hooks para integração com Google Calendar
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '@/services/api';
import type {
  GoogleCalendarStatus,
  GoogleSyncResponse,
} from '../types/calendar.types';
import { calendarKeys } from './useCalendarEvents';

// ──────────────────────────────────────────────────────────────────────────
// Query Keys
// ──────────────────────────────────────────────────────────────────────────

export const googleCalendarKeys = {
  all: ['google-calendar'] as const,
  status: () => [...googleCalendarKeys.all, 'status'] as const,
  authUrl: () => [...googleCalendarKeys.all, 'auth-url'] as const,
};

// ──────────────────────────────────────────────────────────────────────────
// Query: Status da Conexão
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para verificar status da conexão com Google Calendar
 *
 * @example
 * ```tsx
 * const { data: status, isLoading } = useGoogleCalendarStatus();
 *
 * if (status?.isConnected) {
 *   console.log('Conectado ao Google Calendar');
 * }
 * ```
 */
export function useGoogleCalendarStatus() {
  return useQuery<GoogleCalendarStatus, AxiosError>({
    queryKey: googleCalendarKeys.status(),
    queryFn: async () => {
      const { data } = await api.get<GoogleCalendarStatus>('/calendar/google/status');
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: true,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Query: Gerar URL de Autorização
// ──────────────────────────────────────────────────────────────────────────

interface AuthUrlResponse {
  authUrl: string;
  message: string;
}

/**
 * Hook para obter URL de autorização OAuth2 do Google
 *
 * @example
 * ```tsx
 * const { refetch: getAuthUrl } = useGoogleAuthUrl();
 *
 * const handleConnect = async () => {
 *   const { data } = await getAuthUrl();
 *   window.open(data.authUrl, '_blank', 'width=600,height=700');
 * };
 * ```
 */
export function useGoogleAuthUrl() {
  return useQuery<AuthUrlResponse, AxiosError>({
    queryKey: googleCalendarKeys.authUrl(),
    queryFn: async () => {
      const { data } = await api.get<AuthUrlResponse>('/calendar/google/auth-url');
      return data;
    },
    enabled: false, // Não buscar automaticamente, apenas via refetch
    staleTime: 0, // Sempre gerar nova URL
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Mutation: Sincronizar do Google Calendar
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para sincronizar eventos do Google Calendar para o Nexus
 *
 * @example
 * ```tsx
 * const syncFromGoogle = useGoogleSync();
 *
 * const handleSync = async () => {
 *   await syncFromGoogle.mutateAsync({});
 * };
 * ```
 */
export function useGoogleSync() {
  const queryClient = useQueryClient();

  return useMutation<GoogleSyncResponse, AxiosError, void>({
    mutationFn: async () => {
      const { data } = await api.post<GoogleSyncResponse>('/calendar/google/sync');
      return data;
    },
    onSuccess: () => {
      // Invalidar lista de eventos para refletir novos eventos importados
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Mutation: Desconectar Google Calendar
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para desconectar Google Calendar (remove tokens)
 *
 * @example
 * ```tsx
 * const disconnect = useGoogleDisconnect();
 *
 * const handleDisconnect = async () => {
 *   await disconnect.mutateAsync();
 * };
 * ```
 */
export function useGoogleDisconnect() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, AxiosError, void>({
    mutationFn: async () => {
      const { data } = await api.delete<{ message: string }>('/calendar/google/disconnect');
      return data;
    },
    onSuccess: () => {
      // Atualizar status para desconectado
      queryClient.invalidateQueries({ queryKey: googleCalendarKeys.status() });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Utilitário: Abrir popup OAuth2
// ──────────────────────────────────────────────────────────────────────────

/**
 * Abre popup para autorização OAuth2 do Google
 *
 * @param authUrl URL de autorização gerada pelo backend
 * @param onSuccess Callback chamado quando autorização é concluída com sucesso
 * @param onError Callback chamado quando autorização falha
 *
 * @example
 * ```tsx
 * const { refetch: getAuthUrl } = useGoogleAuthUrl();
 *
 * const handleConnect = async () => {
 *   const { data } = await getAuthUrl();
 *   openGoogleAuthPopup(data.authUrl, {
 *     onSuccess: () => console.log('Conectado!'),
 *     onError: () => console.log('Erro ao conectar'),
 *   });
 * };
 * ```
 */
export function openGoogleAuthPopup(
  authUrl: string,
  callbacks?: {
    onSuccess?: () => void;
    onError?: () => void;
  }
) {
  const popup = window.open(
    authUrl,
    'Google Calendar Authorization',
    'width=600,height=700,left=200,top=100'
  );

  if (!popup) {
    alert('Por favor, permita popups para conectar ao Google Calendar');
    return;
  }

  // Monitorar URL do popup para detectar sucesso/erro
  const checkPopup = setInterval(() => {
    try {
      if (popup.closed) {
        clearInterval(checkPopup);
        return;
      }

      // Verificar se URL contém parâmetros de sucesso/erro
      const popupUrl = popup.location.href;

      if (popupUrl.includes('google_sync=success')) {
        clearInterval(checkPopup);
        popup.close();
        callbacks?.onSuccess?.();
      } else if (popupUrl.includes('google_sync=error')) {
        clearInterval(checkPopup);
        popup.close();
        callbacks?.onError?.();
      }
    } catch (error) {
      // Ignorar erros de cross-origin (enquanto ainda está no Google)
    }
  }, 500);

  // Timeout de 5 minutos
  setTimeout(() => {
    clearInterval(checkPopup);
    if (!popup.closed) {
      popup.close();
    }
  }, 5 * 60 * 1000);
}
