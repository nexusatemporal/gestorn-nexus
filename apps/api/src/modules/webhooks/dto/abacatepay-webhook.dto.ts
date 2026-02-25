import { z } from 'zod';

/**
 * AbacatePay Webhook DTO
 *
 * Eventos suportados:
 * - billing.updated: Status do pagamento PIX atualizado
 * - billing.paid: Pagamento PIX confirmado
 * - billing.expired: Pagamento PIX expirado
 * - billing.refunded: Pagamento PIX estornado
 *
 * Referência: https://docs.abacatepay.com/webhooks
 */

const AbacatePayBillingSchema = z.object({
  id: z.string().uuid().describe('ID da cobrança no AbacatePay'),
  url: z.string().url().describe('URL da página de pagamento'),
  amount: z.number().positive('Valor deve ser positivo'),

  status: z.enum(['PENDING', 'PAID', 'EXPIRED', 'REFUNDED']),

  // Dados do PIX
  qrcode: z
    .object({
      qrcode: z.string().describe('Código PIX copia e cola'),
      pix_url: z.string().url().describe('URL da imagem do QR Code'),
    })
    .optional(),

  // Metadados
  metadata: z
    .object({
      payment_id: z.string().optional().describe('Nosso Payment ID interno'),
      client_id: z.string().optional(),
    })
    .optional(),

  // Timestamps
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  due_date: z.string().datetime().nullable(),
  paid_at: z.string().datetime().nullable(),
});

export const AbacatePayWebhookSchema = z.object({
  event: z.enum(['billing.updated', 'billing.paid', 'billing.expired', 'billing.refunded']),
  data: AbacatePayBillingSchema,
});

export type AbacatePayWebhookDto = z.infer<typeof AbacatePayWebhookSchema>;

/**
 * Mapeamento de status AbacatePay → PaymentStatus do Prisma
 */
export const AbacatePayStatusMap: Record<string, string> = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  EXPIRED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
};
