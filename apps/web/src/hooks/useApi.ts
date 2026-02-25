import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '@/services/api';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * API HOOKS - React Query Wrappers
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Hooks tipados para facilitar uso de React Query com a API.
 *
 * USAGE:
 * ```tsx
 * const { data, isLoading } = useApiQuery(['users'], '/users');
 * const mutation = useApiMutation('/users', { method: 'POST' });
 * ```
 */

// ──────────────────────────────────────────────────────────────────────────
// useApiQuery - GET requests
// ──────────────────────────────────────────────────────────────────────────

export function useApiQuery<T>(
  queryKey: unknown[],
  endpoint: string,
  options?: Omit<UseQueryOptions<T, AxiosError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, AxiosError>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<T>(endpoint);
      return data;
    },
    ...options,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// useApiMutation - POST/PUT/DELETE requests
// ──────────────────────────────────────────────────────────────────────────

interface ApiMutationOptions {
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export function useApiMutation<TData, TVariables>(
  endpoint: string,
  { method = 'POST' }: ApiMutationOptions = {},
  options?: UseMutationOptions<TData, AxiosError, TVariables>
) {
  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables) => {
      const { data } = await api.request<TData>({
        method,
        url: endpoint,
        data: variables,
      });
      return data;
    },
    ...options,
  });
}
