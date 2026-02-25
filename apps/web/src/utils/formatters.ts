/**
 * ══════════════════════════════════════════════════════════════════════════
 * FORMATTERS - Utilitários de Formatação
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Formata CPF: 12345678900 → 123.456.789-00
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ: 12345678000100 → 12.345.678/0001-00
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata telefone: 11987654321 → (11) 98765-4321
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formata moeda BRL: 1234.56 → R$ 1.234,56
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data: 2024-01-15T10:30:00.000Z → 15/01/2024
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

/**
 * Formata data sem conversão de timezone: 2026-03-10 → 10/03/2026
 *
 * IMPORTANTE: Use esta função para datas que vêm do backend em formato
 * YYYY-MM-DD e devem ser exibidas exatamente como estão, sem ajuste de timezone.
 *
 * Contexto: formatDate() aplica conversão UTC→BRT que subtrai 1 dia em datas
 * sem hora (2026-03-10 00:00 UTC vira 2026-03-09 21:00 BRT = 09/03/2026).
 */
export function formatDateLocal(dateString: string): string {
  if (!dateString || dateString === 'Sem vencimento') return dateString;

  // Parse YYYY-MM-DD sem conversão de timezone
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [_, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // Fallback para formato padrão (se for DateTime completo)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString));
}

/**
 * Formata data e hora: 2024-01-15T10:30:00.000Z → 15/01/2024 10:30
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));
}
