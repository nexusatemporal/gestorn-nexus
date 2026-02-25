export type TransactionStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
export type TransactionCategory = 'SUBSCRIPTION' | 'SETUP' | 'SUPPORT' | 'CONSULTING' | 'OTHER';

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  SUBSCRIPTION: 'Assinatura', SETUP: 'Setup', SUPPORT: 'Suporte', CONSULTING: 'Consultoria', OTHER: 'Outros'
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  PAID: 'Pago', PENDING: 'Pendente', OVERDUE: 'Vencido', CANCELLED: 'Cancelado'
};

export const STATUS_COLORS: Record<TransactionStatus, string> = {
  PAID: 'bg-green-500/10 text-green-500 border-green-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  OVERDUE: 'bg-red-500/10 text-red-500 border-red-500/20',
  CANCELLED: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
};

export interface Transaction {
  id: string;
  description: string;
  client: string;
  clientContactName?: string | null; // v2.43.0: Nome do contato do cliente
  clientId: string | null;
  productType: 'ONE_NEXUS' | 'LOCADORAS' | null;
  productTypeLabel: string | null;
  vendedor: string | null;
  vendedorId: string | null;
  amount: number;
  amountFormatted: string;
  date: string;
  dateFormatted: string;
  dueDate: string | null;
  dueDateFormatted: string | null;
  status: TransactionStatus;
  statusLabel: string;
  statusColor: string;
  category: TransactionCategory;
  categoryLabel: string;
  isRecurring?: boolean;
}

export interface Metric {
  value: number;
  formatted: string;
  trend: string;
  up: boolean;
  ai?: boolean;
}

export interface MrrHistoryItem {
  name: string;
  expansion: number;
  new: number;
  churn: number;
}

export interface AgingReport {
  data: Array<{ range: string; value: number }>;
  total: number;
  totalFormatted: string;
}

export interface Client {
  id: string;
  company: string;
  contactName: string;
  productType: 'ONE_NEXUS' | 'LOCADORAS';
  status: string;
}

// v2.43.0: Interface de transação raw do backend (antes da formatação)
export interface FinanceTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: TransactionCategory;
  date: string;
  dueDate?: string | null; // v2.43.0: Data de vencimento
  paidAt?: string | null;
  status: TransactionStatus;
  clientId?: string | null;
  // v2.43.0: Dados do cliente para exibição
  client?: {
    id: string;
    company: string;
    contactName: string;
    productType: 'ONE_NEXUS' | 'LOCADORAS';
  } | null;
  productType?: 'ONE_NEXUS' | 'LOCADORAS' | null;
  isRecurring: boolean;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// v2.43.0: DTO para criação de transação
export interface CreateFinanceTransactionDto {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: TransactionCategory;
  date: string;
  dueDate?: string | null; // Obrigatório para SUBSCRIPTION
  status?: TransactionStatus;
  clientId?: string | null;
  productType?: 'ONE_NEXUS' | 'LOCADORAS' | null;
  isRecurring?: boolean;
  notes?: string | null;
}
