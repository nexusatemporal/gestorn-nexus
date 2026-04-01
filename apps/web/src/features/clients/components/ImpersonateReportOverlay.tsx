import { useState } from 'react';
import { FileText, User, Clock, MessageSquare, X, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useSaveImpersonateReport, type ImpersonateLog } from '../hooks/useClientModules';

interface Props {
  log: ImpersonateLog;
  clientId: string;
  onClose: () => void;
}

export function ImpersonateReportOverlay({ log, clientId, onClose }: Props) {
  const isDark = useUIStore((s) => s.theme === 'dark');
  const [report, setReport] = useState('');
  const saveMutation = useSaveImpersonateReport();

  const handleSave = async () => {
    if (!report.trim()) return;
    await saveMutation.mutateAsync({ clientId, logId: log.id, report: report.trim() });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className={cn('absolute inset-0 rounded-2xl', isDark ? 'bg-zinc-950/80' : 'bg-zinc-100/80')} />

      {/* Card */}
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl border p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200 shadow-xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-indigo-500/10' : 'bg-indigo-50')}>
              <FileText size={16} className="text-indigo-500" />
            </div>
            <div>
              <h3 className={cn('text-sm font-bold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
                Relatório de Acesso
              </h3>
              <p className="text-[10px] text-zinc-500">Documente o que foi feito durante o impersonate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2.5 md:p-1.5 rounded-lg transition-colors',
              isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-zinc-400 hover:bg-zinc-100'
            )}
          >
            <X size={16} />
          </button>
        </div>

        {/* Info auto-preenchida */}
        <div className={cn(
          'grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl',
          isDark ? 'bg-zinc-800/60' : 'bg-zinc-50'
        )}>
          <div className="flex items-center gap-2">
            <User size={12} className="text-nexus-orange shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500">Desenvolvedor</p>
              <p className={cn('text-xs font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                {log.user?.name || 'Desconhecido'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare size={12} className="text-zinc-400 shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500">Motivo</p>
              <p className={cn('text-xs font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                {log.reason}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-green-500 shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500">Início</p>
              <p className={cn('text-xs font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                {new Date(log.startedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-red-400 shrink-0" />
            <div>
              <p className="text-[10px] text-zinc-500">Fim</p>
              <p className={cn('text-xs font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                {log.endedAt ? new Date(log.endedAt).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div>
          <label className={cn('text-xs font-semibold mb-1.5 block', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            O que foi feito?
          </label>
          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Descreva as ações realizadas durante o acesso..."
            rows={4}
            maxLength={2000}
            className={cn(
              'w-full px-3 py-3 md:py-2.5 rounded-xl border text-base md:text-sm resize-none transition-colors outline-none focus:ring-1 focus:ring-nexus-orange',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            )}
          />
          <p className="text-[10px] text-zinc-500 text-right mt-1">{report.length}/2000</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-3 md:py-2 rounded-xl text-sm md:text-xs font-semibold transition-colors',
              isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100'
            )}
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={!report.trim() || saveMutation.isPending}
            className="px-4 py-3 md:py-2 rounded-xl text-sm md:text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            Salvar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
