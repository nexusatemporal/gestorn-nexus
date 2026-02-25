import { z } from 'zod';

/**
 * DTO para atualizar configuração de integração
 */
export const UpdateIntegrationSchema = z.object({
  config: z.record(z.any()).optional(), // Config genérico (JSON)
  isActive: z.boolean().optional(),
});

export type UpdateIntegrationDto = z.infer<typeof UpdateIntegrationSchema>;
