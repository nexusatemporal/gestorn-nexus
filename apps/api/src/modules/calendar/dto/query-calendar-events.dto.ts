import { z } from 'zod';
import { EventType } from '@prisma/client';

export const QueryCalendarEventsSchema = z.object({
  startDate: z.coerce
    .date({
      errorMap: () => ({ message: 'Data de início inválida' }),
    })
    .optional(),

  endDate: z.coerce
    .date({
      errorMap: () => ({ message: 'Data de término inválida' }),
    })
    .optional(),

  type: z.nativeEnum(EventType).optional(),

  leadId: z.string().optional(),

  clientId: z.string().optional(),

  userId: z
    .string()
    .optional(), // Only for admins/gestors to filter by specific user

  includeRecurring: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  search: z
    .string()
    .max(200, 'Busca deve ter no máximo 200 caracteres')
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

export type QueryCalendarEventsDto = z.infer<typeof QueryCalendarEventsSchema>;
