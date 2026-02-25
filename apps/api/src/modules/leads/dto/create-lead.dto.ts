import { z } from 'zod';
import { ProductType, LeadStatus, LeadOrigin, ClientRole } from '@prisma/client';

/**
 * Schema Zod para criação de lead
 *
 * REGRAS:
 * - Todos os campos são obrigatórios exceto instagram e facebook (redes sociais)
 * - vendedorId é obrigatório
 * - SUPERADMIN/ADMINISTRATIVO podem atribuir lead a qualquer vendedor
 * - GESTOR pode atribuir lead aos seus vendedores
 * - VENDEDOR cria lead para si mesmo (vendedorId é ignorado e substituído)
 */
export const CreateLeadSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Nome da empresa deve ter no mínimo 2 caracteres')
    .max(200, 'Nome da empresa deve ter no máximo 200 caracteres')
    .transform((val) => val.trim()),

  name: z
    .string()
    .min(3, 'Nome do contato deve ter no mínimo 3 caracteres')
    .max(100, 'Nome do contato deve ter no máximo 100 caracteres')
    .transform((val) => val.trim()),

  email: z
    .string()
    .email('Email inválido')
    .max(100)
    .toLowerCase()
    .transform((val) => val.trim()),

  phone: z
    .string()
    .min(10, 'Telefone deve ter no mínimo 10 caracteres')
    .max(15, 'Telefone deve ter no máximo 15 caracteres')
    .regex(
      /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/,
      'Telefone inválido. Formato esperado: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX',
    )
    .transform((val) => val.replace(/\D/g, '')), // ✅ v2.37.0: Salvar apenas números

  cpfCnpj: z
    .string()
    .min(11, 'CPF/CNPJ deve ter no mínimo 11 caracteres')
    .max(18, 'CPF/CNPJ deve ter no máximo 18 caracteres')
    .transform((val) => val.replace(/\D/g, '')), // ✅ v2.45.3: Remover formatação, salvar apenas números

  role: z.nativeEnum(ClientRole, {
    errorMap: () => ({
      message: 'Cargo inválido',
    }),
  }),

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
    .transform((val) => val.trim()),

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
  }),

  expectedRevenue: z
    .number()
    .positive('Valor esperado deve ser positivo')
    .multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais')
    .optional()
    .nullable(),

  status: z
    .nativeEnum(LeadStatus, {
      errorMap: () => ({
        message:
          'Status inválido. Valores aceitos: ABERTO, GANHO, PERDIDO',
      }),
    })
    .default(LeadStatus.ABERTO),

  // TEMPORARY: Accept both stageId (UUID) and stage name (auto-convert in service)
  stageId: z
    .string()
    .uuid('ID do estágio inválido')
    .optional(),

  // TEMPORARY: Accept origin name for backwards compatibility
  // Will be converted to originId in service layer
  origin: z
    .string()
    .min(3, 'Origem do lead é obrigatória'),

  originId: z
    .string()
    .min(1, 'ID da origem não pode ser vazio')
    .regex(
      /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,})$/i,
      'ID da origem deve ser UUID ou CUID válido'
    )
    .optional(),

  notes: z.string().max(5000, 'Notas devem ter no máximo 5000 caracteres').optional().nullable(),

  interestPlanId: z
    .string()
    .min(1, 'Plan ID não pode ser vazio')
    .regex(
      /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,}|plan-[a-z0-9-]+)$/i,
      'Plan ID deve ser UUID, CUID ou ID de seed válido'
    )
    .optional()
    .nullable(),

  vendedorId: z
    .string()
    .min(1, 'Vendedor ID não pode ser vazio')
    .regex(
      /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|c[a-z0-9]{10,}|user-[a-z0-9-]+)$/i,
      'Vendedor ID deve ser UUID, CUID ou ID de seed válido'
    )
    .optional()
    .nullable(),
});

// NOTA: Removido .refine() para origin/originId pois:
// 1. A validação é redundante (service já valida se origem existe)
// 2. Bloqueia a conversão automática de origin (nome) → originId (UUID)
// 3. O service layer faz essa conversão em leads.service.ts:147-158

export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;
