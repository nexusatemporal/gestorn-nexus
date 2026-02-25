import { z } from 'zod';
import { UserRole } from '@prisma/client';

/**
 * Schema Zod para criacao de usuario
 * v2.54.0: Removido clerkId (auth proprio JWT), adicionado password
 */
export const CreateUserSchema = z.object({
  email: z
    .string()
    .email('Email invalido')
    .toLowerCase()
    .transform((val) => val.trim()),

  name: z
    .string()
    .min(3, 'Nome deve ter no minimo 3 caracteres')
    .max(100, 'Nome deve ter no maximo 100 caracteres')
    .transform((val) => val.trim()),

  password: z
    .string()
    .min(6, 'Senha deve ter no minimo 6 caracteres')
    .optional(),

  avatar: z.string().url('URL invalida').optional().nullable(),

  role: z.nativeEnum(UserRole, {
    errorMap: () => ({
      message: 'Role invalido. Valores aceitos: SUPERADMIN, ADMINISTRATIVO, GESTOR, VENDEDOR, DESENVOLVEDOR',
    }),
  }),

  isActive: z.boolean().default(true),

  gestorId: z.string().uuid('Gestor ID invalido').optional().nullable(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
