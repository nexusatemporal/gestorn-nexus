import { useState } from 'react';
import { Plus, Pencil, Trash2, Lock, Tags } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useStatusConfigs, useDeleteStatusConfig } from '../../hooks/useStatusConfigs';
import { StatusFormModal } from './StatusFormModal';
import type { StatusConfig, StatusEntity } from '../../api/status-configs.api';

const ENTITY_TABS: { id: StatusEntity; label: string }[] = [
  { id: 'CLIENT', label: 'Clientes' },
  { id: 'LEAD', label: 'Leads' },
  { id: 'SUBSCRIPTION', label: 'Assinaturas' },
  { id: 'TENANT', label: 'Tenants' },
];

export function StatusTab() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [activeEntity, setActiveEntity] = useState<StatusEntity>('CLIENT');
  const [modalOpen, setModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<StatusConfig | null>(null);

  const { data: configs, isLoading } = useStatusConfigs(activeEntity);
  const deleteMutation = useDeleteStatusConfig();

  const handleEdit = (config: StatusConfig) => {
    setEditConfig(config);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditConfig(null);
    setModalOpen(true);
  };

  const handleDelete = (config: StatusConfig) => {
    if (config.isSystem) return;
    if (confirm(`Remover status "${config.label}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(config.id);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            Status Personalizáveis
          </h2>
          <p className={cn('text-sm mt-0.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            Personalize labels e cores dos status do sistema, e crie novos status customizados
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-nexus-orange text-white text-sm font-medium hover:bg-nexus-orange/90 transition-colors"
        >
          <Plus size={16} />
          Novo Status
        </button>
      </div>

      {/* Entity tabs */}
      <div className={cn('flex gap-1 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveEntity(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeEntity === tab.id
                ? 'border-nexus-orange text-nexus-orange'
                : isDark
                ? 'border-transparent text-zinc-400 hover:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-nexus-orange',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white')}>
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !configs?.length ? (
          <div className="py-12 text-center">
            <Tags size={36} className={cn('mx-auto mb-2', isDark ? 'text-zinc-600' : 'text-zinc-300')} />
            <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Nenhum status configurado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={cn('border-b', isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50')}>
              <tr>
                {['Preview', 'Slug', 'Label', 'Tipo', 'Ordem', 'Ações'].map((h) => (
                  <th key={h} className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wide', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn('divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-100')}>
              {configs.map((cfg) => (
                <tr
                  key={cfg.id}
                  className={cn(
                    'transition-colors',
                    !cfg.isActive && 'opacity-50',
                    isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50',
                  )}
                >
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                      style={{ color: cfg.color, backgroundColor: cfg.bgColor }}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td className={cn('px-4 py-3 text-sm font-mono', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {cfg.slug}
                  </td>
                  <td className={cn('px-4 py-3 text-sm', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                    {cfg.label}
                  </td>
                  <td className="px-4 py-3">
                    {cfg.isSystem ? (
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500')}>
                        <Lock size={10} />
                        Sistema
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className={cn('px-4 py-3 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {cfg.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(cfg)}
                        className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900')}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {!cfg.isSystem && (
                        <button
                          onClick={() => handleDelete(cfg)}
                          className="p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-500/10"
                          title="Remover"
                        >
                          <Trash2 size={14} />
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
        <StatusFormModal
          config={editConfig}
          defaultEntity={activeEntity}
          onClose={() => {
            setModalOpen(false);
            setEditConfig(null);
          }}
        />
      )}
    </div>
  );
}
