import { z } from 'zod';

/**
 * DTO para criar estágio do funil
 * IMPORTANTE: Campos sincronizados com Prisma schema (FunnelStage model)
 */
export const CreateFunnelStageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  order: z.number().int().min(0, 'Ordem deve ser um número positivo'),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal (#RRGGBB)')
    .default('#FF7300'), // Nexus orange
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CreateFunnelStageDto = z.infer<typeof CreateFunnelStageSchema>;
