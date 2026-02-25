/**
 * Calendar Filters Component
 * Sidebar filters for event types
 */

import { Filter, Check } from '@/components/icons';
import { EventType, EVENT_TYPE_CONFIG } from '../types/calendar.types';
import { useUIStore } from '@/stores/useUIStore';

interface CalendarFiltersProps {
  selectedTypes: EventType[];
  onToggleType: (type: EventType) => void;
}

export function CalendarFilters({ selectedTypes, onToggleType }: CalendarFiltersProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const eventTypes = Object.values(EventType);

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
        <Filter size={14} className="text-nexus-orange" /> Filtros de Categoria
      </h3>
      <div className="flex flex-wrap gap-2">
        {eventTypes.map((type) => {
          const config = EVENT_TYPE_CONFIG[type];
          const isSelected = selectedTypes.includes(type);

          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-2 ${
                isSelected
                  ? `${config.bgColor} ${config.color.replace('text-', 'bg-').replace('700', '500')} border-transparent text-white shadow-lg shadow-black/5`
                  : isDark ? 'bg-zinc-800/50 border-zinc-800 text-zinc-500 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {isSelected && <Check size={12} />}
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
