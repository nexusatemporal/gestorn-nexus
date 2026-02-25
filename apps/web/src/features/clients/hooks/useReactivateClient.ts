import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { subscriptionsApi, ReactivateClientData } from '../api/subscriptions.api';

export function useReactivateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReactivateClientData) => subscriptionsApi.reactivate(data),
    onSuccess: (data: any) => {
      // Invalidar queries relevantes
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard

      console.log('✅ Cliente reativado com sucesso:', data.client?.company || 'Cliente');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Erro ao reativar cliente';
      console.error('❌ Erro ao reativar cliente:', message);
      alert(`Erro: ${message}`);
    },
  });
}

export function useSubscriptions(clientId: string) {
  return useQuery({
    queryKey: ['subscriptions', clientId],
    queryFn: () => subscriptionsApi.getByClient(clientId),
    enabled: !!clientId,
  });
}

export function useActiveSubscription(clientId: string) {
  return useQuery({
    queryKey: ['subscriptions', clientId, 'active'],
    queryFn: () => subscriptionsApi.getActive(clientId),
    enabled: !!clientId,
  });
}
