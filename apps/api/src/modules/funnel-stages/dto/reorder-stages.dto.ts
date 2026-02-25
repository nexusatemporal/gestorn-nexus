import { z } from 'zod';

/**
 * DTO para reordenar estágios
 */
export const ReorderStagesSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })
  ),
});

export type ReorderStagesDto = z.infer<typeof ReorderStagesSchema>;
