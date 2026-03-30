import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, CalendarDays, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/stores/useUIStore';

interface SearchResult {
  type: 'lead' | 'client' | 'event';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResponse {
  leads: SearchResult[];
  clients: SearchResult[];
  events: SearchResult[];
}

interface SearchDropdownProps {
  data: SearchResponse | undefined;
  isLoading: boolean;
  query: string;
  onClose: () => void;
}

const CATEGORY_CONFIG = {
  leads: { label: 'Leads', icon: Users, color: 'text-blue-500' },
  clients: { label: 'Clientes', icon: UserCheck, color: 'text-green-500' },
  events: { label: 'Eventos', icon: CalendarDays, color: 'text-orange-500' },
} as const;

export function SearchDropdown({ data, isLoading, query, onClose }: SearchDropdownProps) {
  const navigate = useNavigate();
  const isDark = useUIStore((s) => s.theme) === 'dark';

  const handleSelect = (item: SearchResult) => {
    onClose();
    navigate(`${item.url}?search=${encodeURIComponent(item.title)}`);
  };

  const totalResults = data
    ? data.leads.length + data.clients.length + data.events.length
    : 0;

  if (query.trim().length < 2) return null;

  return (
    <div
      className={cn(
        'absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Buscando...</span>
        </div>
      )}

      {/* No results */}
      {!isLoading && data && totalResults === 0 && (
        <div className="py-8 text-center text-sm text-zinc-500">
          Nenhum resultado para &quot;{query}&quot;
        </div>
      )}

      {/* Results */}
      {!isLoading && data && totalResults > 0 && (
        <>
          {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((category) => {
            const items = data[category];
            if (items.length === 0) return null;

            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;

            return (
              <div key={category}>
                {/* Category header */}
                <div
                  className={cn(
                    'px-4 py-2 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5',
                    isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-50 text-zinc-400'
                  )}
                >
                  <Icon size={12} className={config.color} />
                  {config.label} ({items.length})
                </div>

                {/* Items */}
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
                    )}
                  >
                    <Icon size={14} className={cn(config.color, 'shrink-0')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium truncate', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{item.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
