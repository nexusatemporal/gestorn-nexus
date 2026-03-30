import { useState, useEffect } from 'react';
import { X, Tags, Lock } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useCreateStatusConfig, useUpdateStatusConfig } from '../../hooks/useStatusConfigs';
import type { StatusConfig, StatusEntity, CreateStatusConfigDto } from '../../api/status-configs.api';

interface Props {
  config: StatusConfig | null;
  defaultEntity?: StatusEntity;
  onClose: () => void;
}

export function StatusFormModal({ config, defaultEntity, onClose }: Props) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const isEdit = !!config;
  const isSystem = config?.isSystem ?? false;

  const createMutation = useCreateStatusConfig();
  const updateMutation = useUpdateStatusConfig();

  const [form, setForm] = useState({
    entity: defaultEntity ?? 'CLIENT' as StatusEntity,
    slug: '',
    label: '',
    color: '#22c55e',
    bgColor: '#dcfce7',
    description: '',
    sortOrder: '0',
  });

  useEffect(() => {
    if (config) {
      setForm({
        entity: config.entity,
        slug: config.slug,
        label: config.label,
        color: config.color,
        bgColor: config.bgColor,
        description: config.description ?? '',
        sortOrder: String(config.sortOrder),
      });
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit) {
      updateMutation.mutate(
        {
          id: config.id,
          data: {
            label: form.label.trim(),
            color: form.color,
            bgColor: form.bgColor,
            description: form.description.trim() || undefined,
            sortOrder: parseInt(form.sortOrder) || 0,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      const dto: CreateStatusConfigDto = {
        entity: form.entity,
        slug: form.slug.trim().toUpperCase(),
        label: form.label.trim(),
        color: form.color,
        bgColor: form.bgColor,
        description: form.description.trim() || undefined,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
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

  const ENTITY_LABELS: Record<StatusEntity, string> = {
    CLIENT: 'Clientes',
    LEAD: 'Leads',
    SUBSCRIPTION: 'Assinaturas',
    TENANT: 'Tenants',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl shadow-2xl',
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200',
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between px-6 py-4 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-nexus-orange/10 flex items-center justify-center">
              <Tags size={18} className="text-nexus-orange" />
            </div>
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              {isEdit ? 'Editar Status' : 'Novo Status'}
            </h2>
          </div>
          <button onClick={onClose} className={cn('p-2 rounded-lg', isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100')}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {isSystem && (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs', isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500')}>
              <Lock size={13} />
              Status do sistema — apenas label e cores podem ser editados
            </div>
          )}

          {/* Entidade */}
          <div>
            <label className={labelClass}>Entidade</label>
            <select
              className={cn(inputClass, (isEdit) && 'opacity-60 cursor-not-allowed')}
              value={form.entity}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value as StatusEntity }))}
            >
              {(Object.keys(ENTITY_LABELS) as StatusEntity[]).map((k) => (
                <option key={k} value={k}>{ENTITY_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Slug */}
          <div>
            <label className={labelClass}>Slug (identificador único) *</label>
            <input
              className={cn(inputClass, isSystem && 'opacity-60 cursor-not-allowed')}
              value={form.slug}
              disabled={isSystem || isEdit}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toUpperCase() }))}
              placeholder="Ex: VIP"
              required
            />
          </div>

          {/* Label */}
          <div>
            <label className={labelClass}>Label (nome de exibição) *</label>
            <input
              className={inputClass}
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Ex: Cliente VIP"
              required
            />
          </div>

          {/* Cores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cor do Texto</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent"
                />
                <input
                  className={cn(inputClass, 'flex-1')}
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#000000"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Cor de Fundo</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.bgColor}
                  onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent"
                />
                <input
                  className={cn(inputClass, 'flex-1')}
                  value={form.bgColor}
                  onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className={labelClass}>Preview</label>
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ color: form.color, backgroundColor: form.bgColor }}
              >
                {form.label || 'Prévia do Badge'}
              </span>
            </div>
          </div>

          {/* Descrição + Ordem */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Descrição</label>
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className={labelClass}>Ordem</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className={cn('flex justify-end gap-3 px-6 py-4 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
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
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
