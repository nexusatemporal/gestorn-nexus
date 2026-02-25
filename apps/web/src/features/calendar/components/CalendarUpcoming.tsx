/**
 * Calendar Upcoming Events Component
 * Displays upcoming events in the sidebar
 */

import { Bell, ArrowUpRight } from '@/components/icons';
import { CalendarEvent, EVENT_TYPE_CONFIG, getUpcomingEvents } from '../types/calendar.types';
import { useUIStore } from '@/stores/useUIStore';

interface CalendarUpcomingProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function CalendarUpcoming({ events, onEventClick }: CalendarUpcomingProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const upcomingEvents = getUpcomingEvents(events, 5);

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
        <Bell size={14} className="text-nexus-orange" /> Próximos Eventos
      </h3>
      <div className="space-y-4">
        {upcomingEvents.map((event) => {
          const config = EVENT_TYPE_CONFIG[event.type];

          return (
            <div
              key={event.id}
              onClick={() => onEventClick(event)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all group ${isDark ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${config.bgColor}`}
                >
                  {config.label}
                </span>
                <span className="text-[10px] font-bold text-zinc-500">
                  {new Date(event.startAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              <h4 className={`text-xs font-bold truncate group-hover:text-nexus-orange transition-colors ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                {event.title}
              </h4>
              {event.lead && (
                <p className="text-[10px] text-zinc-500 mt-1 truncate">{event.lead.name}</p>
              )}
              {event.client && (
                <p className="text-[10px] text-zinc-500 mt-1 truncate">
                  {event.client.contactName}
                </p>
              )}
              <button className="mt-3 text-[10px] font-bold text-nexus-orange flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                Ver Detalhes <ArrowUpRight size={10} />
              </button>
            </div>
          );
        })}
        {upcomingEvents.length === 0 && (
          <p className={`text-xs italic ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Sem eventos futuros.</p>
        )}
      </div>
    </div>
  );
}
