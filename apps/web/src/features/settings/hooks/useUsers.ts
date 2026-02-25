import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, CreateUserDto, UpdateUserDto } from '../api/settings.api';

/**
 * Hook para listar usuários
 */
export const useUsers = (params?: { role?: string; isActive?: boolean }) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => settingsApi.getUsers(params),
  });
};

/**
 * Hook para buscar usuário específico
 */
export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => settingsApi.getUser(id),
    enabled: !!id,
  });
};

/**
 * Hook para buscar usuário logado
 */
export const useMe = () => {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => settingsApi.getMe(),
  });
};

/**
 * Hook para criar usuário
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateUserDto) => settingsApi.createUser(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Toast será adicionado quando sonner estiver disponível
    },
    onError: (error: any) => {
      console.error('Erro ao criar usuário:', error);
    },
  });
};

/**
 * Hook para atualizar usuário
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
      settingsApi.updateUser(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar usuário:', error);
    },
  });
};

/**
 * Hook para desativar usuário
 */
export const useDeactivateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settingsApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      console.error('Erro ao desativar usuário:', error);
    },
  });
};

/**
 * Hook para reativar usuário
 */
export const useRestoreUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settingsApi.restoreUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      console.error('Erro ao reativar usuário:', error);
    },
  });
};
