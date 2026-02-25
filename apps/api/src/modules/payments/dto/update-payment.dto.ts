import { z } from 'zod';
import { CreatePaymentSchema } from './create-payment.dto';

/**
 * Schema Zod para atualização de pagamento
 *
 * REGRAS:
 * - Todos os campos são opcionais
 * - clientId não pode ser alterado (omitido)
 * - amount não pode ser alterado (omitido)
 * - Alterações geralmente vêm de webhooks
 */
export const UpdatePaymentSchema = CreatePaymentSchema.partial().omit({
  clientId: true,
  amount: true,
});

export type UpdatePaymentDto = z.infer<typeof UpdatePaymentSchema>;
