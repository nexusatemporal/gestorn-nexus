import { z } from 'zod';
import { ProductType, ClientStatus, BillingCycle, ClientRole } from '@prisma/client';

/**
 * Schema Zod para criação de cliente
 *
 * REGRAS:
 * - Pode ser criado a partir de um Lead convertido (leadId opcional)
 * - planId é obrigatório (cliente sempre tem um plano)
 * - vendedorId é obrigatório
 * - SUPERADMIN/ADMINISTRATIVO podem atribuir a qualquer vendedor
 * - GESTOR pode atribuir aos seus vendedores
 * - VENDEDOR cria para si mesmo
 */
export const CreateClientSchema = z.object({
  company: z
    .string()
    .min(2, 'Nome da empresa deve ter no mínimo 2 caracteres')
    .max(200, 'Nome da empresa deve ter no máximo 200 caracteres')
    .transform((val) => val.trim()),

  contactName: z
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
    .min(10, 'Telefone inválido')
    .max(20, 'Telefone inválido')
    .transform((val) => val.replace(/\D/g, '')), // ✅ v2.45.3: Remover formatação, salvar apenas números

  cpfCnpj: z
    .string()
    .regex(/^\d{11}|\d{14}$/, 'CPF/CNPJ deve conter 11 ou 14 dígitos')
    .transform((val) => val.replace(/\D/g, '')), // Remove caracteres não numéricos

  role: z
    .nativeEnum(ClientRole, {
      errorMap: () => ({
        message: 'Cargo inválido',
      }),
    })
    .optional()
    .nullable(),

  productType: z.nativeEnum(ProductType, {
    errorMap: () => ({
      message: 'Tipo de produto inválido. Valores aceitos: ONE_NEXUS, LOCADORAS',
    }),
  }),

  planId: z.string().min(1, 'Plan ID é obrigatório'), // ✅ v2.42.0: Aceitar IDs customizados (não apenas UUID)

  billingCycle: z
    .nativeEnum(BillingCycle, {
      errorMap: () => ({
        message: 'Ciclo de cobrança inválido. Valores aceitos: MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL',
      }),
    })
    .default(BillingCycle.MONTHLY),

  vendedorId: z.string().uuid('Vendedor ID inválido').optional(), // ✅ v2.45.0: Auto-atribuir se não fornecido

  status: z
    .nativeEnum(ClientStatus, {
      errorMap: () => ({
        message: 'Status inválido. Valores aceitos: EM_TRIAL, ATIVO, SUSPENSO, CANCELADO, INADIMPLENTE',
      }),
    })
    .default(ClientStatus.EM_TRIAL),

  // Campos de conversão
  numberOfUsers: z
    .number()
    .int('Número de unidades deve ser inteiro')
    .positive('Número de unidades deve ser positivo')
    .default(1),

  firstPaymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do primeiro pagamento inválida (formato: YYYY-MM-DD)')
    .transform((val) => new Date(`${val}T12:00:00.000Z`)) // ✅ v2.45.0: Converte date para datetime
    .optional()
    .nullable(),

  // ✅ v2.46.0: Dia de vencimento fixo (1-28) - prioridade sobre firstPaymentDate
  billingAnchorDay: z
    .number()
    .int()
    .min(1, 'Dia de vencimento deve ser no mínimo 1')
    .max(28, 'Dia de vencimento deve ser no máximo 28')
    .optional(),

  // ✅ v2.45.0: Campos de handoff (Sales → CS/Implantação) - alinhado com conversão de Lead
  dealSummary: z
    .string()
    .max(5000, 'Resumo do deal deve ter no máximo 5000 caracteres')
    .optional()
    .nullable(),

  closedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de fechamento inválida (formato: YYYY-MM-DD)')
    .transform((val) => new Date(`${val}T12:00:00.000Z`))
    .optional()
    .nullable(),

  implementationNotes: z
    .string()
    .max(5000, 'Notas de implementação devem ter no máximo 5000 caracteres')
    .optional()
    .nullable(),

  convertedFromLeadId: z.string().uuid('Lead ID inválido').optional().nullable(),

  // Campos de trial
  trialEndsAt: z
    .string()
    .datetime('Data de fim de trial inválida')
    .transform((val) => new Date(val))
    .optional()
    .nullable(),

  // Campos de pagamento
  paymentMethod: z
    .enum(['PIX', 'CARTAO', 'BOLETO', 'TRANSFERENCIA'], {
      errorMap: () => ({ message: 'Método de pagamento inválido' }),
    })
    .optional()
    .nullable(),

  paymentGateway: z
    .enum(['ASAAS', 'ABACATEPAY', 'MANUAL'], {
      errorMap: () => ({ message: 'Gateway de pagamento inválido' }),
    })
    .optional()
    .nullable(),

  // Relacionamentos
  tenantId: z.string().uuid('Tenant ID inválido').optional().nullable(),

  leadId: z.string().uuid('Lead ID inválido').optional().nullable(),

  // Campos opcionais
  notes: z.string().max(5000, 'Notas devem ter no máximo 5000 caracteres').optional().nullable(),
});

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
