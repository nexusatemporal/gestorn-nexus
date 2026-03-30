import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Transação criada com sucesso!');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao criar transação'),
  });
};

export const useMarkAsPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.markAsPaid,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Transação marcada como paga!');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao marcar como paga'),
  });
};

export const useUpdateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => financeApi.updateTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Transação atualizada!');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao atualizar transação'),
  });
};

export const useDeleteTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: financeApi.deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Transação removida.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao remover transação'),
  });
};

export const useClients = () => useQuery({ queryKey: ['clients'], queryFn: financeApi.getClients });

export const useImportPdf = () => {
  return useMutation({
    mutationFn: financeApi.importPdf,
    onError: (e: any) => console.error('Erro ao importar PDF:', e.response?.data?.message || 'Erro'),
  });
};
