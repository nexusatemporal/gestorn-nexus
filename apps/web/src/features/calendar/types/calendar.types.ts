/**
 * Calendar Types
 * Definições de tipos para o módulo de calendário
 */

/**
 * Tipos de eventos disponíveis
 */
export enum EventType {
  DEMO = 'DEMO',
  MEETING = 'MEETING',
  CALL = 'CALL',
  FOLLOWUP = 'FOLLOWUP',
  SUPPORT = 'SUPPORT',
  INTERNAL = 'INTERNAL',
}

/**
 * Modo de atualização para eventos recorrentes
 */
export enum UpdateMode {
  THIS_ONLY = 'THIS_ONLY',
  ALL_FUTURE = 'ALL_FUTURE',
}

/**
 * Status de sincronização com Google Calendar
 */
export enum GoogleSyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
}

/**
 * Visualização do calendário
 */
export type CalendarView = 'day' | 'week' | 'month' | 'year';

/**
 * Evento do calendário (modelo completo)
 */
export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  type: EventType;
  startAt: string; // ISO string
  endAt: string; // ISO string
  isAllDay: boolean;
  attendeesCount: number;
  location?: string | null;
  meetingUrl?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  isRecurring: boolean;
  recurrenceRule?: string | null; // RRULE format
  recurrenceEnd?: string | null; // ISO string
  parentEventId?: string | null;
  exceptionDates?: string[]; // ISO strings
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  googleSyncStatus?: GoogleSyncStatus | null;
  googleLastSync?: string | null; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  deletedAt?: string | null; // ISO string

  // Relations (opcionais, dependem do include)
  lead?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  client?: {
    id: string;
    contactName: string;  // ← Updated to match Prisma schema
    phone?: string | null;
    email?: string | null;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * DTO para criar evento
 */
export interface CreateCalendarEventDto {
  title: string;
  description?: string | null;
  type: EventType;
  startAt: Date | string;
  endAt: Date | string;
  isAllDay?: boolean;
  attendeesCount?: number;
  location?: string | null;
  meetingUrl?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  recurrenceEnd?: Date | string | null;
}

/**
 * DTO para atualizar evento
 */
export interface UpdateCalendarEventDto {
  title?: string;
  description?: string | null;
  type?: EventType;
  startAt?: Date | string;
  endAt?: Date | string;
  isAllDay?: boolean;
  attendeesCount?: number;
  location?: string | null;
  meetingUrl?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  recurrenceEnd?: Date | string | null;
}

/**
 * Filtros para buscar eventos
 */
export interface CalendarFilters {
  startDate?: Date | string;
  endDate?: Date | string;
  type?: EventType;
  leadId?: string;
  clientId?: string;
  userId?: string;
  includeRecurring?: boolean;
  search?: string;
}

/**
 * Status da conexão com Google Calendar
 */
export interface GoogleCalendarStatus {
  isConnected: boolean;
  calendarId?: string;
  scope?: string;
  expiresAt?: string;
}

/**
 * Resposta de sincronização do Google
 */
export interface GoogleSyncResponse {
  imported: number;
  events: CalendarEvent[];
  message: string;
}

/**
 * Configuração de cores por tipo de evento
 */
export const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  [EventType.DEMO]: {
    label: 'Demo',
    color: 'text-orange-700',
    bgColor: 'bg-orange-500',
    icon: '🎯',
  },
  [EventType.MEETING]: {
    label: 'Reunião',
    color: 'text-blue-700',
    bgColor: 'bg-blue-500',
    icon: '👥',
  },
  [EventType.CALL]: {
    label: 'Ligação',
    color: 'text-green-700',
    bgColor: 'bg-green-500',
    icon: '📞',
  },
  [EventType.FOLLOWUP]: {
    label: 'Follow-up',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-500',
    icon: '🔄',
  },
  [EventType.SUPPORT]: {
    label: 'Suporte',
    color: 'text-red-700',
    bgColor: 'bg-red-500',
    icon: '🛟',
  },
  [EventType.INTERNAL]: {
    label: 'Interno',
    color: 'text-purple-700',
    bgColor: 'bg-purple-500',
    icon: '🏢',
  },
};

/**
 * Utilitário: Verificar se evento é de dia inteiro
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return event.isAllDay;
}

/**
 * Utilitário: Obter duração do evento em minutos
 */
export function getEventDuration(event: CalendarEvent): number {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Utilitário: Formatar data para exibição
 */
export function formatEventDate(date: string | Date, includeTime = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (includeTime) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Utilitário: Verificar se evento está acontecendo agora
 */
export function isEventHappeningNow(event: CalendarEvent): boolean {
  const now = new Date();
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return now >= start && now <= end;
}

/**
 * Utilitário: Verificar se evento já passou
 */
export function isEventPast(event: CalendarEvent): boolean {
  const now = new Date();
  const end = new Date(event.endAt);
  return end < now;
}

/**
 * Utilitário: Obter próximos N eventos
 */
export function getUpcomingEvents(
  events: CalendarEvent[],
  count = 5
): CalendarEvent[] {
  const now = new Date();
  return events
    .filter((e) => new Date(e.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, count);
}
