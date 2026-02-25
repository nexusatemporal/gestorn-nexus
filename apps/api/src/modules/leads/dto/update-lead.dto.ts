import { z } from 'zod';
import { ProductType, LeadStatus, ClientRole } from '@prisma/client';

/**
 * Schema Zod para atualização de lead
 *
 * REGRAS:
 * - Todos os campos são opcionais (atualização parcial)
 * - vendedorId pode ser alterado apenas por SUPERADMIN/ADMINISTRATIVO/GESTOR
 * - VENDEDOR pode alterar apenas status, notes e campos de contato
 */
export const UpdateLeadSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Nome da empresa deve ter no mínimo 2 caracteres')
    .max(200, 'Nome da empresa deve ter no máximo 200 caracteres')
    .transform((val) => val.trim())
    .optional()
    .nullable(),

  name: z
    .string()
    .min(3, 'Nome do contato deve ter no mínimo 3 caracteres')
    .max(100, 'Nome do contato deve ter no máximo 100 caracteres')
    .transform((val) => val.trim())
    .optional(),

  email: z
    .string()
    .email('Email inválido')
    .max(100)
    .toLowerCase()
    .transform((val) => val.trim())
    .optional(),

  phone: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z
        .string()
        .min(10, 'Telefone deve ter no mínimo 10 caracteres')
        .max(20, 'Telefone deve ter no máximo 20 caracteres')
        .regex(
          /^(\(\d{2}\)\s?\d{4,5}-?\d{4}|\d{10,11})$/,
          'Telefone inválido. Formatos aceitos: (XX) XXXXX-XXXX ou 10-11 dígitos',
        )
        .transform((val) => val.replace(/\D/g, '')), // ✅ v2.37.0: Salvar apenas números
    )
    .optional(),

  cpfCnpj: z
    .string()
    .min(11, 'CPF/CNPJ deve ter no mínimo 11 caracteres')
    .max(18, 'CPF/CNPJ deve ter no máximo 18 caracteres')
    .transform((val) => val.replace(/\D/g, '')) // ✅ v2.45.3: Remover formatação, salvar apenas números
    .optional()
    .nullable(),

  role: z.nativeEnum(ClientRole, {
    errorMap: () => ({
      message: 'Cargo inválido',
    }),
  }).optional(),

  instagram: z
    .string()
    .max(100, 'Instagram deve ter no máximo 100 caracteres')
    .transform((val) => val.trim())
    .optional()
    .nullable(),

  facebook: z
    .string()
    .max(100, 'Facebook deve ter no máximo 100 caracteres')
    .transform((val) => val.trim())
    .optional()
    .nullable(),

  city: z
    .string()
    .min(3, 'Cidade deve ter no mínimo 3 caracteres')
    .max(100, 'Cidade deve ter no máximo 100 caracteres')
    .transform((val) => val.trim())
    .optional()
    .nullable(),

  numberOfUnits: z
    .number()
    .int('Número de unidades deve ser inteiro')
    .positive('Número de unidades deve ser positivo')
    .optional()
    .nullable(),

  interestProduct: z.nativeEnum(ProductType, {
    errorMap: () => ({
      message: 'Tipo de produto inválido. Valores aceitos: ONE_NEXUS, LOCADORAS',
    }),
  }).optional(),

  expectedRevenue: z
    .number()
    .positive('Valor esperado deve ser positivo')
    .multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais')
    .optional()
    .nullable(),

  status: z
    .string()
    .optional(), // Validação no service layer (converte EM_CONTATO→stageId)

  stageId: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z
        .string()
        .min(1, 'ID do estágio não pode ser vazio')
        .regex(
          /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,})$/i,
          'ID do estágio deve ser UUID ou CUID válido'
        )
        .optional(),
    )
    .optional(),

  origin: z
    .string()
    .optional(),

  originId: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z
        .string()
        .min(1, 'ID da origem não pode ser vazio')
        .regex(
          /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,})$/i,
          'ID da origem deve ser UUID ou CUID válido'
        )
        .optional(),
    )
    .optional(),

  notes: z.string().max(5000, 'Notas devem ter no máximo 5000 caracteres').optional().nullable(),

  interestPlanId: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z
        .string()
        .min(1, 'Plan ID não pode ser vazio')
        .regex(
          /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,}|plan-[a-z0-9-]+)$/i,
          'Plan ID deve ser UUID, CUID ou ID de seed válido'
        )
        .optional()
        .nullable(),
    )
    .optional()
    .nullable(),

  vendedorId: z
    .preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z
        .string()
        .min(1, 'Vendedor ID não pode ser vazio')
        .regex(
          /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,}|user-[a-z0-9-]+)$/i,
          'Vendedor ID deve ser UUID, CUID ou ID de seed válido'
        )
        .optional()
        .nullable(),
    )
    .optional()
    .nullable(),
});

export type UpdateLeadDto = z.infer<typeof UpdateLeadSchema>;
