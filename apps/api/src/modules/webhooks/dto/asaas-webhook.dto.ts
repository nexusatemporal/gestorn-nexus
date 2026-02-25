import { z } from 'zod';

/**
 * Asaas Webhook DTO
 *
 * Eventos suportados:
 * - PAYMENT_CREATED: Cobrança criada
 * - PAYMENT_AWAITING_PAYMENT: Aguardando pagamento
 * - PAYMENT_RECEIVED: Pagamento confirmado
 * - PAYMENT_CONFIRMED: Pagamento compensado
 * - PAYMENT_OVERDUE: Cobrança vencida
 * - PAYMENT_REFUNDED: Pagamento estornado
 * - PAYMENT_DELETED: Cobrança removida
 *
 * Referência: https://docs.asaas.com/reference/webhooks
 */

const AsaasPaymentSchema = z.object({
  id: z.string().describe('ID da cobrança no Asaas'),
  customer: z.string().describe('ID do cliente no Asaas'),
  value: z.number().positive('Valor deve ser positivo'),
  netValue: z.number().describe('Valor líquido (descontando taxas)'),
  originalValue: z.number().optional(),

  status: z.enum([
    'PENDING',
    'RECEIVED',
    'CONFIRMED',
    'OVERDUE',
    'REFUNDED',
    'RECEIVED_IN_CASH',
    'REFUND_REQUESTED',
  ]),

  billingType: z.enum(['BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'UNDEFINED']),

  dueDate: z.string().describe('Data de vencimento (YYYY-MM-DD)'),
  paymentDate: z.string().nullable().describe('Data do pagamento'),
  confirmedDate: z.string().nullable().describe('Data de confirmação'),

  invoiceUrl: z.string().url().nullable(),
  bankSlipUrl: z.string().url().nullable(),
  transactionReceiptUrl: z.string().url().nullable(),

  externalReference: z.string().optional().describe('Referência externa (nosso Payment ID)'),

  description: z.string().optional(),
});

export const AsaasWebhookSchema = z.object({
  event: z.enum([
    'PAYMENT_CREATED',
    'PAYMENT_AWAITING_PAYMENT',
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_OVERDUE',
    'PAYMENT_REFUNDED',
    'PAYMENT_DELETED',
  ]),
  payment: AsaasPaymentSchema,
});

export type AsaasWebhookDto = z.infer<typeof AsaasWebhookSchema>;

/**
 * Mapeamento de status Asaas → PaymentStatus do Prisma
 */
export const AsaasStatusMap: Record<string, string> = {
  PENDING: 'PENDING',
  RECEIVED: 'PAID',
  CONFIRMED: 'PAID',
  OVERDUE: 'OVERDUE',
  REFUNDED: 'REFUNDED',
  RECEIVED_IN_CASH: 'PAID',
};
