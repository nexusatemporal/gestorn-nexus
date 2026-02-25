import { z } from 'zod';

/**
 * DTO para consulta de logs de auditoria
 */
export const QueryAuditSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  userId: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'action', 'entity']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type QueryAuditDto = z.infer<typeof QueryAuditSchema>;

/**
 * DTO para criação de log de auditoria
 */
export const CreateAuditLogSchema = z.object({
  userId: z.string().optional(),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  oldData: z.any().optional(),
  newData: z.any().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type CreateAuditLogDto = z.infer<typeof CreateAuditLogSchema>;
