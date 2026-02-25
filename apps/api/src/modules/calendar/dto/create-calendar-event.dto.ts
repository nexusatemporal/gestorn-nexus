import { z } from 'zod';
import { EventType } from '@prisma/client';

export const CreateCalendarEventSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Título deve ter no mínimo 3 caracteres')
      .max(200, 'Título deve ter no máximo 200 caracteres')
      .transform((val) => val.trim()),

    description: z
      .string()
      .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : null)),

    type: z.nativeEnum(EventType, {
      errorMap: () => ({
        message:
          'Tipo inválido. Valores: DEMO, MEETING, CALL, FOLLOWUP, SUPPORT, INTERNAL',
      }),
    }),

    startAt: z.coerce.date({
      errorMap: () => ({ message: 'Data de início inválida' }),
    }),

    endAt: z.coerce.date({
      errorMap: () => ({ message: 'Data de término inválida' }),
    }),

    isAllDay: z.boolean().default(false),

    attendeesCount: z.number().int().min(1).default(1),

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

    reminderMinutes: z.array(z.number().int().min(0)).default([30]),

    // Associations
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

    // Recurring events
    isRecurring: z.boolean().default(false),

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
      .date({
        errorMap: () => ({ message: 'Data de término de recorrência inválida' }),
      })
      .optional()
      .nullable(),
  })
  .refine((data) => data.startAt < data.endAt, {
    message: 'Data de término deve ser após data de início',
    path: ['endAt'],
  })
  .refine(
    (data) => {
      if (data.isRecurring && !data.recurrenceRule) {
        return false;
      }
      return true;
    },
    {
      message: 'Eventos recorrentes requerem regra de recorrência',
      path: ['recurrenceRule'],
    }
  );

export type CreateCalendarEventDto = z.infer<typeof CreateCalendarEventSchema>;
