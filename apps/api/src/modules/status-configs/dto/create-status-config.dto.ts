import { z } from 'zod';
import { StatusEntity } from '@prisma/client';

export const CreateStatusConfigSchema = z.object({
  entity: z.nativeEnum(StatusEntity, { errorMap: () => ({ message: 'Entidade inválida' }) }),

  slug: z
    .string()
    .min(2, 'Slug deve ter no mínimo 2 caracteres')
    .max(50, 'Slug deve ter no máximo 50 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'Slug deve conter apenas letras maiúsculas, números e underscore')
    .transform((val) => val.toUpperCase().trim()),

  label: z
    .string()
    .min(1, 'Label é obrigatório')
    .max(80, 'Label deve ter no máximo 80 caracteres')
    .transform((val) => val.trim()),

  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Cor de texto deve ser hex válido (ex: #22c55e)')
    .default('#6b7280'),

  bgColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Cor de fundo deve ser hex válido (ex: #f3f4f6)')
    .default('#f3f4f6'),

  description: z.string().max(200).optional().nullable(),

  sortOrder: z.number().int().min(0).default(0),
});

export type CreateStatusConfigDto = z.infer<typeof CreateStatusConfigSchema>;
