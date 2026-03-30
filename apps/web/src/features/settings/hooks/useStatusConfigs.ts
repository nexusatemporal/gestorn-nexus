import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  statusConfigsApi,
  StatusEntity,
  CreateStatusConfigDto,
  UpdateStatusConfigDto,
} from '../api/status-configs.api';

const QUERY_KEY = ['status-configs'];

export const useStatusConfigs = (entity?: StatusEntity) => {
  return useQuery({
    queryKey: [...QUERY_KEY, entity],
    queryFn: () => statusConfigsApi.getAll(entity),
  });
};

export const useCreateStatusConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStatusConfigDto) => statusConfigsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Status criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao criar status');
    },
  });
};

export const useUpdateStatusConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStatusConfigDto }) =>
      statusConfigsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar status');
    },
  });
};

export const useDeleteStatusConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => statusConfigsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Status removido.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao remover status');
    },
  });
};
