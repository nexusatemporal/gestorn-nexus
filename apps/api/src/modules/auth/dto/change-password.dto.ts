import { z } from 'zod';

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual e obrigatoria'),
  newPassword: z.string().min(6, 'Nova senha deve ter no minimo 6 caracteres'),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
