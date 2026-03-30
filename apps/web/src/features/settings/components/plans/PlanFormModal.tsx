import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Package,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  TrendingUp,
  Calendar,
  Heart,
  Scissors,
  DollarSign,
  BarChart2,
  Megaphone,
  MessageSquare,
  Layers,
  Settings,
  Users,
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
  LayoutGrid,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useCreatePlan, useUpdatePlan, useModulesCatalog } from '../../hooks/usePlansAdmin';
import type { Plan, CreatePlanDto, ModuleTree } from '../../api/plans-admin.api';

// ─── Mapa de ícones (mesmo do ClientModulesTab) ─────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
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

const PRESET_OPTIONS: { label: string; desc: string; color: string; slugs: string[] }[] = [
  { label: 'Nenhum', desc: 'Limpar tudo', color: 'bg-zinc-600 hover:bg-zinc-500', slugs: [] },
  { label: 'Básico', desc: 'Dashboard, Agenda, Pacientes, Config', color: 'bg-blue-600 hover:bg-blue-500', slugs: ['dashboard', 'agenda', 'patients', 'settings'] },
  { label: 'Clínico', desc: '+ Procedimentos, Financeiro', color: 'bg-purple-600 hover:bg-purple-500', slugs: ['dashboard', 'agenda', 'patients', 'procedures', 'financial', 'settings'] },
  { label: 'Business', desc: '+ Vendas, Estoque', color: 'bg-orange-500 hover:bg-orange-400', slugs: ['dashboard', 'sales', 'agenda', 'patients', 'procedures', 'financial', 'stock', 'settings'] },
  { label: 'Enterprise', desc: '+ BI, Marketing, Colaboração', color: 'bg-emerald-600 hover:bg-emerald-500', slugs: ['dashboard', 'sales', 'agenda', 'patients', 'procedures', 'financial', 'stock', 'bi', 'marketing', 'collaboration', 'settings'] },
  { label: 'Tudo', desc: 'Todos os módulos', color: 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400', slugs: ['__ALL__'] },
];

function ModuleIcon({ slug, icon, size = 16 }: { slug: string; icon: string; size?: number }) {
  const Icon = ICON_MAP[slug] || ICON_MAP[icon] || LayoutGrid;
  return <Icon size={size} />;
}

function Toggle({ checked, onChange, size = 'md' }: { checked: boolean; onChange: () => void; size?: 'sm' | 'md' }) {
  const track = size === 'sm' ? 'w-7 h-4' : 'w-9 h-5';
  const thumb = size === 'sm' ? 'w-2.5 h-2.5 translate-x-0.5' : 'w-3.5 h-3.5 translate-x-0.5';
  const thumbOn = size === 'sm' ? 'translate-x-[13px]' : 'translate-x-[17px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${track} ${checked ? 'bg-orange-500' : 'bg-zinc-600'}`}
    >
      <span className={`inline-block rounded-full bg-white shadow transition-transform duration-200 ${thumb} ${checked ? thumbOn : ''}`} />
    </button>
  );
}

// ─── ModuleCard para o plano (accordion local, sem API) ─────────────────────
function PlanModuleCard({
  module,
  isDark,
  selectedIds,
  onToggleParent,
  onToggleChild,
}: {
  module: ModuleTree;
  isDark: boolean;
  selectedIds: Set<string>;
  onToggleParent: (mod: ModuleTree) => void;
  onToggleChild: (childId: string) => void;
}) {
  const parentSelected = selectedIds.has(module.id);
  const [open, setOpen] = useState(parentSelected);
  const colors = PARENT_COLORS[module.slug] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
  const enabledChildren = module.children.filter((c) => selectedIds.has(c.id)).length;
  const totalChildren = module.children.length;

  return (
    <div className={cn('border rounded-xl overflow-hidden transition-all', isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-white')}>
      <div
        className={cn('flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors', isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50')}
        onClick={() => totalChildren > 0 && setOpen((o) => !o)}
      >
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center border', colors)}>
          <ModuleIcon slug={module.slug} icon={module.icon} size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn('text-xs font-semibold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
            {module.name}
          </span>
          {totalChildren > 0 && (
            <span className="ml-1.5 text-[10px] text-zinc-500">
              {enabledChildren}/{totalChildren}
            </span>
          )}
        </div>
        {totalChildren > 0 && (
          <span className="text-zinc-500 shrink-0">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        <Toggle checked={parentSelected} onChange={() => onToggleParent(module)} />
      </div>

      {open && totalChildren > 0 && (
        <div className={cn('border-t px-3 py-2 grid grid-cols-1 gap-0.5', isDark ? 'border-zinc-800 bg-zinc-950/30' : 'border-zinc-100 bg-zinc-50/50')}>
          {module.children.map((child) => {
            const childSelected = selectedIds.has(child.id);
            return (
              <div
                key={child.id}
                className={cn('flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100')}
              >
                <div className={cn('w-5 h-5 rounded-md flex items-center justify-center shrink-0', childSelected ? colors : (isDark ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-200 text-zinc-400'))}>
                  <ModuleIcon slug={child.slug} icon={child.icon} size={10} />
                </div>
                <span className={cn('flex-1 text-[11px]', childSelected ? (isDark ? 'text-zinc-200' : 'text-zinc-800') : 'text-zinc-500')}>
                  {child.name}
                </span>
                <Toggle size="sm" checked={childSelected} onChange={() => onToggleChild(child.id)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal principal ─────────────────────────────────────────────────────────
interface Props {
  plan: Plan | null;
  onClose: () => void;
}

type FormData = {
  name: string;
  code: string;
  product: 'ONE_NEXUS' | 'LOCADORAS';
  priceMonthly: string;
  priceAnnual: string;
  setupFee: string;
  maxUsers: string;
  maxUnits: string;
  storageGb: string;
  includedModules: string[];
  isHighlighted: boolean;
  sortOrder: string;
};

export function PlanFormModal({ plan, onClose }: Props) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const isEdit = !!plan;

  const createMutation = useCreatePlan();
  const updateMutation = useUpdatePlan();
  const { data: catalog = [], isLoading: loadingCatalog } = useModulesCatalog();

  const [form, setForm] = useState<FormData>({
    name: '',
    code: '',
    product: 'ONE_NEXUS',
    priceMonthly: '',
    priceAnnual: '',
    setupFee: '0',
    maxUsers: '5',
    maxUnits: '1',
    storageGb: '10',
    includedModules: [],
    isHighlighted: false,
    sortOrder: '0',
  });

  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name,
        code: plan.code,
        product: plan.product,
        priceMonthly: String(plan.priceMonthly),
        priceAnnual: String(plan.priceAnnual),
        setupFee: String(plan.setupFee),
        maxUsers: String(plan.maxUsers),
        maxUnits: String(plan.maxUnits),
        storageGb: String(plan.storageGb),
        includedModules: plan.includedModules ?? [],
        isHighlighted: plan.isHighlighted,
        sortOrder: String(plan.sortOrder),
      });
    }
  }, [plan]);

  const selectedIds = new Set(form.includedModules);

  // Contadores
  const totalEnabled = form.includedModules.length;
  const totalModules = catalog.reduce((sum, m) => sum + 1 + m.children.length, 0);

  const setModules = (ids: string[]) => {
    setForm((f) => ({ ...f, includedModules: ids }));
  };

  // Toggle pai: liga/desliga pai + todos os filhos
  const handleToggleParent = (mod: ModuleTree) => {
    const parentSelected = selectedIds.has(mod.id);
    const childIds = mod.children.map((c) => c.id);

    if (parentSelected) {
      // Desligar pai + todos os filhos
      setModules(form.includedModules.filter((id) => id !== mod.id && !childIds.includes(id)));
    } else {
      // Ligar pai + todos os filhos
      const newIds = new Set(form.includedModules);
      newIds.add(mod.id);
      childIds.forEach((id) => newIds.add(id));
      setModules(Array.from(newIds));
    }
  };

  // Toggle filho: liga/desliga filho, liga pai se necessário
  const handleToggleChild = (parentMod: ModuleTree, childId: string) => {
    const childSelected = selectedIds.has(childId);
    const newIds = new Set(form.includedModules);

    if (childSelected) {
      newIds.delete(childId);
      // Se nenhum filho restante ativo, desligar pai também
      const remainingChildren = parentMod.children.filter((c) => c.id !== childId && newIds.has(c.id));
      if (remainingChildren.length === 0) {
        newIds.delete(parentMod.id);
      }
    } else {
      newIds.add(childId);
      // Ligar pai automaticamente
      newIds.add(parentMod.id);
    }

    setModules(Array.from(newIds));
  };

  // Presets
  const applyPreset = (slugs: string[]) => {
    if (slugs.length === 0) {
      setModules([]);
      return;
    }
    if (slugs[0] === '__ALL__') {
      // Selecionar tudo
      const allIds = catalog.flatMap((m) => [m.id, ...m.children.map((c) => c.id)]);
      setModules(allIds);
      return;
    }
    // Selecionar os módulos-pai com slug nos slugs e todos seus filhos
    const newIds: string[] = [];
    catalog.forEach((mod) => {
      if (slugs.includes(mod.slug)) {
        newIds.push(mod.id);
        mod.children.forEach((c) => newIds.push(c.id));
      }
    });
    setModules(newIds);
  };

  const handleMonthlyChange = (val: string) => {
    const monthly = parseFloat(val);
    setForm((f) => ({
      ...f,
      priceMonthly: val,
      priceAnnual: isNaN(monthly) ? '' : (monthly * 0.9 * 12).toFixed(2),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dto: CreatePlanDto = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      product: form.product,
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      priceAnnual: parseFloat(form.priceAnnual) || 0,
      setupFee: parseFloat(form.setupFee) || 0,
      maxUsers: parseInt(form.maxUsers) || 5,
      maxUnits: parseInt(form.maxUnits) || 1,
      storageGb: parseInt(form.storageGb) || 10,
      includedModules: form.includedModules,
      isHighlighted: form.isHighlighted,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    if (isEdit) {
      updateMutation.mutate({ id: plan.id, data: dto }, { onSuccess: onClose });
    } else {
      createMutation.mutate(dto, { onSuccess: onClose });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const inputClass = cn(
    'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors',
    isDark
      ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-nexus-orange'
      : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-nexus-orange',
  );

  const labelClass = cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-600');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100%-1rem)] md:max-h-[90vh]',
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200',
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-nexus-orange/10 flex items-center justify-center">
              <Package size={18} className="text-nexus-orange" />
            </div>
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              {isEdit ? 'Editar Plano' : 'Novo Plano'}
            </h2>
          </div>
          <button onClick={onClose} className={cn('p-2 rounded-lg hover:bg-zinc-800/50', isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900')}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain flex-1 px-6 py-5 space-y-5">
          {/* Nome + Código */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: One Nexus Pro"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Código *</label>
              <input
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Ex: ONE_NEXUS_PRO"
                required
              />
            </div>
          </div>

          {/* Produto */}
          <div>
            <label className={labelClass}>Produto *</label>
            <select
              className={inputClass}
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value as Plan['product'] }))}
            >
              <option value="ONE_NEXUS">One Nexus</option>
              <option value="LOCADORAS">Locadoras</option>
            </select>
          </div>

          {/* Preços */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Preço Mensal (R$) *</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form.priceMonthly}
                onChange={(e) => handleMonthlyChange(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Preço Anual (R$)</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form.priceAnnual}
                onChange={(e) => setForm((f) => ({ ...f, priceAnnual: e.target.value }))}
                placeholder="Auto"
              />
            </div>
            <div>
              <label className={labelClass}>Taxa de Setup (R$)</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form.setupFee}
                onChange={(e) => setForm((f) => ({ ...f, setupFee: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Máx. Usuários</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                value={form.maxUsers}
                onChange={(e) => setForm((f) => ({ ...f, maxUsers: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Máx. Unidades</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                value={form.maxUnits}
                onChange={(e) => setForm((f) => ({ ...f, maxUnits: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Armazenamento (GB)</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                value={form.storageGb}
                onChange={(e) => setForm((f) => ({ ...f, storageGb: e.target.value }))}
              />
            </div>
          </div>

          {/* ═══ Módulos Inclusos — Árvore Hierárquica ═══ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Módulos Inclusos</label>
              {totalModules > 0 && (
                <span className="text-[10px] text-zinc-500">
                  <span className="font-bold text-orange-400">{totalEnabled}</span>/{totalModules} selecionados
                </span>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_OPTIONS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.slugs)}
                  title={p.desc}
                  className={cn('px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white transition-all', p.color)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Árvore */}
            {loadingCatalog ? (
              <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-xs">Carregando módulos...</span>
              </div>
            ) : catalog.length === 0 ? (
              <div className={cn('py-6 text-center text-xs rounded-xl border', isDark ? 'text-zinc-500 border-zinc-800' : 'text-zinc-400 border-zinc-200')}>
                Nenhum módulo disponível. Verifique se existe um tenant provisionado no One Nexus.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto overscroll-contain pr-1">
                {catalog.map((mod) => (
                  <PlanModuleCard
                    key={mod.id}
                    module={mod}
                    isDark={isDark}
                    selectedIds={selectedIds}
                    onToggleParent={handleToggleParent}
                    onToggleChild={(childId) => handleToggleChild(mod, childId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Opções */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ordem de Exibição</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm((f) => ({ ...f, isHighlighted: !f.isHighlighted }))}
                  className={cn(
                    'w-10 h-6 rounded-full transition-colors relative',
                    form.isHighlighted ? 'bg-nexus-orange' : isDark ? 'bg-zinc-700' : 'bg-zinc-300',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      form.isHighlighted ? 'translate-x-5' : 'translate-x-1',
                    )}
                  />
                </div>
                <span className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  Plano em Destaque
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className={cn('flex flex-col-reverse md:flex-row justify-end gap-3 px-6 py-4 border-t shrink-0', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <button
            type="button"
            onClick={onClose}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100')}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-nexus-orange text-white text-sm font-medium hover:bg-nexus-orange/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Plano'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
