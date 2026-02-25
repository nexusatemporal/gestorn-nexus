import { z } from 'zod';
import { ProductType } from '@prisma/client';

/**
 * Schema Zod para criação de plano
 */
export const CreatePlanSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  code: z
    .string()
    .min(3, 'Código deve ter no mínimo 3 caracteres')
    .regex(/^[A-Z_]+$/, 'Código deve conter apenas letras maiúsculas e underscore')
    .transform((val) => val.toUpperCase()),
  product: z.nativeEnum(ProductType, {
    errorMap: () => ({ message: 'Produto inválido. Use ONE_NEXUS ou LOCADORAS' }),
  }),
  priceMonthly: z
    .number()
    .positive('Preço mensal deve ser positivo')
    .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais'),
  priceAnnual: z
    .number()
    .positive('Preço anual deve ser positivo')
    .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais'),
  setupFee: z
    .number()
    .nonnegative('Taxa de setup não pode ser negativa')
    .multipleOf(0.01, 'Taxa deve ter no máximo 2 casas decimais')
    .optional()
    .default(0),
  maxUsers: z
    .number()
    .int('Máximo de usuários deve ser inteiro')
    .positive('Máximo de usuários deve ser positivo')
    .optional()
    .default(5),
  maxUnits: z
    .number()
    .int('Máximo de unidades deve ser inteiro')
    .positive('Máximo de unidades deve ser positivo')
    .optional()
    .default(1),
  storageGb: z
    .number()
    .int('Storage deve ser inteiro')
    .positive('Storage deve ser positivo')
    .optional()
    .default(10),
  includedModules: z
    .array(z.string())
    .optional()
    .default([]),
  isActive: z.boolean().optional().default(true),
  isHighlighted: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
