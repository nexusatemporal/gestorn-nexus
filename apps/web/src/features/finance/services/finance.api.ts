import { api } from '@/services/api';
import type { Transaction, Metric, MrrHistoryItem, AgingReport, Client } from '../types';

export const financeApi = {
  getMetrics: async (productType?: string) => {
    const { data } = await api.get<{ data: Record<string, Metric> }>('/finance/metrics', {
      params: productType ? { productType } : undefined,
    });
    return data.data;
  },
  getMrrHistory: async (months = 6, productType?: string) => {
    const { data } = await api.get<{ data: MrrHistoryItem[] }>('/finance/mrr-history', {
      params: { months, ...(productType && { productType }) },
    });
    return data.data;
  },
  getArrHistory: async (productType?: string) => {
    const { data } = await api.get<{ data: Array<{ name: string; arr: number }> }>('/finance/arr-history', {
      params: productType ? { productType } : undefined,
    });
    return data.data;
  },
  getAgingReport: async (productType?: string) => {
    const { data } = await api.get<{ data: AgingReport }>('/finance/aging-report', {
      params: productType ? { productType } : undefined,
    });
    return data.data;
  },
  getTransactions: async (filters?: any) => {
    const { data } = await api.get<{ data: Transaction[] }>('/finance/transactions', { params: filters });
    return data.data;
  },
  getClientTransactions: async (clientId: string) => {
    const { data } = await api.get<{ data: any }>(`/finance/client/${clientId}/transactions`);
    return data.data;
  },
  getOverdueClients: async () => {
    const { data } = await api.get<{ data: any[] }>('/finance/overdue');
    return data.data;
  },
  getUpcomingDueDates: async () => {
    const { data } = await api.get<{ data: any[] }>('/finance/upcoming');
    return data.data;
  },
  createTransaction: async (payload: any) => {
    const { data } = await api.post<{ data: Transaction; message: string }>('/finance/transactions', payload);
    return data;
  },
  updateTransaction: async (id: string, payload: any) => {
    const { data } = await api.patch<{ data: Transaction; message: string }>(`/finance/transactions/${id}`, payload);
    return data;
  },
  markAsPaid: async (id: string) => {
    const { data } = await api.patch<{ data: Transaction; message: string }>(`/finance/transactions/${id}/pay`);
    return data;
  },
  deleteTransaction: async (id: string) => {
    const { data } = await api.delete<{ message: string }>(`/finance/transactions/${id}`);
    return data;
  },
  getClients: async () => {
    const { data } = await api.get<{ data: Client[] }>('/clients', {
      params: { status: 'ATIVO' }
    });
    return data.data;
  },
  importPdf: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<{ data: { extracted: number; transactions: any[]; message: string } }>('/finance/import-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data.data;
  },
};
