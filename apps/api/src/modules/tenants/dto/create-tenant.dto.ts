import { z } from 'zod';
import { TenantStatus } from '@prisma/client';

/**
 * Schema Zod para criação de tenant
 *
 * REGRAS:
 * - clientId é obrigatório (relacionamento 1:1 com Client)
 * - tenantUuid deve ser único no sistema destino
 * - systemUrl é a URL de acesso ao tenant
 * - vpsLocation indica onde o tenant está hospedado
 * - enabledModules é um array JSON de módulos habilitados
 */
export const CreateTenantSchema = z.object({
  clientId: z
    .string()
    .uuid('Client ID inválido')
    .describe('ID do cliente (relacionamento 1:1)'),

  tenantUuid: z
    .string()
    .uuid('Tenant UUID inválido')
    .describe('UUID do tenant no sistema destino (One Nexus ou Locadoras)'),

  systemUrl: z
    .string()
    .url('URL do sistema inválida')
    .max(200, 'URL do sistema deve ter no máximo 200 caracteres')
    .describe('URL de acesso ao sistema (ex: cliente.onenexus.com.br)')
    .transform((val) => val.trim().toLowerCase()),

  vpsLocation: z
    .string()
    .min(1, 'VPS Location deve ter no mínimo 1 caractere')
    .max(50, 'VPS Location deve ter no máximo 50 caracteres')
    .describe('Localização do VPS (ex: VPS-29, VPS-145)')
    .transform((val) => val.trim().toUpperCase()),

  status: z
    .nativeEnum(TenantStatus, {
      errorMap: () => ({
        message: 'Status inválido. Valores aceitos: ATIVO, SUSPENSO, BLOQUEADO, DELETADO',
      }),
    })
    .default(TenantStatus.ATIVO),

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Versão deve seguir o formato semver (ex: 1.0.0)')
    .default('1.0.0')
    .describe('Versão do sistema instalada'),

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
    .default(0)
    .describe('Quantidade de usuários ativos no tenant'),

  storageUsedMb: z
    .number()
    .int('Storage usado deve ser inteiro')
    .min(0, 'Storage usado não pode ser negativo')
    .default(0)
    .describe('Storage usado em megabytes'),

  enabledModules: z
    .array(z.string())
    .default([])
    .describe('Lista de módulos habilitados no tenant (array de strings)'),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
