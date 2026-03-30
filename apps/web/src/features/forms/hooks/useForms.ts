import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formsApi, CreateFormPayload } from '../services/forms.api';

export const useForms = () =>
  useQuery({
    queryKey: ['forms'],
    queryFn: formsApi.getAll,
  });

export const useForm = (id: string) =>
  useQuery({
    queryKey: ['forms', id],
    queryFn: () => formsApi.getById(id),
    enabled: !!id,
  });

export const useCreateForm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFormPayload) => formsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulário criado com sucesso!');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Erro ao criar formulário');
    },
  });
};

export const useUpdateForm = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateFormPayload>) => formsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['forms', id] });
      toast.success('Formulário salvo!');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Erro ao salvar formulário');
    },
  });
};

export const useDeleteForm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => formsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulário removido');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Erro ao remover formulário');
    },
  });
};

export const useFormSubmissions = (formId: string, page = 1, limit = 50) =>
  useQuery({
    queryKey: ['forms', formId, 'submissions', page],
    queryFn: () => formsApi.getSubmissions(formId, page, limit),
    enabled: !!formId,
  });
