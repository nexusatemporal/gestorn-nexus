import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../services/finance.api';

export const useMetrics = (productType?: string) => useQuery({
  queryKey: ['finance', 'metrics', productType],
  queryFn: () => financeApi.getMetrics(productType),
});
export const useMrrHistory = (m = 6, productType?: string) => useQuery({
  queryKey: ['finance', 'mrr', m, productType],
  queryFn: () => financeApi.getMrrHistory(m, productType),
});
export const useArrHistory = (productType?: string) => useQuery({
  queryKey: ['finance', 'arr', productType],
  queryFn: () => financeApi.getArrHistory(productType),
});
export const useAgingReport = (productType?: string) => useQuery({
  queryKey: ['finance', 'aging', productType],
  queryFn: () => financeApi.getAgingReport(productType),
});
export const useTransactions = (f?: any) => useQuery({ queryKey: ['finance', 'transactions', f], queryFn: () => financeApi.getTransactions(f) });
export const useClientTransactions = (clientId: string | null) => useQuery({
  queryKey: ['finance', 'client', clientId],
  queryFn: () => financeApi.getClientTransactions(clientId!),
  enabled: !!clientId,
});
export const useOverdueClients = () => useQuery({ queryKey: ['finance', 'overdue'], queryFn: financeApi.getOverdueClients });
export const useUpcomingDueDates = () => useQuery({ queryKey: ['finance', 'upcoming'], queryFn: financeApi.getUpcomingDueDates });

export const useCreateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.createTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] }); // v2.44.0: Sync bidirecional
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard
    },
    onError: (e: any) => console.error('Erro ao criar transação:', e.response?.data?.message || 'Erro'),
  });
};

export const useMarkAsPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.markAsPaid,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] }); // v2.44.0: Sync bidirecional
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard
    },
  });
};

export const useUpdateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financeApi.updateTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] }); // v2.44.0: Sync bidirecional
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard
    },
    onError: (e: any) => console.error('Erro ao atualizar transação:', e.response?.data?.message || 'Erro'),
  });
};

export const useDeleteTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] }); // v2.44.0: Sync bidirecional
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard
    },
  });
};

export const useClients = () => useQuery({ queryKey: ['clients'], queryFn: financeApi.getClients });

export const useImportPdf = () => {
  return useMutation({
    mutationFn: financeApi.importPdf,
    onError: (e: any) => console.error('Erro ao importar PDF:', e.response?.data?.message || 'Erro'),
  });
};
