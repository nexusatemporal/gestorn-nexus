import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// ENUMS E LABELS (igual protótipo)
// ═══════════════════════════════════════════════════════════════

export const FinanceCategories = ['SUBSCRIPTION', 'SETUP', 'SUPPORT', 'CONSULTING', 'OTHER'] as const;
export const FinanceStatuses = ['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'] as const;

// Labels em português (igual protótipo linha 33, 166)
export const CATEGORY_LABELS = {
  SUBSCRIPTION: 'Assinatura',
  SETUP: 'Setup',
  SUPPORT: 'Suporte',
  CONSULTING: 'Consultoria',
  OTHER: 'Outros'
} as const;

export const STATUS_LABELS = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado'
} as const;

// Cores de status (igual protótipo linha 162)
export const STATUS_COLORS = {
  PAID: 'bg-green-500/10 text-green-500 border-green-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  OVERDUE: 'bg-red-500/10 text-red-500 border-red-500/20',
  CANCELLED: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
} as const;

// ═══════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════

// Base schema (sem refine para permitir .partial())
const baseTransactionSchema = z.object({
  description: z.string().min(1).max(300),
  amount: z.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.enum(FinanceCategories),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(FinanceStatuses).default('PENDING'),
  paidAt: z.coerce.date().optional().nullable(), // v2.44.0: Campo de data de pagamento
  clientId: z.string().cuid().optional().nullable(),
  productType: z.enum(['ONE_NEXUS', 'LOCADORAS']).optional().nullable(),
  isRecurring: z.boolean().default(false),
});

// v2.43.0: Validação condicional - dueDate obrigatório para SUBSCRIPTION recorrente
const dueDateRefine = (data: any) => {
  if (data.category === 'SUBSCRIPTION' && data.isRecurring) {
    return !!data.dueDate;
  }
  return true;
};

export const createTransactionSchema = baseTransactionSchema.refine(dueDateRefine, {
  message: 'Data de vencimento é obrigatória para assinaturas recorrentes',
  path: ['dueDate'],
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = baseTransactionSchema.partial().refine(dueDateRefine, {
  message: 'Data de vencimento é obrigatória para assinaturas recorrentes',
  path: ['dueDate'],
});

export type UpdateTransactionDto = z.infer<typeof updateTransactionSchema>;

export const transactionFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  category: z.enum(FinanceCategories).optional(),
  status: z.enum(FinanceStatuses).optional(),
  clientId: z.string().optional(),
  productType: z.enum(['ONE_NEXUS', 'LOCADORAS']).optional(),
  sortByDate: z.enum(['asc', 'desc']).optional(),
  sortByAmount: z.enum(['asc', 'desc']).optional(),
});

export type TransactionFiltersDto = z.infer<typeof transactionFiltersSchema>;
