import { useApiQuery } from '@/hooks/useApi';
import { ProductType } from '@/types';

/**
 * Hook para buscar planos do backend
 *
 * @param productType - Tipo de produto (ONE_NEXUS ou LOCADORAS)
 * @returns Lista de planos filtrados por produto
 */
export interface Plan {
  id: string;
  name: string;
  code: string;
  product: ProductType;
  priceMonthly: number;
  priceAnnual: number;
  setupFee: number;
  maxUsers: number;
  maxUnits: number;
  storageGb: number;
  isActive: boolean;
}

export function usePlans(productType?: ProductType) {
  const endpoint = productType
    ? `/plans?product=${productType}&isActive=true`
    : '/plans?isActive=true';

  return useApiQuery<Plan[]>(
    ['plans', productType],
    endpoint,
    {
      staleTime: 5 * 60 * 1000, // 5 minutos (planos não mudam frequentemente)
      select: (data) =>
        data.map((plan: any) => ({
          ...plan,
          priceMonthly: Number(plan.priceMonthly),
          priceAnnual: Number(plan.priceAnnual),
          setupFee: Number(plan.setupFee),
          storageGb: Number(plan.storageGb),
        })),
    }
  );
}
