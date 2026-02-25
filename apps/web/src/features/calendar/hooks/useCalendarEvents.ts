/**
 * Calendar Events Hooks
 * React Query hooks para gerenciar eventos do calendário
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '@/services/api';
import type {
  CalendarEvent,
  CalendarFilters,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  UpdateMode,
} from '../types/calendar.types';

// ──────────────────────────────────────────────────────────────────────────
// Query Keys
// ──────────────────────────────────────────────────────────────────────────

export const calendarKeys = {
  all: ['calendar'] as const,
  events: () => [...calendarKeys.all, 'events'] as const,
  eventsList: (filters?: CalendarFilters) =>
    [...calendarKeys.events(), { filters }] as const,
  event: (id: string) => [...calendarKeys.events(), id] as const,
};

// ──────────────────────────────────────────────────────────────────────────
// Query: Listar Eventos
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para buscar lista de eventos do calendário
 *
 * @example
 * ```tsx
 * const { data: events, isLoading } = useCalendarEvents({
 *   startDate: new Date('2026-01-01'),
 *   endDate: new Date('2026-01-31'),
 *   type: EventType.DEMO,
 * });
 * ```
 */
export function useCalendarEvents(filters?: CalendarFilters) {
  const params = new URLSearchParams();

  if (filters?.startDate) {
    const date = filters.startDate instanceof Date
      ? filters.startDate.toISOString()
      : filters.startDate;
    params.set('startDate', date);
  }

  if (filters?.endDate) {
    const date = filters.endDate instanceof Date
      ? filters.endDate.toISOString()
      : filters.endDate;
    params.set('endDate', date);
  }

  if (filters?.type) params.set('type', filters.type);
  if (filters?.leadId) params.set('leadId', filters.leadId);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.includeRecurring !== undefined) {
    params.set('includeRecurring', String(filters.includeRecurring));
  }

  const queryString = params.toString();
  const endpoint = `/calendar/events${queryString ? `?${queryString}` : ''}`;

  return useQuery<CalendarEvent[], AxiosError>({
    queryKey: calendarKeys.eventsList(filters),
    queryFn: async () => {
      const { data } = await api.get<CalendarEvent[]>(endpoint);
      return data;
    },
    staleTime: 1000 * 60, // 1 minuto
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Query: Buscar Evento Único
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para buscar um evento específico por ID
 *
 * @example
 * ```tsx
 * const { data: event, isLoading } = useCalendarEvent('event-id-123');
 * ```
 */
export function useCalendarEvent(id: string) {
  return useQuery<CalendarEvent, AxiosError>({
    queryKey: calendarKeys.event(id),
    queryFn: async () => {
      const { data } = await api.get<CalendarEvent>(`/calendar/events/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Mutation: Criar Evento
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para criar novo evento
 *
 * @example
 * ```tsx
 * const createEvent = useCreateCalendarEvent();
 *
 * await createEvent.mutateAsync({
 *   title: 'Demo One Nexus',
 *   type: EventType.DEMO,
 *   startAt: new Date(),
 *   endAt: addHours(new Date(), 1),
 * });
 * ```
 */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation<CalendarEvent, AxiosError, CreateCalendarEventDto>({
    mutationFn: async (eventData) => {
      const { data } = await api.post<CalendarEvent>('/calendar/events', eventData);
      return data;
    },
    onSuccess: () => {
      // Invalidar todas as listas de eventos
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Mutation: Atualizar Evento
// ──────────────────────────────────────────────────────────────────────────

interface UpdateEventVariables {
  id: string;
  data: UpdateCalendarEventDto;
  updateMode?: UpdateMode;
}

/**
 * Hook para atualizar evento existente
 *
 * @example
 * ```tsx
 * const updateEvent = useUpdateCalendarEvent();
 *
 * await updateEvent.mutateAsync({
 *   id: 'event-123',
 *   data: { title: 'Novo título' },
 *   updateMode: UpdateMode.THIS_ONLY,
 * });
 * ```
 */
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation<CalendarEvent, AxiosError, UpdateEventVariables>({
    mutationFn: async ({ id, data, updateMode }) => {
      const params = new URLSearchParams();
      if (updateMode) params.set('updateMode', updateMode);

      const queryString = params.toString();
      const endpoint = `/calendar/events/${id}${queryString ? `?${queryString}` : ''}`;

      const response = await api.put<CalendarEvent>(endpoint, data);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidar lista de eventos
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
      // Atualizar cache do evento específico
      queryClient.setQueryData(calendarKeys.event(data.id), data);
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Mutation: Deletar Evento
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hook para deletar evento
 *
 * @example
 * ```tsx
 * const deleteEvent = useDeleteCalendarEvent();
 *
 * await deleteEvent.mutateAsync('event-123');
 * ```
 */
export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, AxiosError, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete<{ message: string }>(`/calendar/events/${id}`);
      return data;
    },
    onSuccess: (_, deletedId) => {
      // Invalidar lista de eventos
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
      // Remover evento do cache
      queryClient.removeQueries({ queryKey: calendarKeys.event(deletedId) });
    },
  });
}
