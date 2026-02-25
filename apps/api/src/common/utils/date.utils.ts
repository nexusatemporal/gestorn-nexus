/**
 * Utilitários de data para o Gestor Nexus
 * TODAS as datas do sistema devem usar estas funções
 * Timezone: America/Sao_Paulo (UTC-3)
 *
 * @version 2.46.0 - Billing Lifecycle Onda 1
 * @description Resolve o bug off-by-1-day causado por timezone incorreto
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addMonths, addYears, setDate, startOfDay } from 'date-fns';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual em Brasília
 * @returns Date no fuso horário de Brasília
 */
export function nowBrasilia(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: TIMEZONE })
  );
}

/**
 * Converte uma string de data (YYYY-MM-DD) para Date com timezone de Brasília
 * RESOLVE O BUG OFF-BY-1-DAY
 *
 * Problema: new Date("2026-02-15") → 2026-02-15T00:00:00Z (UTC)
 *           → Em Brasília (UTC-3) → 2026-02-14T21:00:00 (DIA 14!)
 *
 * Solução: Criar a data explicitamente no fuso de Brasília
 *
 * @param dateString String no formato "YYYY-MM-DD"
 * @returns Date com timezone correto (meio-dia BRT = 15:00 UTC)
 */
export function parseDateBrasilia(dateString: string): Date {
  // dateString formato: "YYYY-MM-DD"
  const [year, month, day] = dateString.split('-').map(Number);

  // Criar data ao meio-dia de Brasília para evitar problemas de DST
  // Brasília = UTC-3, então meio-dia BRT = 15:00 UTC
  const date = new Date(Date.UTC(year, month - 1, day, 15, 0, 0, 0));

  return date;
}

/**
 * Formata uma Date para exibição no padrão BR
 * @param date Date para formatar
 * @returns String no formato dd/mm/yyyy
 */
export function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Extrai apenas o DIA do mês de uma Date no fuso de Brasília
 * @param date Date para extrair o dia
 * @returns Número do dia (1-31)
 */
export function getDayInBrasilia(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      day: 'numeric',
    }).format(date)
  );
}

/**
 * Calcula a próxima data de billing preservando o anchor day
 * Se o mês não tem o dia (ex: 31 em fevereiro), usa o último dia do mês
 * O anchor day é limitado a 28 para evitar edge cases
 *
 * @param fromDate Data base para cálculo
 * @param anchorDay Dia do mês fixo (1-28)
 * @param cycle Ciclo de billing (MONTHLY ou ANNUAL)
 * @returns Date da próxima cobrança
 */
export function getNextBillingDate(
  fromDate: Date,
  anchorDay: number,
  cycle: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'SEMIANNUAL',
): Date {
  const from = new Date(fromDate);
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();

  // Adicionar período baseado no ciclo
  switch (cycle) {
    case 'ANNUAL':
      year += 1;
      break;
    case 'SEMIANNUAL':
      month += 6;
      break;
    case 'QUARTERLY':
      month += 3;
      break;
    case 'MONTHLY':
    default:
      month += 1;
      break;
  }

  // Ajustar overflow de mês
  if (month > 11) {
    year += Math.floor(month / 12);
    month = month % 12;
  }

  // Limitar anchor day a 28 para segurança
  const safeAnchor = Math.min(anchorDay, 28);

  // Verificar se o mês destino tem esse dia
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(safeAnchor, lastDayOfMonth);

  // Criar com horário meio-dia BRT (15:00 UTC)
  return new Date(Date.UTC(year, month, day, 15, 0, 0, 0));
}

/**
 * Calcula o fim do período baseado no ciclo
 * @param periodStart Data de início do período
 * @param cycle Ciclo de billing
 * @returns Date do fim do período
 */
export function calculatePeriodEnd(
  periodStart: Date,
  cycle: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'SEMIANNUAL',
): Date {
  const end = new Date(periodStart);

  switch (cycle) {
    case 'ANNUAL':
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
    case 'SEMIANNUAL':
      end.setUTCMonth(end.getUTCMonth() + 6);
      break;
    case 'QUARTERLY':
      end.setUTCMonth(end.getUTCMonth() + 3);
      break;
    case 'MONTHLY':
    default:
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
  }

  return end;
}

/**
 * Calcula o número de dias entre duas datas
 * @param date1 Primeira data
 * @param date2 Segunda data
 * @returns Número de dias (sempre positivo)
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se uma data (em Brasília) é hoje
 * @param date Date para verificar
 * @returns true se é hoje
 */
export function isToday(date: Date): boolean {
  const today = nowBrasilia();
  const d = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Verifica se uma data está no passado (em Brasília)
 * @param date Date para verificar
 * @returns true se está no passado
 */
export function isPastDue(date: Date): boolean {
  const today = nowBrasilia();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  d.setHours(0, 0, 0, 0);
  return d < today;
}

// ══════════════════════════════════════════════════════════════════════════════
// 🔄 BILLING LIFECYCLE - NOVAS FUNÇÕES (v2.46.0 - Onda 1)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Converte uma data UTC para Brasília usando date-fns-tz
 * @param date Date em UTC
 * @returns Date convertida para timezone de Brasília
 */
export function toZonedBrasilia(date: Date): Date {
  return toZonedTime(date, TIMEZONE);
}

/**
 * Cria uma data em Brasília e converte para UTC para armazenamento
 * Usa meio-dia (12:00) para evitar problemas de off-by-1-day
 *
 * @param year - Ano
 * @param month - Mês (1-12, NÃO 0-11)
 * @param day - Dia (1-31)
 * @returns Date em UTC ao meio-dia Brasília
 */
export function createDateBrasilia(year: number, month: number, day: number): Date {
  // Cria a data ao meio-dia em Brasília para evitar edge cases de timezone
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`;
  return fromZonedTime(dateStr, TIMEZONE);
}

/**
 * Parse de uma string date "YYYY-MM-DD" sem problemas de timezone
 * Retorna Date em UTC ao meio-dia Brasília
 *
 * @param dateString String no formato YYYY-MM-DD
 * @returns Date em UTC ao meio-dia Brasília
 */
export function parseDateSafe(dateString: string): Date {
  if (!dateString) {
    return createDateBrasilia(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
    );
  }

  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return createDateBrasilia(
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3]),
    );
  }

  // Fallback: tenta criar a data e normalizar
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) {
    return nowBrasilia();
  }
  return parsed;
}

/**
 * Retorna o início do dia em Brasília (00:00:00 BRT) convertido para UTC
 * @param date Data opcional (default: hoje)
 * @returns Date do início do dia em UTC
 */
export function startOfDayBrasilia(date?: Date): Date {
  const d = date ? toZonedBrasilia(date) : nowBrasilia();
  const start = startOfDay(d);
  return fromZonedTime(start, TIMEZONE);
}

/**
 * Calcula a diferença em dias entre duas datas (ignora horas)
 * @param dateA Primeira data
 * @param dateB Segunda data
 * @returns Número de dias de diferença (pode ser negativo)
 */
export function diffInDays(dateA: Date, dateB: Date): number {
  const a = startOfDay(dateA);
  const b = startOfDay(dateB);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
