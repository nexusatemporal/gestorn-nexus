import { z } from 'zod';
import { EventType } from '@prisma/client';

// Update schema - todos os campos opcionais
export const UpdateCalendarEventSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Título deve ter no mínimo 3 caracteres')
      .max(200, 'Título deve ter no máximo 200 caracteres')
      .transform((val) => val.trim())
      .optional(),

    description: z
      .string()
      .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),

    type: z.nativeEnum(EventType).optional(),

    startAt: z.coerce.date().optional(),

    endAt: z.coerce.date().optional(),

    isAllDay: z.boolean().optional(),

    attendeesCount: z.number().int().min(1).optional(),

    location: z
      .string()
      .max(500, 'Local deve ter no máximo 500 caracteres')
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),

    meetingUrl: z
      .union([
        z.string().url('URL inválida'),
        z.literal(''),
        z.null(),
        z.undefined(),
      ])
      .optional()
      .nullable()
      .transform((val) => (val && val !== '' ? val.trim() : null)),

    reminderMinutes: z.array(z.number().int().min(0)).optional(),

    leadId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => val || null),

    clientId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => val || null),

    isRecurring: z.boolean().optional(),

    recurrenceRule: z
      .union([
        z.string().regex(/^(DTSTART[;:]|RRULE:)/, 'Regra de recorrência deve começar com DTSTART ou RRULE'),
        z.literal(''),
        z.null(),
        z.undefined(),
      ])
      .optional()
      .nullable()
      .transform((val) => (val && val !== '' ? val.trim() : null)),

    recurrenceEnd: z.coerce
      .date()
      .optional()
      .nullable(),
  });
  // Validação startAt < endAt REMOVIDA daqui e movida para o service
  // Motivo: O .refine() estava causando falhas na segunda atualização
  // devido a conversões de timezone e precisão de milissegundos

export type UpdateCalendarEventDto = z.infer<typeof UpdateCalendarEventSchema>;
