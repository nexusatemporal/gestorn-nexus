import { z } from 'zod';

/**
 * DTO para atualizar estágio do funil
 * IMPORTANTE: Campos sincronizados com Prisma schema (FunnelStage model)
 */
export const UpdateFunnelStageSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFunnelStageDto = z.infer<typeof UpdateFunnelStageSchema>;
