/**
 * Calendar Event Detail Component
 * Modal displaying full event details
 */

import { Calendar, Clock, MapPin, User, Building2, Mail, Phone, Edit2, Trash2, ExternalLink } from '@/components/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useDeleteCalendarEvent } from '../hooks/useCalendarEvents';
import type { CalendarEvent } from '../types/calendar.types';
import { EVENT_TYPE_CONFIG, formatEventDate } from '../types/calendar.types';

interface CalendarEventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}

export function CalendarEventDetail({ event, onClose, onEdit }: CalendarEventDetailProps) {
  const deleteMutation = useDeleteCalendarEvent();
  const config = EVENT_TYPE_CONFIG[event.type];

  const handleDelete = async () => {
    if (confirm('Deseja realmente excluir este evento?')) {
      try {
        await deleteMutation.mutateAsync(event.id);
        onClose();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="xl" showCloseButton={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`p-4 rounded-3xl text-white shadow-lg ${config.bgColor}`}
            >
              <Calendar size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{event.title}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className={`text-[9px] font-black uppercase px-3 py-1 rounded-full text-white ${config.bgColor}`}
                >
                  {config.label}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  ID: {event.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">
              Data & Horário
            </span>
            <p className="text-sm font-bold flex items-center gap-2 text-zinc-200">
              <Clock size={16} className="text-nexus-orange" />
              {formatEventDate(event.startAt)}
            </p>
          </div>

          {event.location && (
            <div className="space-y-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">
                Localização
              </span>
              <p className="text-sm font-bold flex items-center gap-2 text-zinc-200">
                <MapPin size={16} className="text-nexus-orange" />
                {event.location}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="space-y-2">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">
              Descrição
            </span>
            <p className="text-sm text-zinc-300 leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* Lead/Client Information */}
        {(event.lead || event.client) && (
          <div className="p-6 rounded-2xl border bg-zinc-800/40 border-zinc-800">
            <h3 className="text-xs font-black uppercase text-nexus-orange mb-4 flex items-center gap-2 tracking-widest">
              <User size={14} /> Detalhes do {event.lead ? 'Lead' : 'Cliente'}
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Nome</span>
                <p className="text-sm font-bold text-white">
                  {event.lead?.name || event.client?.contactName}
                </p>
              </div>

              {event.client && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Empresa</span>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-nexus-orange" />
                    <button className="text-xs text-nexus-orange hover:underline flex items-center gap-1">
                      Ver Cliente <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )}

              {(event.lead?.email || event.client?.email) && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Email</span>
                  <p className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                    <Mail size={12} />
                    {event.lead?.email || event.client?.email}
                  </p>
                </div>
              )}

              {(event.lead?.phone || event.client?.phone) && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Telefone</span>
                  <p className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                    <Phone size={12} />
                    {event.lead?.phone || event.client?.phone}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meeting URL */}
        {event.meetingUrl && (
          <div className="flex items-center justify-between p-4 rounded-xl border bg-zinc-800/40 border-zinc-800">
            <span className="text-sm font-bold text-zinc-300">Link da Reunião</span>
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-nexus-orange text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-nexus-orangeDark transition-all"
            >
              Abrir Reunião
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-zinc-800">
          <Button
            onClick={handleDelete}
            variant="danger"
            size="sm"
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={16} />
            {deleteMutation.isPending ? ' Excluindo...' : ''}
          </Button>
          <div className="flex-1" />
          <Button onClick={() => onEdit(event)} variant="secondary" size="sm">
            <Edit2 size={16} className="mr-2" />
            Editar
          </Button>
          <Button onClick={onClose} variant="primary" size="sm">
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
