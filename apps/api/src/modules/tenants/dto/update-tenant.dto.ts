import { z } from 'zod';
import { TenantStatus } from '@prisma/client';

/**
 * Schema Zod para atualização de tenant
 *
 * REGRAS:
 * - Todos os campos são opcionais (partial update)
 * - clientId NÃO pode ser alterado (relacionamento 1:1 imutável)
 * - tenantUuid NÃO pode ser alterado (identificador único)
 * - Apenas SUPERADMIN pode alterar status para DELETADO
 */
export const UpdateTenantSchema = z.object({
  systemUrl: z
    .string()
    .url('URL do sistema inválida')
    .max(200, 'URL do sistema deve ter no máximo 200 caracteres')
    .transform((val) => val.trim().toLowerCase())
    .optional(),

  vpsLocation: z
    .string()
    .min(1, 'VPS Location deve ter no mínimo 1 caractere')
    .max(50, 'VPS Location deve ter no máximo 50 caracteres')
    .transform((val) => val.trim().toUpperCase())
    .optional(),

  status: z
    .nativeEnum(TenantStatus, {
      errorMap: () => ({
        message: 'Status inválido. Valores aceitos: ATIVO, SUSPENSO, BLOQUEADO, DELETADO',
      }),
    })
    .optional(),

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Versão deve seguir o formato semver (ex: 1.0.0)')
    .optional(),

  lastAccessAt: z
    .string()
    .datetime('Data de último acesso inválida')
    .transform((val) => new Date(val))
    .optional()
    .nullable(),

  activeUsers: z
    .number()
    .int('Número de usuários ativos deve ser inteiro')
    .min(0, 'Número de usuários ativos não pode ser negativo')
    .optional(),

  storageUsedMb: z
    .number()
    .int('Storage usado deve ser inteiro')
    .min(0, 'Storage usado não pode ser negativo')
    .optional(),

  enabledModules: z
    .array(z.string())
    .optional()
    .describe('Lista de módulos habilitados no tenant'),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
