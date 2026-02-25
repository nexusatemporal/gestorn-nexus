import { z } from 'zod';
import { BillingCycle } from '@prisma/client';

export const convertLeadSchema = z.object({
  // Campos obrigatórios
  dealSummary: z
    .string()
    .min(10, 'Resumo da negociação deve ter pelo menos 10 caracteres')
    .max(2000, 'Resumo da negociação deve ter no máximo 2000 caracteres'),

  planId: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.string().min(3, 'ID do plano inválido'),
    ),

  billingCycle: z.nativeEnum(BillingCycle, {
    errorMap: () => ({ message: 'Ciclo de cobrança deve ser MONTHLY, QUARTERLY, SEMIANNUAL ou ANNUAL' }),
  }),

  numberOfUsers: z
    .number()
    .int('Número de usuários deve ser inteiro')
    .min(1, 'Número de usuários deve ser pelo menos 1')
    .max(1000, 'Número de usuários não pode exceder 1000'),

  closedAt: z
    .preprocess(
      (val) => {
        // Handle null/undefined/empty string
        if (val === '' || val === null || val === undefined) return undefined;

        // If it's already a Date object, check if valid
        if (val instanceof Date) {
          return isNaN(val.getTime()) ? undefined : val;
        }

        // If it's a string, validate it can create a valid Date
        if (typeof val === 'string') {
          const testDate = new Date(val);
          return isNaN(testDate.getTime()) ? undefined : val;
        }

        return val;
      },
      z.string().datetime('Data de fechamento inválida').or(z.date()).optional(),
    )
    .optional(),

  firstPaymentDate: z
    .preprocess(
      (val) => {
        // Handle null/undefined/empty string
        if (val === '' || val === null || val === undefined) return undefined;

        // If it's already a Date object, check if valid
        if (val instanceof Date) {
          return isNaN(val.getTime()) ? undefined : val;
        }

        // If it's a string, validate it can create a valid Date
        if (typeof val === 'string') {
          const testDate = new Date(val);
          return isNaN(testDate.getTime()) ? undefined : val;
        }

        return val;
      },
      z.string().datetime('Data do primeiro pagamento inválida').or(z.date()).optional(),
    )
    .optional(),

  // ✅ v2.46.0: Dia de vencimento fixo (1-28) - prioridade sobre firstPaymentDate
  billingAnchorDay: z
    .number()
    .int()
    .min(1, 'Dia de vencimento deve ser no mínimo 1')
    .max(28, 'Dia de vencimento deve ser no máximo 28')
    .optional(),

  // Campo opcional
  implementationNotes: z
    .string()
    .max(2000, 'Notas de implantação deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
});

export type ConvertLeadDto = z.infer<typeof convertLeadSchema>;

// DTO para geração de resumo com IA
export const generateSummarySchema = z.object({
  // Nenhum campo obrigatório - usa dados do lead
});

export type GenerateSummaryDto = z.infer<typeof generateSummarySchema>;
