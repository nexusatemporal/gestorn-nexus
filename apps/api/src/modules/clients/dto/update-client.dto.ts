import { z } from 'zod';
import { CreateClientSchema } from './create-client.dto';

/**
 * Schema Zod para atualização de cliente
 *
 * REGRAS:
 * - Todos os campos são opcionais
 * - Campos que NÃO podem ser alterados (omitidos):
 *   - cpfCnpj: identificador único do cliente
 *   - leadId: referência ao lead de origem
 *   - planId: plano não pode ser alterado após criação (usar upgrade/downgrade)
 *   - dealSummary: registro histórico da negociação
 *   - closedAt: data de fechamento original
 *   - implementationNotes: notas do handoff Sales → CS
 *   - convertedFromLeadId: rastreabilidade da conversão
 * - vendedorId pode ser alterado apenas por admins/gestor
 */
export const UpdateClientSchema = CreateClientSchema.partial().omit({
  cpfCnpj: true,
  leadId: true,
  planId: true, // ✅ v2.45.0: Usar upgrade/downgrade para mudar plano
  dealSummary: true, // ✅ v2.45.0: Registro histórico
  closedAt: true, // ✅ v2.45.0: Data de fechamento original
  implementationNotes: true, // ✅ v2.45.0: Notas do handoff
  convertedFromLeadId: true, // ✅ v2.45.0: Rastreabilidade
});

export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
