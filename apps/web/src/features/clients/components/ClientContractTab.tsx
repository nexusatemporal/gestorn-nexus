import {
  FileText,
  CreditCard,
  BarChart2,
  Handshake,
  Users,
  HardDrive,
  Package,
  Loader2,
  FileX,
} from 'lucide-react';
import { useClientDetail } from '../hooks/useClientDetail';
import { useActiveSubscription } from '../hooks/useReactivateClient';
import { useUIStore } from '@/stores/useUIStore';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { SubscriptionDetail, PlanDetail } from '@/types';

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const BILLING_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CARTAO: 'Cartão de Crédito',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
};

const PAYMENT_GATEWAY_LABELS: Record<string, string> = {
  ABACATEPAY: 'AbacatePay',
  ASAAS: 'Asaas',
  MANUAL: 'Manual',
  STRIPE: 'Stripe',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Ativa' },
  TRIALING: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Trial' },
  PAST_DUE: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Vencida' },
  CANCELED: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Cancelada' },
  EXPIRED: { bg: 'bg-zinc-500/10', text: 'text-zinc-500', label: 'Expirada' },
};

function SubscriptionStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.EXPIRED;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.text.replace('text-', 'bg-')}`} />
      {style.label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

export function ClientContractTab({ clientId }: Props) {
  const isDark = useUIStore((s) => s.theme === 'dark');
  const { data: client, isLoading: clientLoading } = useClientDetail(clientId);
  const { data: subscription, isLoading: subLoading } = useActiveSubscription(clientId);

  const isLoading = clientLoading || subLoading;
  const sub = subscription as SubscriptionDetail | null;
  const plan = (sub?.plan || client?.plan) as PlanDetail | undefined;

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 animate-in fade-in duration-300">
        <Loader2 size={24} className="animate-spin text-nexus-orange" />
        <span className="text-sm text-zinc-500">Carregando contrato...</span>
      </div>
    );
  }

  // ── Empty state ──
  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 animate-in fade-in duration-300">
        <FileX size={32} className="text-zinc-500" />
        <span className="text-sm text-zinc-500">Dados do cliente não encontrados.</span>
      </div>
    );
  }

  // ── Helpers locais ──
  const cardClass = `p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'}`;
  const labelClass = 'text-xs text-zinc-500';
  const valueClass = `text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`;

  function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
    return (
      <div className="flex items-center gap-3">
        <span className={`${labelClass} w-[110px] shrink-0`}>{label}</span>
        <span className={highlight ? 'text-sm font-bold text-nexus-orange' : valueClass}>
          {value || '—'}
        </span>
      </div>
    );
  }

  function formatPeriod(start?: string | null, end?: string | null) {
    if (!start || !end) return '—';
    return `${formatDate(start)} → ${formatDate(end)}`;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── 3 Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1: Assinatura */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
            <FileText size={14} className="text-indigo-400" /> Assinatura
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`${labelClass} w-[110px] shrink-0`}>Status:</span>
              {sub ? (
                <SubscriptionStatusBadge status={sub.status} />
              ) : (
                <span className="text-xs text-zinc-500 italic">Sem assinatura</span>
              )}
            </div>
            <Row
              label="Ciclo:"
              value={BILLING_CYCLE_LABELS[sub?.billingCycle || client.billingCycle || 'MONTHLY']}
            />
            <Row
              label="Dia Vencimento:"
              value={sub?.billingAnchorDay ? `Dia ${sub.billingAnchorDay}` : undefined}
            />
            <Row
              label="Próx. Vencimento:"
              value={sub?.nextBillingDate ? formatDate(sub.nextBillingDate) : undefined}
              highlight
            />
            <Row
              label="Período Atual:"
              value={formatPeriod(sub?.currentPeriodStart, sub?.currentPeriodEnd)}
            />
            <Row
              label="Período de Graça:"
              value={sub?.gracePeriodDays ? `${sub.gracePeriodDays} dias` : undefined}
            />
          </div>
        </div>

        {/* Card 2: Valores */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
            <CreditCard size={14} className="text-green-400" /> Valores
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`${labelClass} w-[110px] shrink-0`}>Plano:</span>
              <div className="flex items-center gap-2">
                <span className={valueClass}>{plan?.name || '—'}</span>
                {plan?.code && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}>
                    {plan.code}
                  </span>
                )}
              </div>
            </div>
            <Row
              label="Valor Mensal:"
              value={plan?.priceMonthly != null ? formatCurrency(plan.priceMonthly) : undefined}
              highlight
            />
            <Row
              label="Valor Anual:"
              value={plan?.priceAnnual != null ? (
                <span className="flex items-center gap-1.5">
                  {formatCurrency(plan.priceAnnual)}
                  <span className="text-[9px] text-emerald-500 font-medium">10% desc.</span>
                </span>
              ) : undefined}
            />
            <Row
              label="Taxa de Setup:"
              value={plan?.setupFee != null ? formatCurrency(plan.setupFee) : undefined}
            />
            <Row
              label="Pagamento:"
              value={PAYMENT_METHOD_LABELS[client.paymentMethod || ''] || client.paymentMethod}
            />
            <Row
              label="Gateway:"
              value={PAYMENT_GATEWAY_LABELS[client.paymentGateway || ''] || client.paymentGateway}
            />
          </div>
        </div>

        {/* Card 3: Limites do Plano */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
            <BarChart2 size={14} className="text-nexus-orange" /> Limites do Plano
          </div>
          <div className="space-y-3">
            <Row
              label="Máx. Usuários:"
              value={plan?.maxUsers != null ? (
                <span className="flex items-center gap-1.5">
                  <Users size={12} className="text-zinc-400" /> {plan.maxUsers}
                </span>
              ) : undefined}
            />
            <Row
              label="Máx. Unidades:"
              value={plan?.maxUnits != null ? (
                <span className="flex items-center gap-1.5">
                  <Package size={12} className="text-zinc-400" /> {plan.maxUnits}
                </span>
              ) : undefined}
            />
            <Row
              label="Armazenamento:"
              value={plan?.storageGb != null ? (
                <span className="flex items-center gap-1.5">
                  <HardDrive size={12} className="text-zinc-400" /> {plan.storageGb} GB
                </span>
              ) : undefined}
            />
            <Row
              label="Módulos Incluídos:"
              value={plan?.includedModules ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}>
                  {Array.isArray(plan.includedModules) ? plan.includedModules.length : 0} módulos
                </span>
              ) : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Detalhes da Negociação ── */}
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/20 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
        <div className="flex items-center gap-2 text-zinc-500 mb-6 font-bold text-[10px] uppercase tracking-widest">
          <Handshake size={14} className="text-amber-400" /> Detalhes da Negociação
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
          <div className="space-y-3">
            <Row
              label="Data de Fechamento:"
              value={client.closedAt ? formatDate(client.closedAt) : undefined}
            />
            <Row
              label="Primeiro Pagamento:"
              value={client.firstPaymentDate ? formatDate(client.firstPaymentDate) : undefined}
            />
          </div>
          <div className="space-y-3">
            <Row
              label="Nº Usuários Contratados:"
              value={client.numberOfUsers}
            />
            <Row
              label="Trial até:"
              value={client.trialEndsAt ? formatDate(client.trialEndsAt) : undefined}
            />
          </div>
        </div>

        {/* Resumo da Negociação */}
        {client.dealSummary && (
          <div className="mt-6">
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Resumo da Negociação
            </span>
            <div className={`mt-2 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-white text-zinc-700 border border-zinc-200'}`}>
              {client.dealSummary}
            </div>
          </div>
        )}

        {/* Notas de Implementação */}
        {client.implementationNotes && (
          <div className="mt-4">
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Notas de Implementação
            </span>
            <div className={`mt-2 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-white text-zinc-700 border border-zinc-200'}`}>
              {client.implementationNotes}
            </div>
          </div>
        )}

        {/* Se não tem nenhum detalhe de negociação */}
        {!client.dealSummary && !client.implementationNotes && !client.closedAt && !client.firstPaymentDate && (
          <p className="mt-4 text-center text-xs text-zinc-500 italic">
            Nenhum detalhe de negociação registrado.
          </p>
        )}
      </div>
    </div>
  );
}
