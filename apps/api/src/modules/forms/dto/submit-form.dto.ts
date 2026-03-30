import { z } from 'zod';

/**
 * DTO para submissão pública de formulário.
 * Mais permissivo que CreateLeadDto — valida os dados no nível do form,
 * o service faz o mapeamento para Lead.
 */
export const SubmitFormSchema = z.object({
  /// Mapa de respostas: chave = field.id, valor = resposta do usuário
  data: z.record(z.string(), z.string()),
});

export type SubmitFormDto = z.infer<typeof SubmitFormSchema>;

/**
 * DTO para submissão via Landing Page externa.
 * Campos nomeados (não usa field IDs do form builder).
 */
export const LPSubmitSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  whatsapp: z.string().min(10, 'WhatsApp é obrigatório'),
  clinica: z.string().optional(),
  cidade: z.string().optional(),
  email: z.string().email().optional(),
  desafio: z.string().optional(),
  atendimentos: z.string().optional(),
});

export type LPSubmitDto = z.infer<typeof LPSubmitSchema>;
