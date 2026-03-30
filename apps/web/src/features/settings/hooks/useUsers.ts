import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
      toast.success('Usuário criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao criar usuário');
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
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar usuário');
    },
  });
};

/**
 * Hook para excluir usuário permanentemente
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído permanentemente.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao excluir usuário');
    },
  });
};

/**
 * Hook para reenviar email de boas-vindas
 */
export const useResendEmail = () => {
  return useMutation({
    mutationFn: (id: string) => settingsApi.resendEmail(id),
    onSuccess: () => {
      toast.success('Email de boas-vindas reenviado!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao reenviar email');
    },
  });
};

/**
 * Hook para atualizar perfil do usuário logado
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateUserDto) => settingsApi.updateProfile(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar perfil');
    },
  });
};

/**
 * Hook para alterar senha
 */
export const useChangePassword = () => {
  return useMutation({
    mutationFn: ({ id, currentPassword, newPassword }: { id: string; currentPassword: string; newPassword: string }) =>
      settingsApi.changePassword(id, currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao alterar senha');
    },
  });
};
