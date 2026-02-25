import { z } from 'zod';
import { PaymentStatus, PaymentMethod, BillingCycle, PaymentGateway } from '@prisma/client';

/**
 * Schema Zod para criação de pagamento
 *
 * REGRAS:
 * - clientId é obrigatório
 * - Pagamentos são geralmente criados automaticamente pelo sistema/webhooks
 * - Este DTO é para criação manual por admins
 */
export const CreatePaymentSchema = z.object({
  clientId: z.string().uuid('Client ID inválido'),

  amount: z
    .number()
    .positive('Valor deve ser positivo')
    .multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais'),

  dueDate: z
    .string()
    .datetime('Data de vencimento inválida')
    .transform((val) => new Date(val)),

  status: z
    .nativeEnum(PaymentStatus, {
      errorMap: () => ({
        message: 'Status inválido. Valores aceitos: PENDING, PAID, OVERDUE, CANCELLED, REFUNDED',
      }),
    })
    .default(PaymentStatus.PENDING),

  method: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({
      message: 'Método inválido. Valores aceitos: PIX, CARTAO, BOLETO, TRANSFERENCIA',
    }),
  }),

  // Ciclo de cobrança
  billingCycle: z.nativeEnum(BillingCycle, {
    errorMap: () => ({
      message: 'Ciclo de cobrança inválido. Valores aceitos: MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL',
    }),
  }),

  periodStart: z
    .string()
    .datetime('Data de início do período inválida')
    .transform((val) => new Date(val)),

  periodEnd: z
    .string()
    .datetime('Data de fim do período inválida')
    .transform((val) => new Date(val)),

  // Identificadores externos (gateways)
  externalId: z.string().max(200).optional().nullable(),

  gateway: z.nativeEnum(PaymentGateway, {
    errorMap: () => ({
      message: 'Gateway inválido. Valores aceitos: ASAAS, ABACATEPAY, MANUAL',
    }),
  }),

  // Datas de pagamento/cancelamento
  paidAt: z
    .string()
    .datetime('Data de pagamento inválida')
    .transform((val) => new Date(val))
    .optional()
    .nullable(),

  cancelledAt: z
    .string()
    .datetime('Data de cancelamento inválida')
    .transform((val) => new Date(val))
    .optional()
    .nullable(),

  // Campos opcionais
  description: z.string().max(500).optional().nullable(),

  notes: z.string().max(2000).optional().nullable(),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;
