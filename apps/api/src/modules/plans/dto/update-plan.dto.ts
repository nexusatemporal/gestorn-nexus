import { z } from 'zod';
import { CreatePlanSchema } from './create-plan.dto';

/**
 * Schema Zod para atualização de plano
 * Todos os campos são opcionais
 */
export const UpdatePlanSchema = CreatePlanSchema.partial();

export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;
