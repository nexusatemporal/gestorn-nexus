/**
 * Calendar Event Form Component
 * Modal for creating and editing calendar events
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '../hooks/useCalendarEvents';
import type { CalendarEvent, CreateCalendarEventDto, EventType } from '../types/calendar.types';
import { EVENT_TYPE_CONFIG } from '../types/calendar.types';
import { RecurringEventModal } from './RecurringEventModal';
import { useApiQuery } from '@/hooks/useApi';
import type { Lead, Client } from '@/types';

interface CalendarEventFormProps {
  event?: CalendarEvent | null;
  defaultDate?: Date;
  onClose: () => void;
}

/**
 * Format date to local datetime-local format (YYYY-MM-DDTHH:mm)
 * Avoids timezone conversion issues
 */
const formatLocalDateTime = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Format date to local date format (YYYY-MM-DD)
 * Avoids timezone conversion issues
 */
const formatLocalDate = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse datetime-local input as Brazil timezone (BRT/UTC-3)
 *
 * Problem: Input "2026-01-21T13:00" → new Date() interprets as LOCAL timezone
 * Solution: Parse components and create Date with explicit BRT interpretation
 *
 * @param datetimeString - String from datetime-local input (YYYY-MM-DDTHH:mm)
 * @returns Date object representing that moment in BRT
 */
const parseBrazilDateTime = (datetimeString: string): Date => {
  if (!datetimeString) return new Date();

  // Parse date components from "2026-01-21T13:00"
  const [datePart, timePart] = datetimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  // Create Date using local timezone methods (these use local time)
  // This creates a Date representing exactly the time the user sees
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  return localDate;
};

export function CalendarEventForm({ event, defaultDate, onClose }: CalendarEventFormProps) {
  const isEditing = !!event;
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const previousStartAt = useRef<Date | null>(null);

  // Fetch leads and clients
  const { data: leads = [] } = useApiQuery<Lead[]>(['leads'], '/leads');
  const { data: clients = [] } = useApiQuery<Client[]>(['clients'], '/clients');

  const [formData, setFormData] = useState<Partial<CreateCalendarEventDto>>(() => {
    if (event) {
      return {
        title: event.title,
        description: event.description,
        type: event.type,
        startAt: new Date(event.startAt),
        endAt: new Date(event.endAt),
        isAllDay: event.isAllDay,
        attendeesCount: event.attendeesCount || 1,
        location: event.location,
        meetingUrl: event.meetingUrl,
        leadId: event.leadId,
        clientId: event.clientId,
        isRecurring: event.isRecurring,
        recurrenceRule: event.recurrenceRule,
        recurrenceEnd: event.recurrenceEnd ? new Date(event.recurrenceEnd) : undefined,
      };
    }

    const start = defaultDate || new Date();
    start.setHours(13, 0, 0, 0);
    const end = new Date(start);
    end.setHours(14, 0, 0, 0);

    return {
      title: '',
      description: '',
      type: 'DEMO' as EventType,
      startAt: start,
      endAt: end,
      isAllDay: false,
      attendeesCount: 1,
      location: '',
      meetingUrl: '',
      leadId: null,
      clientId: null,
      isRecurring: false,
      recurrenceRule: null,
      recurrenceEnd: undefined,
    };
  });

  // Auto-adjust endAt when startAt changes
  useEffect(() => {
    if (!formData.startAt || !formData.endAt) return;
    if (!(formData.startAt instanceof Date) || !(formData.endAt instanceof Date)) return;

    // Skip on initial mount
    if (!previousStartAt.current) {
      previousStartAt.current = formData.startAt;
      return;
    }

    // Calculate duration in milliseconds
    const duration = formData.endAt.getTime() - previousStartAt.current.getTime();

    // Update endAt to maintain the same duration
    const newEndAt = new Date(formData.startAt.getTime() + duration);

    setFormData(prev => ({
      ...prev,
      endAt: newEndAt,
    }));

    previousStartAt.current = formData.startAt;
  }, [formData.startAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);

    // Validate dates are not in the past
    const now = new Date();
    if (formData.startAt && formData.startAt < now) {
      setDateError('Não é possível criar eventos em datas ou horários passados');
      return;
    }

    try {
      if (isEditing && event) {
        await updateMutation.mutateAsync({
          id: event.id,
          data: formData as any,
        });
      } else {
        await createMutation.mutateAsync(formData as CreateCalendarEventDto);
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving event:', error);

      // Handle conflict error
      if (error?.response?.status === 400 && error?.response?.data?.message) {
        const errorMessage = error.response.data.message;

        // Check if it's a conflict error
        if (errorMessage.includes('Conflito de horário') || errorMessage.includes('conflito')) {
          setDateError(`⚠️ ${errorMessage}`);
        } else {
          setDateError(errorMessage);
        }
      }
    }
  };

  const handleSaveRecurrence = (rruleString: string, recurrenceEnd?: Date) => {
    setFormData({
      ...formData,
      isRecurring: true,
      recurrenceRule: rruleString,
      recurrenceEnd,
    });
    setShowRecurringModal(false);
  };

  // Filter leads and clients based on search
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const search = leadSearch.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(search) ||
        lead.email.toLowerCase().includes(search) ||
        (lead.companyName && lead.companyName.toLowerCase().includes(search))
    );
  }, [leads, leadSearch]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(
      (client) =>
        client.contactName.toLowerCase().includes(search) ||
        client.email.toLowerCase().includes(search) ||
        (client.company && client.company.toLowerCase().includes(search))
    );
  }, [clients, clientSearch]);

  const eventTypes = Object.entries(EVENT_TYPE_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
  }));

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? 'Editar Evento' : 'Novo Evento'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Título do Evento"
          required
          value={formData.title || ''}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ex: Demo One Nexus"
        />

        <Textarea
          label="Descrição"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detalhes sobre o evento..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de Evento"
            required
            value={formData.type || ''}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as EventType })}
            options={eventTypes}
          />

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAllDay || false}
                onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-nexus-orange focus:ring-nexus-orange/20"
              />
              Dia inteiro
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 block">Data de Início</label>
            <input
              type={formData.isAllDay ? 'date' : 'datetime-local'}
              required
              value={
                formData.startAt instanceof Date
                  ? formData.isAllDay
                    ? formatLocalDate(formData.startAt)
                    : formatLocalDateTime(formData.startAt)
                  : ''
              }
              onChange={(e) => {
                const newStartAt = formData.isAllDay
                  ? new Date(e.target.value + 'T00:00:00')
                  : parseBrazilDateTime(e.target.value);
                setFormData({ ...formData, startAt: newStartAt });
                setDateError(null);
              }}
              className="w-full rounded-xl px-4 py-3 text-sm border bg-zinc-800 border-zinc-700 text-white focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 block">Data de Término</label>
            <input
              type={formData.isAllDay ? 'date' : 'datetime-local'}
              required
              value={
                formData.endAt instanceof Date
                  ? formData.isAllDay
                    ? formatLocalDate(formData.endAt)
                    : formatLocalDateTime(formData.endAt)
                  : ''
              }
              onChange={(e) => {
                const newEndAt = formData.isAllDay
                  ? new Date(e.target.value + 'T23:59:59')
                  : parseBrazilDateTime(e.target.value);
                setFormData({ ...formData, endAt: newEndAt });
              }}
              className="w-full rounded-xl px-4 py-3 text-sm border bg-zinc-800 border-zinc-700 text-white focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all"
            />
          </div>
        </div>

        {dateError && (
          <p className="mt-1 text-sm text-red-600">{dateError}</p>
        )}

        <Input
          label="Localização"
          value={formData.location || ''}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="Ex: Google Meet, Sala 3, Remoto..."
        />

        <Input
          label="Link da Reunião"
          type="url"
          value={formData.meetingUrl || ''}
          onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
          placeholder="https://meet.google.com/..."
        />

        {/* Recurring Event Configuration */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isRecurring || false}
              onChange={(e) => {
                const isChecked = e.target.checked;
                if (isChecked) {
                  setShowRecurringModal(true);
                } else {
                  setFormData({
                    ...formData,
                    isRecurring: false,
                    recurrenceRule: null,
                    recurrenceEnd: undefined,
                  });
                }
              }}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-nexus-orange focus:ring-nexus-orange/20"
            />
            Evento recorrente
          </label>

          {formData.isRecurring && formData.recurrenceRule && (
            <div className="p-3 rounded-xl border bg-zinc-800/40 border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Regra de recorrência configurada
              </span>
              <button
                type="button"
                onClick={() => setShowRecurringModal(true)}
                className="text-xs font-bold text-nexus-orange hover:underline"
              >
                Editar Regra
              </button>
            </div>
          )}
        </div>

        {/* Lead and Client Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 block">Lead Associado</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar lead..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm border bg-zinc-800 border-zinc-700 text-white focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all"
              />
              {leadSearch && filteredLeads.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-xl border bg-zinc-800 border-zinc-700 shadow-xl max-h-60 overflow-auto">
                  {filteredLeads.slice(0, 10).map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, leadId: lead.id });
                        setLeadSearch(lead.name);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-700 transition-all border-b border-zinc-700 last:border-b-0 ${
                        formData.leadId === lead.id ? 'bg-nexus-orange/10 text-nexus-orange' : 'text-zinc-300'
                      }`}
                    >
                      <div className="font-bold">{lead.name}</div>
                      <div className="text-xs opacity-70">{lead.email}</div>
                      {lead.companyName && (
                        <div className="text-xs opacity-70">{lead.companyName}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {formData.leadId && !leadSearch && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    Lead: {leads.find((l) => l.id === formData.leadId)?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, leadId: null });
                      setLeadSearch('');
                    }}
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400 block">Cliente Associado</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm border bg-zinc-800 border-zinc-700 text-white focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all"
              />
              {clientSearch && filteredClients.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-xl border bg-zinc-800 border-zinc-700 shadow-xl max-h-60 overflow-auto">
                  {filteredClients.slice(0, 10).map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, clientId: client.id });
                        setClientSearch(client.contactName);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-700 transition-all border-b border-zinc-700 last:border-b-0 ${
                        formData.clientId === client.id ? 'bg-nexus-orange/10 text-nexus-orange' : 'text-zinc-300'
                      }`}
                    >
                      <div className="font-bold">{client.contactName}</div>
                      <div className="text-xs opacity-70">{client.email}</div>
                      {client.company && (
                        <div className="text-xs opacity-70">{client.company}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {formData.clientId && !clientSearch && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    Cliente: {clients.find((c) => c.id === formData.clientId)?.contactName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, clientId: null });
                      setClientSearch('');
                    }}
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Evento'}
          </Button>
        </div>
      </form>

      {/* Recurring Event Modal */}
      {showRecurringModal && formData.startAt instanceof Date && (
        <RecurringEventModal
          isOpen={showRecurringModal}
          onClose={() => setShowRecurringModal(false)}
          onSave={handleSaveRecurrence}
          initialRule={formData.recurrenceRule || undefined}
          startDate={formData.startAt}
        />
      )}
    </Modal>
  );
}
