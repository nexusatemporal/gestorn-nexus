import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { plansAdminApi, CreatePlanDto, UpdatePlanDto } from '../api/plans-admin.api';
import type { ModuleTree } from '../api/plans-admin.api';

const QUERY_KEY = ['plans-admin'];

export const usePlans = (params?: { product?: string; isActive?: boolean }) => {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => plansAdminApi.getAll(params),
  });
};

export const useModulesCatalog = () => {
  return useQuery<ModuleTree[]>({
    queryKey: ['modules-catalog'],
    queryFn: () => plansAdminApi.getModulesCatalog(),
    staleTime: 5 * 60 * 1000, // 5 minutos — catálogo muda raramente
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePlanDto) => plansAdminApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Plano criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao criar plano');
    },
  });
};

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanDto }) =>
      plansAdminApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Plano atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar plano');
    },
  });
};

export const useDeactivatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansAdminApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Plano desativado.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao desativar plano');
    },
  });
};

export const useRestorePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansAdminApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Plano reativado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao reativar plano');
    },
  });
};
