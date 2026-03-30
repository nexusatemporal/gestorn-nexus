import { useState } from 'react';
import { Plus, Pencil, PowerOff, RotateCcw, Package } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { usePlans, useDeactivatePlan, useRestorePlan } from '../../hooks/usePlansAdmin';
import { PlanFormModal } from './PlanFormModal';
import type { Plan } from '../../api/plans-admin.api';

const PRODUCT_BADGE: Record<Plan['product'], string> = {
  ONE_NEXUS: 'bg-nexus-orange/10 text-nexus-orange',
  LOCADORAS: 'bg-blue-500/10 text-blue-500',
};

const PRODUCT_LABEL: Record<Plan['product'], string> = {
  ONE_NEXUS: 'One Nexus',
  LOCADORAS: 'Locadoras',
};

/** Formata contagem de módulos — mostra total para IDs do One Nexus */
function formatModuleCount(modules: string[]): string {
  if (!modules?.length) return '0';
  return String(modules.length);
}

export function PlansTab() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [modalOpen, setModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = usePlans();
  const deactivateMutation = useDeactivatePlan();
  const restoreMutation = useRestorePlan();

  const handleEdit = (plan: Plan) => {
    setEditPlan(plan);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditPlan(null);
    setModalOpen(true);
  };

  const handleDeactivate = (plan: Plan) => {
    if (confirm(`Desativar plano "${plan.name}"? Clientes existentes não serão afetados.`)) {
      deactivateMutation.mutate(plan.id);
    }
  };

  const handleRestore = (plan: Plan) => {
    restoreMutation.mutate(plan.id);
  };

  const thRow = cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wide', isDark ? 'text-zinc-500' : 'text-zinc-500');
  const tdBase = cn('px-4 py-3 text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700');

  return (
    <div className="p-6 space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            Planos de Assinatura
          </h2>
          <p className={cn('text-sm mt-0.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            Gerencie os planos disponíveis para One Nexus e Locadoras
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-nexus-orange text-white text-sm font-medium hover:bg-nexus-orange/90 transition-colors"
        >
          <Plus size={16} />
          Novo Plano
        </button>
      </div>

      {/* Table */}
      <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
            <p className={cn('mt-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Carregando planos...</p>
          </div>
        ) : !plans?.length ? (
          <div className="py-16 text-center">
            <Package size={40} className={cn('mx-auto mb-3', isDark ? 'text-zinc-600' : 'text-zinc-300')} />
            <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Nenhum plano cadastrado</p>
            <button onClick={handleNew} className="mt-3 text-nexus-orange text-sm hover:underline">
              Criar primeiro plano
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className={cn('border-b', isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50')}>
              <tr>
                <th className={thRow}>Nome</th>
                <th className={thRow}>Produto</th>
                <th className={thRow}>Mensal</th>
                <th className={thRow}>Anual</th>
                <th className={thRow}>Usuários</th>
                <th className={thRow}>Módulos</th>
                <th className={thRow}>Status</th>
                <th className={thRow}>Ações</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-100')}>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className={cn(
                    'transition-colors',
                    !plan.isActive && 'opacity-50',
                    isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50',
                  )}
                >
                  <td className={tdBase}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {plan.isHighlighted && (
                        <span className="text-xs bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded-full">
                          Destaque
                        </span>
                      )}
                    </div>
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{plan.code}</p>
                  </td>
                  <td className={tdBase}>
                    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', PRODUCT_BADGE[plan.product])}>
                      {PRODUCT_LABEL[plan.product]}
                    </span>
                  </td>
                  <td className={tdBase}>
                    R$ {plan.priceMonthly.toFixed(2)}
                  </td>
                  <td className={tdBase}>
                    R$ {plan.priceAnnual.toFixed(2)}
                  </td>
                  <td className={tdBase}>{plan.maxUsers}</td>
                  <td className={tdBase}>
                    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700')}>
                      {formatModuleCount(plan.includedModules as string[])} módulos
                    </span>
                  </td>
                  <td className={tdBase}>
                    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', plan.isActive ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-500')}>
                      {plan.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className={tdBase}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(plan)}
                        className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900')}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {plan.isActive ? (
                        <button
                          onClick={() => handleDeactivate(plan)}
                          className={cn('p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-500/10')}
                          title="Desativar"
                        >
                          <PowerOff size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(plan)}
                          className={cn('p-1.5 rounded-lg transition-colors text-green-500 hover:bg-green-500/10')}
                          title="Reativar"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <PlanFormModal
          plan={editPlan}
          onClose={() => {
            setModalOpen(false);
            setEditPlan(null);
          }}
        />
      )}
    </div>
  );
}
