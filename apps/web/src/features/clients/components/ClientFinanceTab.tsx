import {
  Clock,
  CalendarClock,
  Loader2,
  FileX,
  Repeat,
  CheckCircle2,
  AlertCircle,
  XCircle,
  DollarSign,
  Wallet,
  ReceiptText,
} from 'lucide-react';
import { useClientTransactions } from '@/features/finance/hooks/useFinance';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import type { Transaction } from '@/features/finance/types';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ElementType;
  label: string;
  iconColor?: string;
  badge?: React.ReactNode;
}

function SectionHeader({
  icon: Icon,
  label,
  iconColor = 'text-zinc-400',
  badge,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-6 py-4">
      <Icon size={13} className={iconColor} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex-1">
        {label}
      </span>
      {badge}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────

export function ClientFinanceTab({ clientId }: Props) {
  const isDark = useUIStore((s) => s.theme === 'dark');
  const { data, isLoading } = useClientTransactions(clientId);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
        <Loader2 size={24} className="animate-spin text-nexus-orange" />
        <span className="text-sm text-zinc-500">Carregando financeiro...</span>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
        <FileX size={36} className="text-zinc-400" />
        <span
          className={cn(
            'text-sm font-semibold',
            isDark ? 'text-zinc-300' : 'text-zinc-700'
          )}
        >
          Dados não encontrados
        </span>
        <span className="text-xs text-zinc-500">
          Este cliente não possui histórico financeiro.
        </span>
      </div>
    );
  }

  const { totals, upcoming, transactions } = data;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function daysRemainingBadge(days: number) {
    if (days === 0)
      return { cls: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Hoje' };
    if (days === 1)
      return { cls: 'bg-red-500/10 text-red-500 border-red-500/20', label: '1 dia' };
    if (days <= 3)
      return { cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20', label: `${days} dias` };
    return {
      cls: 'bg-green-500/10 text-green-500 border-green-500/20',
      label: `${days} dias`,
    };
  }

  // KPI cards — padrão mini-card idêntico ao da aba Contrato.
  // Diferenciação de status feita apenas pelo dot colorido, não pelo valor.
  const kpis = [
    {
      label: 'Total Pago',
      value: totals.paidFormatted,
      icon: Wallet,
      dotColor: 'bg-green-500',
    },
    {
      label: 'Pendente',
      value: totals.pendingFormatted,
      icon: Clock,
      dotColor: 'bg-amber-500',
    },
    {
      label: 'Vencido',
      value: totals.overdueFormatted,
      icon: AlertCircle,
      dotColor: 'bg-red-500',
    },
  ] as const;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 p-3 md:p-4 rounded-xl text-center',
                isDark
                  ? 'bg-zinc-900/60 border border-zinc-700/40'
                  : 'bg-zinc-50 border border-zinc-200'
              )}
            >
              {/* Ícone em container sutil — sempre laranja */}
              <div
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                <Icon size={15} className="text-nexus-orange" />
              </div>

              {/* Valor monetário — cor neutra, font-mono */}
              <p
                className={cn(
                  'text-sm md:text-base font-bold font-mono leading-tight',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}
              >
                {kpi.value}
              </p>

              {/* Label com dot de status */}
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={cn('w-1.5 h-1.5 rounded-full shrink-0', kpi.dotColor)}
                  aria-hidden="true"
                />
                <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase tracking-wide font-bold leading-none">
                  {kpi.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Próximos Vencimentos ────────────────────────────────────────── */}
      {upcoming && upcoming.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border overflow-hidden',
            isDark
              ? 'bg-zinc-800/40 border-zinc-700/60'
              : 'bg-white border-zinc-200 shadow-sm'
          )}
        >
          {/* Header */}
          <div
            className={cn(
              'border-b',
              isDark ? 'border-zinc-700/60' : 'border-zinc-200'
            )}
          >
            <SectionHeader
              icon={CalendarClock}
              label="Próximos Vencimentos"
              iconColor="text-amber-400"
              badge={
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    isDark
                      ? 'bg-zinc-700/60 border-zinc-600 text-zinc-400'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                  )}
                >
                  7 dias
                </span>
              }
            />
          </div>

          {/* Items */}
          <div
            className={cn(
              'divide-y',
              isDark ? 'divide-zinc-700/40' : 'divide-zinc-100'
            )}
          >
            {upcoming.map((u: any) => {
              const badge = daysRemainingBadge(u.daysRemaining);
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-3 px-6 py-4 transition-colors',
                    isDark ? 'hover:bg-zinc-700/20' : 'hover:bg-zinc-50/80'
                  )}
                >
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0',
                      isDark ? 'bg-zinc-700/50' : 'bg-zinc-100'
                    )}
                  >
                    <DollarSign size={14} className="text-nexus-orange" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-semibold truncate',
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      )}
                    >
                      {u.description}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{u.dueDateFormatted}</p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={cn(
                        'text-sm font-bold font-mono',
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      )}
                    >
                      {u.amountFormatted}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
                        badge.cls
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Histórico de Transações ─────────────────────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          isDark
            ? 'bg-zinc-800/40 border-zinc-700/60'
            : 'bg-white border-zinc-200 shadow-sm'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'border-b',
            isDark ? 'border-zinc-700/60' : 'border-zinc-200'
          )}
        >
          <SectionHeader
            icon={ReceiptText}
            label="Histórico de Transações"
            iconColor="text-indigo-400"
            badge={
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  isDark
                    ? 'bg-zinc-700/60 border-zinc-600 text-zinc-400'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                )}
              >
                {transactions.length}{' '}
                {transactions.length === 1 ? 'registro' : 'registros'}
              </span>
            }
          />
        </div>

        {/* Empty */}
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <FileX size={32} className="text-zinc-400" />
            <p
              className={cn(
                'text-sm font-semibold',
                isDark ? 'text-zinc-300' : 'text-zinc-600'
              )}
            >
              Nenhuma transação registrada
            </p>
            <p className="text-xs text-zinc-500">O histórico financeiro aparecerá aqui.</p>
          </div>
        ) : (
          <>
            {/* MOBILE — Card list */}
            <div
              className={cn(
                'md:hidden divide-y',
                isDark ? 'divide-zinc-700/40' : 'divide-zinc-100'
              )}
            >
              {transactions.map((t: Transaction) => (
                <div
                  key={t.id}
                  className={cn(
                    'px-4 py-3.5 transition-colors',
                    isDark ? 'hover:bg-zinc-700/20' : 'hover:bg-zinc-50/80'
                  )}
                >
                  {/* Row 1: descrição + valor */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {t.isRecurring && (
                        <Repeat
                          size={11}
                          className="shrink-0 text-zinc-400"
                          aria-label="Recorrente"
                        />
                      )}
                      <p
                        className={cn(
                          'text-sm font-semibold truncate',
                          isDark ? 'text-zinc-200' : 'text-zinc-800'
                        )}
                      >
                        {t.description}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'text-sm font-bold font-mono shrink-0',
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      )}
                    >
                      {t.amountFormatted}
                    </p>
                  </div>

                  {/* Row 2: status + categoria + data */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                        t.statusColor
                      )}
                    >
                      {t.statusLabel}
                    </span>
                    <span className="text-[10px] text-zinc-500">{t.categoryLabel}</span>
                    {t.dueDateFormatted && (
                      <>
                        <span className="text-zinc-600/40 text-[10px]">·</span>
                        <span className="text-[10px] text-zinc-500">
                          Venc. {t.dueDateFormatted}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP — Table */}
            <table className="hidden md:table w-full text-left">
              <thead
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  isDark
                    ? 'bg-zinc-950/30 text-zinc-500'
                    : 'bg-zinc-50 text-zinc-400'
                )}
              >
                <tr>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4">Criado em</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Categoria</th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  'divide-y text-sm',
                  isDark ? 'divide-zinc-700/40' : 'divide-zinc-100'
                )}
              >
                {transactions.map((t: Transaction) => (
                  <tr
                    key={t.id}
                    className={cn(
                      'transition-colors',
                      isDark ? 'hover:bg-zinc-700/20' : 'hover:bg-zinc-50/80'
                    )}
                  >
                    {/* Descrição */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {t.isRecurring && (
                          <Repeat
                            size={12}
                            className="text-zinc-400 shrink-0"
                            aria-label="Recorrente"
                          />
                        )}
                        <span
                          className={cn(
                            'font-medium',
                            isDark ? 'text-zinc-200' : 'text-zinc-800'
                          )}
                        >
                          {t.description}
                        </span>
                      </div>
                    </td>

                    {/* Valor */}
                    <td
                      className={cn(
                        'px-6 py-4 font-mono font-bold text-right',
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      )}
                    >
                      {t.amountFormatted}
                    </td>

                    {/* Data */}
                    <td className="px-6 py-4 text-zinc-500">{t.dateFormatted}</td>

                    {/* Vencimento */}
                    <td className="px-6 py-4 text-zinc-500">
                      {t.dueDateFormatted ?? '—'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border',
                          t.statusColor
                        )}
                      >
                        {t.statusLabel === 'Pago' && <CheckCircle2 size={9} />}
                        {t.statusLabel === 'Pendente' && <Clock size={9} />}
                        {t.statusLabel === 'Vencido' && <AlertCircle size={9} />}
                        {t.statusLabel === 'Cancelado' && <XCircle size={9} />}
                        {t.statusLabel}
                      </span>
                    </td>

                    {/* Categoria */}
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {t.categoryLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
