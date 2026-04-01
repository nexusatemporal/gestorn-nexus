import { useState } from 'react';
import {
  Loader2,
  MessageSquareOff,
  Filter,
  User,
  Clock,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { useClientInteractions, type ImpersonateLog } from '../hooks/useClientModules';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';

interface Props {
  clientId: string;
}

export function ClientInteractionsTab({ clientId }: Props) {
  const isDark = useUIStore((s) => s.theme === 'dark');
  const [days, setDays] = useState(30);
  const { data: interactions = [], isLoading } = useClientInteractions(clientId, days);

  // ── Loading ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
        <Loader2 size={24} className="animate-spin text-nexus-orange" />
        <span className="text-sm text-zinc-500">Carregando interações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Filtro de período */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-zinc-500" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Período:
        </span>
        {[30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'px-3.5 py-2 md:px-3 md:py-1 rounded-full text-xs md:text-[10px] font-bold transition-colors',
              days === d
                ? 'bg-nexus-orange text-white'
                : isDark
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            )}
          >
            {d}d
          </button>
        ))}
        <span className="text-[10px] text-zinc-500 ml-auto">
          {interactions.length} {interactions.length === 1 ? 'relatório' : 'relatórios'}
        </span>
      </div>

      {/* Empty state */}
      {interactions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MessageSquareOff size={36} className="text-zinc-400" />
          <span className={cn('text-sm font-semibold', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            Nenhuma interação encontrada
          </span>
          <span className="text-xs text-zinc-500">
            Não há relatórios de impersonate nos últimos {days} dias.
          </span>
        </div>
      )}

      {/* Lista de interações */}
      {interactions.length > 0 && (
        <div className="space-y-3">
          {interactions.map((interaction: ImpersonateLog) => (
            <div
              key={interaction.id}
              className={cn(
                'p-4 md:p-5 rounded-2xl border space-y-3',
                isDark ? 'bg-zinc-800/40 border-zinc-700/60' : 'bg-white border-zinc-200 shadow-sm'
              )}
            >
              {/* Header: dev + data */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg', isDark ? 'bg-zinc-700' : 'bg-zinc-100')}>
                    <User size={13} className="text-nexus-orange" />
                  </div>
                  <span className={cn('text-sm font-bold', isDark ? 'text-zinc-200' : 'text-zinc-900')}>
                    {interaction.user?.name || 'Desconhecido'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 ml-8 sm:ml-0">
                  <Clock size={11} className="shrink-0" />
                  <span>{new Date(interaction.startedAt).toLocaleString('pt-BR')}</span>
                  {interaction.endedAt && (
                    <span className="text-zinc-400">
                      → {new Date(interaction.endedAt).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              {/* Motivo */}
              <div className="flex items-center gap-2">
                <MessageSquare size={11} className="text-zinc-400 shrink-0" />
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border font-semibold',
                  isDark ? 'bg-zinc-700/50 border-zinc-600 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                )}>
                  {interaction.reason}
                </span>
              </div>

              {/* Relatório */}
              <div className={cn(
                'p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap',
                isDark
                  ? 'bg-zinc-900/60 text-zinc-300 border-t border-r border-b border-zinc-700/50'
                  : 'bg-zinc-50 text-zinc-700 border-t border-r border-b border-zinc-200',
                'border-l-2 border-l-indigo-500/40'
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={11} className="text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Relatório</span>
                </div>
                {interaction.report}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
