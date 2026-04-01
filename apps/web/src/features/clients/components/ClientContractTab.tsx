import { useState } from 'react';
import {
  FileText,
  BarChart2,
  Handshake,
  Users,
  HardDrive,
  Package,
  Loader2,
  FileX,
  CalendarDays,
  RefreshCcw,
  Banknote,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock4,
  XCircle,
  CircleDot,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Calendar,
  Heart,
  Scissors,
  DollarSign,
  Megaphone,
  MessageSquare,
  Settings,
  LayoutDashboard,
  Target,
  ClipboardList,
  Camera,
  Brain,
  BookOpen,
  ShoppingCart,
  Truck,
  Bell,
  PieChart,
  Star,
  Globe,
  Instagram,
  Link,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import { useClientDetail } from '../hooks/useClientDetail';
import { useActiveSubscription } from '../hooks/useReactivateClient';
import { useClientTenant, useModulesTree } from '../hooks/useClientModules';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { SubscriptionDetail, PlanDetail } from '@/types';

// ──────────────────────────────────────────────────────────────────────────
// Módulos — mapas de ícones e cores (espelho do ClientModulesTab)
// ──────────────────────────────────────────────────────────────────────────

const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  sales: TrendingUp,
  agenda: Calendar,
  patients: Heart,
  procedures: Scissors,
  financial: DollarSign,
  stock: Package,
  bi: BarChart2,
  marketing: Megaphone,
  nexus_chat: MessageSquare,
  collaboration: Layers,
  settings: Settings,
  'sales.leads': Users,
  'sales.opportunities': Target,
  'sales.proposals': FileText,
  'sales.team': Users,
  'sales.commissions': DollarSign,
  'sales.goals': Target,
  'sales.campaigns': Megaphone,
  'sales.dashboard': LayoutDashboard,
  'agenda.calendar': Calendar,
  'agenda.waitlist': ClipboardList,
  'patients.list': Users,
  'patients.medical_records': ClipboardList,
  'patients.forms': FileText,
  'patients.chat': MessageSquare,
  'patients.photos': Camera,
  'patients.sessions': BookOpen,
  'procedures.catalog': ClipboardList,
  'procedures.analytics': BarChart2,
  'procedures.packages': Package,
  'procedures.memberships': Star,
  'procedures.coupons': Target,
  'financial.dashboard': LayoutDashboard,
  'financial.transactions': DollarSign,
  'financial.bank_reconciliation': BookOpen,
  'financial.receipts': FileText,
  'financial.categories': Layers,
  'financial.goals': Target,
  'stock.dashboard': LayoutDashboard,
  'stock.products': Package,
  'stock.movements': TrendingUp,
  'stock.purchase_orders': ShoppingCart,
  'stock.suppliers': Truck,
  'stock.alerts': Bell,
  'stock.inventory_counts': ClipboardList,
  'stock.reports': BarChart2,
  'bi.dashboard': LayoutDashboard,
  'bi.forecasting': TrendingUp,
  'bi.comparative': BarChart2,
  'bi.goals_okrs': Target,
  'bi.reports': PieChart,
  'bi.alerts': Bell,
  'marketing.ads': Megaphone,
  'marketing.ai_content': Brain,
  'marketing.automation': Settings,
  'marketing.reputation': Star,
  'marketing.referral': Link,
  'marketing.reports': BarChart2,
  'marketing.instagram': Instagram,
  'marketing.whatsapp': MessageSquare,
  'marketing.landing_pages': Globe,
  'collab.hub': Layers,
  'collab.feed': BookOpen,
  'collab.calendar': Calendar,
  'collab.wiki': FileText,
  'collab.kudos': Star,
  'collab.analytics': BarChart2,
  'settings.team': Users,
  'settings.roles': Settings,
  'settings.units': Layers,
  'settings.rooms': LayoutGrid,
  'settings.blocks': Package,
  'settings.reminders': Bell,
  'settings.tags': Target,
  'settings.financial_categories': DollarSign,
  'settings.whatsapp_templates': MessageSquare,
  // fallback por icon name string
  TrendingUp,
  Users,
  Calendar,
  Heart,
  Scissors,
  DollarSign,
  Package,
  BarChart2,
  Megaphone,
  MessageSquare,
  Layers,
  Settings,
  LayoutDashboard,
  Target,
};

const MODULE_PARENT_COLORS: Record<string, string> = {
  dashboard:     'text-orange-500 bg-orange-500/10 border-orange-500/20',
  sales:         'text-green-500 bg-green-500/10 border-green-500/20',
  agenda:        'text-blue-500 bg-blue-500/10 border-blue-500/20',
  patients:      'text-pink-500 bg-pink-500/10 border-pink-500/20',
  procedures:    'text-purple-500 bg-purple-500/10 border-purple-500/20',
  financial:     'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  stock:         'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  bi:            'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  marketing:     'text-rose-500 bg-rose-500/10 border-rose-500/20',
  nexus_chat:    'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  collaboration: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  settings:      'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

function getModuleIcon(slug: string, iconName: string): LucideIcon {
  return MODULE_ICON_MAP[slug] ?? MODULE_ICON_MAP[iconName] ?? LayoutGrid;
}

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

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ElementType; dot: string }
> = {
  ACTIVE: {
    label: 'Ativa',
    badge: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: CheckCircle2,
    dot: 'bg-green-500',
  },
  TRIALING: {
    label: 'Trial',
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: CircleDot,
    dot: 'bg-blue-500',
  },
  PAST_DUE: {
    label: 'Vencida',
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: AlertCircle,
    dot: 'bg-amber-500',
  },
  CANCELED: {
    label: 'Cancelada',
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: XCircle,
    dot: 'bg-red-500',
  },
  EXPIRED: {
    label: 'Expirada',
    badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    icon: Clock4,
    dot: 'bg-zinc-500',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.EXPIRED;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
        cfg.badge
      )}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  mono?: boolean;
  isDark: boolean;
}

function DataRow({ label, value, accent, mono, isDark }: DataRowProps) {
  if (value === null || value === undefined || value === '') {
    return (
      <div
        className={cn(
          'flex items-start justify-between gap-4 py-2.5 border-b last:border-b-0 border-dashed',
          isDark ? 'border-zinc-700/50' : 'border-zinc-200/60'
        )}
      >
        <span className={cn('text-xs shrink-0', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          {label}
        </span>
        <span className="text-xs text-zinc-400 italic">—</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 py-2.5 border-b last:border-b-0 border-dashed',
        isDark ? 'border-zinc-700/50' : 'border-zinc-200/60'
      )}
    >
      <span className={cn('text-xs shrink-0', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        {label}
      </span>
      <span
        className={cn(
          'text-xs font-semibold text-right',
          accent && 'text-nexus-orange',
          mono && 'font-mono',
          !accent && (isDark ? 'text-zinc-200' : 'text-zinc-800')
        )}
      >
        {value}
      </span>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ElementType;
  label: string;
  iconColor?: string;
}

function SectionHeader({ icon: Icon, label, iconColor = 'text-zinc-400' }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 mb-4', iconColor)}>
      <Icon size={13} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

export function ClientContractTab({ clientId }: Props) {
  const isDark = useUIStore((s) => s.theme === 'dark');
  const { data: client, isLoading: clientLoading } = useClientDetail(clientId);
  const { data: subscription, isLoading: subLoading } = useActiveSubscription(clientId);
  const { data: tenant } = useClientTenant(clientId);
  const isProvisioned = tenant?.provisioningStatus === 'PROVISIONED';
  const { data: modulesTree = [], isLoading: modulesLoading } = useModulesTree(tenant?.id, isProvisioned);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const isLoading = clientLoading || subLoading;
  const sub = subscription as SubscriptionDetail | null;
  const plan = (sub?.plan || client?.plan) as PlanDetail | undefined;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
        <Loader2 size={24} className="animate-spin text-nexus-orange" />
        <span className="text-sm text-zinc-500">Carregando contrato...</span>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
        <FileX size={36} className="text-zinc-400" />
        <span className={cn('text-sm font-semibold', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          Dados não encontrados
        </span>
        <span className="text-xs text-zinc-500">Este cliente não possui informações de contrato.</span>
      </div>
    );
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card = cn(
    'rounded-2xl border p-5',
    isDark ? 'bg-zinc-800/40 border-zinc-700/60' : 'bg-white border-zinc-200 shadow-sm'
  );

  function formatPeriod(start?: string | null, end?: string | null) {
    if (!start && !end) return null;
    if (start && end) return `${formatDate(start)} até ${formatDate(end)}`;
    if (start) return `A partir de ${formatDate(start)}`;
    return null;
  }

  const billingCycleLabel =
    BILLING_CYCLE_LABELS[sub?.billingCycle ?? client.billingCycle ?? 'MONTHLY'] ?? '—';
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[client.paymentMethod ?? ''] ?? client.paymentMethod ?? null;
  const paymentGatewayLabel =
    PAYMENT_GATEWAY_LABELS[client.paymentGateway ?? ''] ?? client.paymentGateway ?? null;

  // Módulos reais ativados no tenant (dinâmico, via One Nexus API)
  const enabledParents = modulesTree.filter((m) => m.isEnabled);
  const totalEnabledModules = enabledParents.reduce(
    (sum, m) => sum + 1 + m.children.filter((c) => c.isEnabled).length,
    0
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── ROW 1: Assinatura + Valores ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card: Assinatura */}
        <div className={card}>
          <SectionHeader icon={RefreshCcw} label="Assinatura" iconColor="text-indigo-400" />

          <div>
            {/* Status destacado */}
            <div
              className={cn(
                'flex items-center justify-between p-3 rounded-xl mb-3',
                isDark ? 'bg-zinc-900/60' : 'bg-zinc-50'
              )}
            >
              <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                Status da Assinatura
              </span>
              {sub ? (
                <StatusBadge status={sub.status} />
              ) : (
                <span className="text-xs text-zinc-400 italic">Sem assinatura ativa</span>
              )}
            </div>

            <DataRow label="Ciclo de Cobrança" value={billingCycleLabel} isDark={isDark} />
            <DataRow
              label="Dia de Vencimento"
              value={sub?.billingAnchorDay ? `Todo dia ${sub.billingAnchorDay}` : null}
              isDark={isDark}
            />
            <DataRow
              label="Próx. Vencimento"
              value={sub?.nextBillingDate ? formatDate(sub.nextBillingDate) : null}
              accent
              isDark={isDark}
            />
            <DataRow
              label="Período Atual"
              value={formatPeriod(sub?.currentPeriodStart, sub?.currentPeriodEnd)}
              isDark={isDark}
            />
            <DataRow
              label="Período de Graça"
              value={sub?.gracePeriodDays ? `${sub.gracePeriodDays} dias` : null}
              isDark={isDark}
            />
          </div>
        </div>

        {/* Card: Valores & Pagamento */}
        <div className={card}>
          <SectionHeader icon={Banknote} label="Valores & Pagamento" iconColor="text-green-400" />

          {/* Plano */}
          {plan && (
            <div
              className={cn(
                'flex items-center justify-between p-3 rounded-xl mb-3',
                isDark ? 'bg-zinc-900/60' : 'bg-zinc-50'
              )}
            >
              <div>
                <p className={cn('text-xs font-bold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                  {plan.name}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Plano contratado</p>
              </div>
              {plan.code && (
                <span
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-full font-bold border',
                    isDark
                      ? 'bg-zinc-700/60 border-zinc-600 text-zinc-300'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                  )}
                >
                  {plan.code}
                </span>
              )}
            </div>
          )}

          <DataRow
            label="Valor Mensal"
            value={plan?.priceMonthly != null ? formatCurrency(plan.priceMonthly) : null}
            accent
            mono
            isDark={isDark}
          />
          <DataRow
            label="Valor Anual"
            value={
              plan?.priceAnnual != null ? (
                <span className="flex items-center gap-1.5">
                  <span className="font-mono">{formatCurrency(plan.priceAnnual)}</span>
                  <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                    -10%
                  </span>
                </span>
              ) : null
            }
            isDark={isDark}
          />
          <DataRow
            label="Taxa de Setup"
            value={plan?.setupFee != null && plan.setupFee > 0 ? formatCurrency(plan.setupFee) : null}
            mono
            isDark={isDark}
          />
          <DataRow label="Método de Pagamento" value={paymentMethodLabel} isDark={isDark} />
          <DataRow label="Gateway" value={paymentGatewayLabel} isDark={isDark} />
        </div>
      </div>

      {/* ── ROW 2: Limites do Plano ─────────────────────────────────────── */}
      {plan && (
        <div className={card}>
          <SectionHeader icon={BarChart2} label="Limites do Plano" iconColor="text-nexus-orange" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {/* Usuários */}
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center',
                isDark ? 'bg-zinc-900/60 border border-zinc-700/40' : 'bg-zinc-50 border border-zinc-200'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                <Users size={16} className="text-nexus-orange" />
              </div>
              <p
                className={cn(
                  'text-xl font-bold font-mono',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}
              >
                {plan.maxUsers ?? '—'}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">
                Usuários
              </p>
            </div>

            {/* Unidades */}
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center',
                isDark ? 'bg-zinc-900/60 border border-zinc-700/40' : 'bg-zinc-50 border border-zinc-200'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                <Package size={16} className="text-nexus-orange" />
              </div>
              <p
                className={cn(
                  'text-xl font-bold font-mono',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}
              >
                {plan.maxUnits ?? '—'}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">
                Unidades
              </p>
            </div>

            {/* Storage */}
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center',
                isDark ? 'bg-zinc-900/60 border border-zinc-700/40' : 'bg-zinc-50 border border-zinc-200'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                <HardDrive size={16} className="text-nexus-orange" />
              </div>
              <p
                className={cn(
                  'text-xl font-bold font-mono',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}
              >
                {plan.storageGb ?? '—'}
                {plan.storageGb != null && (
                  <span className="text-sm font-normal text-zinc-500 ml-0.5">GB</span>
                )}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">
                Storage
              </p>
            </div>

            {/* Módulos */}
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center',
                isDark ? 'bg-zinc-900/60 border border-zinc-700/40' : 'bg-zinc-50 border border-zinc-200'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                <Layers size={16} className="text-nexus-orange" />
              </div>
              <p
                className={cn(
                  'text-xl font-bold font-mono',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}
              >
                {totalEnabledModules}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">
                Módulos
              </p>
            </div>
          </div>

          {/* Lista de Módulos — accordion hierárquico (dados reais do tenant) */}
          <div>
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-3',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}
            >
              Módulos Ativos
            </p>

            {/* Skeleton enquanto os módulos carregam */}
            {modulesLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-11 rounded-xl animate-pulse',
                      isDark ? 'bg-zinc-800/60' : 'bg-zinc-100'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Tenant não provisionado */}
            {!modulesLoading && !isProvisioned && (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <LayoutGrid size={24} className="text-zinc-400" />
                <p className="text-xs text-zinc-500">Tenant não provisionado — módulos indisponíveis.</p>
              </div>
            )}

            {/* Módulos reais do tenant */}
            {!modulesLoading && isProvisioned && (() => {
              // Filtrar pais habilitados com filhos habilitados
              const visibleParents = enabledParents
                .map((parent) => ({
                  ...parent,
                  enabledChildren: parent.children.filter((c) => c.isEnabled),
                }));

              if (visibleParents.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <LayoutGrid size={24} className="text-zinc-400" />
                    <p className="text-xs text-zinc-500">Nenhum módulo ativo neste tenant.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {visibleParents.map((parent) => {
                    const colors =
                      MODULE_PARENT_COLORS[parent.slug] ??
                      'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
                    const ParentIcon = getModuleIcon(parent.slug, parent.icon);
                    const hasChildren = parent.enabledChildren.length > 0;
                    const isOpen = expandedParents[parent.id] ?? false;

                    return (
                      <div
                        key={parent.id}
                        className={cn(
                          'border rounded-xl overflow-hidden transition-all',
                          isDark
                            ? 'border-zinc-700/60 bg-zinc-900/40'
                            : 'border-zinc-200 bg-white'
                        )}
                      >
                        {/* Header do pai */}
                        <button
                          type="button"
                          className={cn(
                            'w-full flex items-center gap-3 px-3 md:px-4 py-3 text-left transition-colors',
                            hasChildren ? 'cursor-pointer' : 'cursor-default',
                            isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                          )}
                          onClick={() => {
                            if (!hasChildren) return;
                            setExpandedParents((prev) => ({
                              ...prev,
                              [parent.id]: !prev[parent.id],
                            }));
                          }}
                          aria-expanded={hasChildren ? isOpen : undefined}
                        >
                          {/* Ícone colorido */}
                          <div
                            className={cn(
                              'w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border shrink-0',
                              colors
                            )}
                          >
                            <ParentIcon size={14} />
                          </div>

                          {/* Nome + badge contagem */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-semibold truncate',
                                isDark ? 'text-zinc-100' : 'text-zinc-900'
                              )}
                            >
                              {parent.name}
                            </span>
                            {hasChildren && (
                              <span
                                className={cn(
                                  'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                                  isDark
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                    : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                                )}
                              >
                                {parent.enabledChildren.length}
                              </span>
                            )}
                          </div>

                          {/* Chevron — só quando tem filhos */}
                          {hasChildren && (
                            <span className="shrink-0 text-zinc-500">
                              {isOpen ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </span>
                          )}
                        </button>

                        {/* Filhos expandidos */}
                        {hasChildren && isOpen && (
                          <div
                            className={cn(
                              'border-t px-3 md:px-4 py-2 grid grid-cols-1 gap-1',
                              isDark
                                ? 'border-zinc-700/60 bg-zinc-950/30'
                                : 'border-zinc-100 bg-zinc-50/60'
                            )}
                          >
                            {parent.enabledChildren.map((child) => {
                              const ChildIcon = getModuleIcon(child.slug, child.icon);
                              return (
                                <div
                                  key={child.id}
                                  className="flex items-center gap-3 px-2 py-2 rounded-lg"
                                >
                                  <div
                                    className={cn(
                                      'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                                      colors
                                    )}
                                  >
                                    <ChildIcon size={11} />
                                  </div>
                                  <span
                                    className={cn(
                                      'text-xs',
                                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                                    )}
                                  >
                                    {child.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── ROW 3: Detalhes da Negociação ──────────────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border p-5',
          isDark ? 'bg-zinc-800/20 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
        )}
      >
        <SectionHeader icon={Handshake} label="Detalhes da Negociação" iconColor="text-amber-400" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {/* Coluna esquerda */}
          <div>
            <DataRow
              label="Data de Fechamento"
              value={client.closedAt ? formatDate(client.closedAt) : null}
              isDark={isDark}
            />
            <DataRow
              label="Primeiro Pagamento"
              value={client.firstPaymentDate ? formatDate(client.firstPaymentDate) : null}
              isDark={isDark}
            />
          </div>

          {/* Coluna direita */}
          <div>
            <DataRow
              label="Usuários Contratados"
              value={
                client.numberOfUsers
                  ? (
                      <span className="flex items-center gap-1">
                        <Users size={11} className="text-zinc-400" />
                        {client.numberOfUsers}
                      </span>
                    )
                  : null
              }
              isDark={isDark}
            />
            <DataRow
              label="Trial até"
              value={
                client.trialEndsAt ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={11} className="text-blue-400" />
                    {formatDate(client.trialEndsAt)}
                  </span>
                ) : null
              }
              isDark={isDark}
            />
          </div>
        </div>

        {/* Resumo da Negociação */}
        {client.dealSummary && (
          <div className="mt-5">
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-2',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}
            >
              Resumo da Negociação
            </p>
            <div
              className={cn(
                'p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap',
                isDark
                  ? 'bg-zinc-800/60 text-zinc-300 border-t border-r border-b border-zinc-700/50'
                  : 'bg-white text-zinc-700 border-t border-r border-b border-zinc-200',
                'border-l-2 border-l-amber-500/40'
              )}
            >
              {client.dealSummary}
            </div>
          </div>
        )}

        {/* Notas de Implementação */}
        {client.implementationNotes && (
          <div className="mt-4">
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-2',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}
            >
              Notas de Implementação
            </p>
            <div
              className={cn(
                'p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap',
                isDark
                  ? 'bg-zinc-800/60 text-zinc-300 border-t border-r border-b border-zinc-700/50'
                  : 'bg-white text-zinc-700 border-t border-r border-b border-zinc-200',
                'border-l-2 border-l-indigo-500/40'
              )}
            >
              {client.implementationNotes}
            </div>
          </div>
        )}

        {!client.dealSummary &&
          !client.implementationNotes &&
          !client.closedAt &&
          !client.firstPaymentDate &&
          !client.numberOfUsers &&
          !client.trialEndsAt && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 mt-2">
              <FileText size={28} className="text-zinc-400" />
              <p className="text-sm text-zinc-500">Nenhum detalhe de negociação registrado.</p>
            </div>
          )}
      </div>
    </div>
  );
}
