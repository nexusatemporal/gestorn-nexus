import { useApiQuery } from '@/hooks/useApi';
import type { ClientDetail } from '@/types';

/**
 * Hook para buscar dados completos de um cliente (GET /clients/:id).
 * Retorna plan completo, paymentMethod, dealSummary, etc.
 * Usado pela aba Contrato do ClientDetailModal.
 */
export function useClientDetail(clientId: string) {
  return useApiQuery<ClientDetail>(
    ['clients', clientId, 'detail'],
    `/clients/${clientId}`,
    {
      enabled: !!clientId,
      staleTime: 2 * 60 * 1000, // 2 minutos
      select: (data: any) => ({
        ...data,
        plan: data.plan
          ? {
              ...data.plan,
              priceMonthly: Number(data.plan.priceMonthly),
              priceAnnual: Number(data.plan.priceAnnual),
              setupFee: Number(data.plan.setupFee),
            }
          : undefined,
      }),
    }
  );
}
