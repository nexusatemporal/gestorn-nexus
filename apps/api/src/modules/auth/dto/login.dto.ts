import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Senha e obrigatoria'),
});

export type LoginDto = z.infer<typeof LoginSchema>;
