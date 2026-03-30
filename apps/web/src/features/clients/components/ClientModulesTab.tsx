import { useState } from 'react';
import {
  LayoutGrid,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,

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
  ClipboardList,
  FileText,
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
  Lock,
  type LucideIcon,
} from 'lucide-react';
import {
  useClientTenant,
  useModulesTree,
  useToggleModules,
  useEnableAllModules,
  useApplyModulePreset,
  useRetryProvision,
  type ModuleTree,
  type ModulePreset,
} from '../hooks/useClientModules';
import { useUIStore } from '@/stores/useUIStore';

// ─── Mapa de ícones por slug / icon name ─────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  // Pais
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
  // Filhos por slug
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
  // Fallback por icon name string (retorno da API)
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

function ModuleIcon({ slug, icon, size = 16 }: { slug: string; icon: string; size?: number }) {
  const Icon = ICON_MAP[slug] || ICON_MAP[icon] || LayoutGrid;
  return <Icon size={size} />;
}

// ─── Cores por módulo pai ─────────────────────────────────────────────────────
const PARENT_COLORS: Record<string, string> = {
  dashboard: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  sales: 'text-green-500 bg-green-500/10 border-green-500/20',
  agenda: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  patients: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
  procedures: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  financial: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  stock: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  bi: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  marketing: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  nexus_chat: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  collaboration: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  settings: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

const PRESET_LABELS: { value: ModulePreset; label: string; desc: string; color: string }[] = [
  { value: 'none',       label: 'Core',       desc: 'Dashboard + Settings',                  color: 'bg-zinc-600 hover:bg-zinc-500' },
  { value: 'basic',      label: 'Básico',     desc: 'Dashboard, Agenda, Pacientes, Config',   color: 'bg-blue-600 hover:bg-blue-500' },
  { value: 'clinical',   label: 'Clínico',    desc: 'Básico + Procedimentos, Financeiro',     color: 'bg-purple-600 hover:bg-purple-500' },
  { value: 'business',   label: 'Business',   desc: 'Clínico + Vendas, Estoque',              color: 'bg-orange-500 hover:bg-orange-400' },
  { value: 'enterprise', label: 'Enterprise', desc: 'Business + BI, Marketing, Colaboração', color: 'bg-emerald-600 hover:bg-emerald-500' },
  { value: 'all',        label: 'Tudo',       desc: 'Todos os 77 módulos',                    color: 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400' },
];

// ─── Toggle switch compacto ──────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const track = size === 'sm'
    ? 'w-7 h-4'
    : 'w-9 h-5';
  const thumb = size === 'sm'
    ? 'w-2.5 h-2.5 translate-x-0.5'
    : 'w-3.5 h-3.5 translate-x-0.5';
  const thumbOn = size === 'sm' ? 'translate-x-[13px]' : 'translate-x-[17px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(); }}
      disabled={disabled}
      className={`relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${track} ${checked ? 'bg-orange-500' : 'bg-zinc-600'}`}
    >
      <span
        className={`inline-block rounded-full bg-white shadow transition-transform duration-200 ${thumb} ${checked ? thumbOn : ''}`}
      />
    </button>
  );
}

// ─── Cartão de módulo pai (accordion) ────────────────────────────────────────
function ModuleCard({
  module,
  isDark,
  onToggleParent,
  onToggleChild,
  isPending,
}: {
  module: ModuleTree;
  isDark: boolean;
  onToggleParent: (mod: ModuleTree) => void;
  onToggleChild: (parentId: string, childId: string, isEnabled: boolean) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(module.isEnabled);
  const colors = PARENT_COLORS[module.slug] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
  const enabledChildren = module.children.filter((c) => c.isEnabled).length;
  const totalChildren = module.children.length;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-white'}`}>
      {/* Header do card */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'} transition-colors`}
        onClick={() => totalChildren > 0 && setOpen((o) => !o)}
      >
        {/* Ícone */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colors}`}>
          <ModuleIcon slug={module.slug} icon={module.icon} size={15} />
        </div>

        {/* Nome + progresso */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            {module.name}
          </span>
          {totalChildren > 0 && (
            <span className="ml-2 text-[10px] text-zinc-500">
              {enabledChildren}/{totalChildren} habilitados
            </span>
          )}
        </div>

        {/* Chevron */}
        {totalChildren > 0 && (
          <span className="text-zinc-500 shrink-0">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}

        {/* Toggle master */}
        {module.isCore ? (
          <div className="shrink-0 flex items-center gap-1.5 text-zinc-500" title="Módulo obrigatório — não pode ser desativado">
            <Lock size={12} />
            <span className="text-[10px] font-medium">Obrigatório</span>
          </div>
        ) : (
          <Toggle
            checked={module.isEnabled}
            onChange={() => onToggleParent(module)}
            disabled={isPending}
          />
        )}
      </div>

      {/* Filhos */}
      {open && totalChildren > 0 && (
        <div className={`border-t px-4 py-3 grid grid-cols-1 gap-1.5 ${isDark ? 'border-zinc-800 bg-zinc-950/30' : 'border-zinc-100 bg-zinc-50/50'}`}>
          {module.children.map((child) => (
            <div
              key={child.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'}`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${child.isEnabled ? colors : `${isDark ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-200 text-zinc-400'}`}`}>
                <ModuleIcon slug={child.slug} icon={child.icon} size={12} />
              </div>
              <span className={`flex-1 text-xs ${child.isEnabled ? (isDark ? 'text-zinc-200' : 'text-zinc-800') : 'text-zinc-500'}`}>
                {child.name}
              </span>
              {child.isCore ? (
                <Lock size={10} className="shrink-0 text-zinc-500" />
              ) : (
                <Toggle
                  size="sm"
                  checked={child.isEnabled}
                  onChange={() => onToggleChild(module.id, child.id, !child.isEnabled)}
                  disabled={isPending}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  clientId: string;
  onBack?: () => void;
}

export function ClientModulesTab({ clientId }: Props) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const { data: tenant, isLoading: loadingTenant } = useClientTenant(clientId);
  const isProvisioned = tenant?.provisioningStatus === 'PROVISIONED';
  const { data: tree = [], isLoading: loadingTree, refetch } = useModulesTree(tenant?.id, isProvisioned);

  const toggleMutation    = useToggleModules(tenant?.id);
  const enableAllMutation = useEnableAllModules(tenant?.id);
  const presetMutation    = useApplyModulePreset(tenant?.id);
  const retryMutation     = useRetryProvision(tenant?.id);

  const isPending = toggleMutation.isPending || enableAllMutation.isPending || presetMutation.isPending;
  const isLoading = loadingTenant || loadingTree;

  const totalEnabled = tree.reduce((sum, m) => {
    const childCount = m.children.filter((c) => c.isEnabled).length;
    return sum + (m.isEnabled ? 1 : 0) + childCount;
  }, 0);
  const totalModules = tree.reduce((sum, m) => sum + 1 + m.children.length, 0);

  const handleToggleParent = (mod: ModuleTree) => {
    const newState = !mod.isEnabled;
    const toggles = [
      { moduleId: mod.id, isEnabled: newState },
      ...mod.children.map((c) => ({ moduleId: c.id, isEnabled: newState })),
    ];
    toggleMutation.mutate(toggles);
  };

  const handleToggleChild = (_parentId: string, childId: string, isEnabled: boolean) => {
    toggleMutation.mutate([{ moduleId: childId, isEnabled }]);
  };

  // ── Loading ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center gap-3 text-zinc-500">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Carregando módulos...</span>
      </div>
    );
  }

  // ── Sem tenant ─────────────────────────────────────────────────
  if (!tenant) {
    return (
      <div className="py-16 text-center">
        <LayoutGrid size={40} className="mx-auto mb-3 text-zinc-500" />
        <p className="text-sm text-zinc-500">Este cliente não possui tenant vinculado.</p>
        <p className="text-xs text-zinc-600 mt-1">Os módulos ficam disponíveis após o provisionamento do One Nexus.</p>
      </div>
    );
  }

  // ── Provisioning FAILED — com botão retry ─────────────────────
  if (tenant.provisioningStatus === 'FAILED') {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-red-500">
          <AlertTriangle size={20} />
          <p className="text-sm font-medium">Provisioning falhou</p>
        </div>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          O provisionamento no One Nexus falhou. Clique abaixo para tentar novamente.
        </p>
        <button
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={retryMutation.isPending ? 'animate-spin' : ''} />
          {retryMutation.isPending ? 'Provisionando...' : 'Tentar Novamente'}
        </button>
      </div>
    );
  }

  // ── Provisioning PENDING — aguardando ───────────────────────
  if (!isProvisioned || !tenant.tenantUuid) {
    return (
      <div className="py-12 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-yellow-500">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-medium">Provisionando...</p>
        </div>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          O tenant está sendo provisionado no One Nexus. Aguarde alguns instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Barra de ações rápidas ──────────────────────────────── */}
      <div className="space-y-3">
        {/* Contador + Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-zinc-500" />
            <span className="text-xs text-zinc-500">
              <span className="font-bold text-orange-400">{totalEnabled}</span>/{totalModules} módulos ativos
            </span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isPending}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESET_LABELS.map((p) => (
            <button
              key={p.value}
              onClick={() => presetMutation.mutate(p.value)}
              disabled={isPending}
              title={p.desc}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${p.color}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Árvore de módulos ─────────────────────────────────── */}
      {tree.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 text-sm">
          Nenhum módulo retornado pela API do One Nexus.
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              isDark={isDark}
              onToggleParent={handleToggleParent}
              onToggleChild={handleToggleChild}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* ── Loading overlay durante mutações ───────────────────── */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-orange-400">
          <RefreshCw size={12} className="animate-spin" />
          Aplicando alterações...
        </div>
      )}
    </div>
  );
}
