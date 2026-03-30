import { z } from 'zod';
import { CreateStatusConfigSchema } from './create-status-config.dto';

// Para update: todos os campos opcionais exceto entity (não pode mudar)
export const UpdateStatusConfigSchema = CreateStatusConfigSchema
  .omit({ entity: true, slug: true })
  .partial();

export type UpdateStatusConfigDto = z.infer<typeof UpdateStatusConfigSchema>;
