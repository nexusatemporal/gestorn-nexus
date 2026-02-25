import { z } from 'zod';
import { CreateUserSchema } from './create-user.dto';

/**
 * Schema Zod para atualizacao de usuario
 *
 * REGRAS:
 * - Todos os campos sao opcionais
 * - email nao pode ser alterado (omitido)
 * - password nao pode ser alterado via PUT (use PATCH /users/:id/password)
 * - SUPERADMIN pode alterar qualquer campo
 * - ADMINISTRATIVO pode alterar role e gestorId
 * - Usuario pode alterar apenas seus proprios dados (exceto role)
 *
 * v2.54.0: Removido clerkId (auth proprio JWT)
 */
export const UpdateUserSchema = CreateUserSchema.partial().omit({
  email: true,
  password: true,
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
