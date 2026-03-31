import {
  TrendingUp,
  TrendingDown,
  Clock,
  CalendarClock,
  FileText,
  Loader2,
  FileX,
  Repeat,
} from 'lucide-react';
import { useClientTransactions } from '@/features/finance/hooks/useFinance';
import { useUIStore } from '@/stores/useUIStore';
import type { Transaction } from '@/features/finance/types';

// ──────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

export function ClientFinanceTab({ clientId }: Props) {
  const isDark = useUIStore((s) => s.theme === 'dark');
  const { data, isLoading } = useClientTransactions(clientId);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 animate-in fade-in duration-300">
        <Loader2 size={24} className="animate-spin text-nexus-orange" />
        <span className="text-sm text-zinc-500">Carregando financeiro...</span>
      </div>
    );
  }

  // ── Empty state ──
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 animate-in fade-in duration-300">
        <FileX size={32} className="text-zinc-500" />
        <span className="text-sm text-zinc-500">Dados financeiros não encontrados.</span>
      </div>
    );
  }

  const { totals, upcoming, transactions } = data;

  // ── Helpers ──
  const cardClass = `p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'}`;

  function daysRemainingColor(days: number) {
    if (days <= 2) return 'bg-red-500/10 text-red-500';
    if (days <= 5) return 'bg-amber-500/10 text-amber-500';
    return 'bg-emerald-500/10 text-emerald-500';
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── 3 Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Pago */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Pago</p>
              <p className={`text-2xl font-bold font-mono mt-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {totals.paidFormatted}
              </p>
            </div>
            <TrendingUp className={`${isDark ? 'text-emerald-400' : 'text-emerald-600'} opacity-50`} size={32} />
          </div>
        </div>

        {/* Total Pendente */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Pendente</p>
              <p className={`text-2xl font-bold font-mono mt-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {totals.pendingFormatted}
              </p>
            </div>
            <Clock className={`${isDark ? 'text-amber-400' : 'text-amber-600'} opacity-50`} size={32} />
          </div>
        </div>

        {/* Total Vencido */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Vencido</p>
              <p className={`text-2xl font-bold font-mono mt-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {totals.overdueFormatted}
              </p>
            </div>
            <TrendingDown className={`${isDark ? 'text-red-400' : 'text-red-600'} opacity-50`} size={32} />
          </div>
        </div>
      </div>

      {/* ── Próximos Vencimentos ── */}
      {upcoming && upcoming.length > 0 && (
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/20 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
          <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
            <CalendarClock size={14} className="text-amber-400" /> Próximos Vencimentos (7 dias)
          </div>
          <div className={`divide-y ${isDark ? 'divide-zinc-700/50' : 'divide-zinc-200'}`}>
            {upcoming.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                    {u.description}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{u.dueDateFormatted}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className={`text-sm font-bold font-mono ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                    {u.amountFormatted}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${daysRemainingColor(u.daysRemaining)}`}>
                    {u.daysRemaining === 0 ? 'Hoje' : u.daysRemaining === 1 ? '1 dia' : `${u.daysRemaining} dias`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Histórico de Transações ── */}
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/20 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
            <FileText size={14} className="text-indigo-400" /> Histórico de Transações
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}>
            {transactions.length} {transactions.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-center text-xs text-zinc-500 italic py-8">
            Nenhuma transação registrada.
          </p>
        ) : (
          <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
            {/* Mobile: card view */}
            <div className={`md:hidden divide-y ${isDark ? 'divide-zinc-700/50' : 'divide-zinc-100'}`}>
              {transactions.map((t: Transaction) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                        {t.isRecurring && <Repeat size={10} className="inline mr-1.5 text-zinc-400" />}
                        {t.description}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {t.categoryLabel} · {t.dateFormatted}
                        {t.dueDateFormatted && ` · Venc. ${t.dueDateFormatted}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold font-mono ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        {t.amountFormatted}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.statusColor}`}>
                        {t.statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table view */}
            <table className="hidden md:table w-full text-left text-sm">
              <thead className={`${isDark ? 'bg-zinc-950/30 text-zinc-500' : 'bg-zinc-50 text-zinc-400'} text-xs font-bold uppercase`}>
                <tr>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Categoria</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-700/50' : 'divide-zinc-100'}`}>
                {transactions.map((t: Transaction) => (
                  <tr key={t.id} className={`${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-zinc-50'}`}>
                    <td className={`px-4 py-3 font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                      {t.isRecurring && <Repeat size={10} className="inline mr-1.5 text-zinc-400" />}
                      {t.description}
                    </td>
                    <td className={`px-4 py-3 font-mono font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                      {t.amountFormatted}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{t.dateFormatted}</td>
                    <td className="px-4 py-3 text-zinc-500">{t.dueDateFormatted || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.statusColor}`}>
                        {t.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{t.categoryLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
