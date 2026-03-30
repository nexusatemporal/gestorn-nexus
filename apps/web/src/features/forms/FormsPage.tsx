import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Link2, Code2, MoreVertical, Eye, Edit3, Trash2,
  PauseCircle, PlayCircle, Copy, ExternalLink, ClipboardList, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useForms, useDeleteForm, useUpdateForm } from './hooks/useForms';
import { Form } from './services/forms.api';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';

const PUBLIC_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}`
  : 'https://gestornx.nexusatemporal.com';

interface MenuPos { id: string; top: number; right: number }

// Dropdown com position: fixed — escapa de qualquer overflow container
function FormActions({ form, pos, onClose, isDark }: { form: Form; pos: MenuPos; onClose: () => void; isDark: boolean }) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteForm();
  const updateMutation = useUpdateForm(form.id);

  const handleDelete = () => {
    if (!confirm(`Tem certeza que deseja remover "${form.name}"?`)) return;
    deleteMutation.mutate(form.id);
    onClose();
  };

  const handleToggleActive = () => {
    updateMutation.mutate({ isActive: !form.isActive });
    onClose();
  };

  const itemCls = cn(
    'w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors text-sm',
    isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-50',
  );

  return (
    <>
      {/* Overlay invisível para fechar ao clicar fora */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu com position fixed — não é clipado por nenhum container */}
      <div
        className={cn(
          'fixed z-50 w-52 rounded-xl border shadow-xl py-1',
          isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200',
        )}
        style={{ top: pos.top, right: pos.right }}
      >
        <button onClick={() => { navigate(`/forms/${form.id}/submissions`); onClose(); }} className={itemCls}>
          <Eye size={14} /> Ver Submissões ({form._count?.submissions || 0})
        </button>
        <button onClick={() => { navigate(`/forms/${form.id}/edit`); onClose(); }} className={itemCls}>
          <Edit3 size={14} /> Editar
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(`${PUBLIC_BASE}/f/${form.slug}`); toast.success('Link copiado!'); onClose(); }}
          className={itemCls}
        >
          <Copy size={14} /> Copiar Link
        </button>
        <button
          onClick={() => {
            const url = `${PUBLIC_BASE}/f/${form.slug}?embed=true`;
            const code = `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border-radius:12px;border:none;"></iframe>`;
            navigator.clipboard.writeText(code); toast.success('Código embed copiado!'); onClose();
          }}
          className={itemCls}
        >
          <Code2 size={14} /> Copiar Embed
        </button>
        <button onClick={() => { window.open(`/f/${form.slug}`, '_blank'); onClose(); }} className={itemCls}>
          <ExternalLink size={14} /> Visualizar
        </button>
        <button onClick={handleToggleActive} className={itemCls}>
          {form.isActive
            ? <><PauseCircle size={14} /> Pausar</>
            : <><PlayCircle size={14} className="text-green-500" /> Reativar</>}
        </button>
        <div className={cn('my-1 border-t', isDark ? 'border-zinc-700' : 'border-zinc-100')} />
        <button onClick={handleDelete} className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-red-500 hover:bg-red-500/10 transition-colors text-sm">
          <Trash2 size={14} /> Remover
        </button>
      </div>
    </>
  );
}

export function FormsPage() {
  const navigate = useNavigate();
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const { data: forms = [], isLoading } = useForms();
  const [menuOpen, setMenuOpen] = useState<MenuPos | null>(null);

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, formId: string) => {
    if (menuOpen?.id === formId) { setMenuOpen(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuOpen({ id: formId, top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  return (
    <div className={cn('min-h-screen p-3 md:p-6', isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900')}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
            <ClipboardList size={22} className="text-nexus-orange" />
            Formulários
          </h1>
          <p className={cn('text-xs md:text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            Crie formulários para campanhas e landing pages. Leads capturados entram direto no Kanban.
          </p>
        </div>
        <button
          onClick={() => navigate('/forms/new')}
          className="hidden md:flex items-center gap-2 bg-nexus-orange hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus size={18} />
          Criar Formulário
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 md:mb-8">
        {[
          { label: 'Total de Forms', value: forms.length, icon: ClipboardList },
          { label: 'Forms Ativos', value: forms.filter(f => f.isActive).length, icon: PlayCircle },
          { label: 'Total de Leads', value: forms.reduce((acc, f) => acc + (f._count?.submissions || 0), 0), icon: Users },
          { label: 'Campanhas', value: forms.filter(f => f.purpose === 'CAMPAIGN').length, icon: Link2 },
        ].map(stat => (
          <div key={stat.label} className={cn('rounded-xl p-4 border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={16} className="text-nexus-orange" />
              <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{stat.label}</span>
            </div>
            <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ClipboardList size={48} className={isDark ? 'text-zinc-700' : 'text-zinc-300'} />
            <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              Nenhum formulário criado ainda
            </p>
            <button
              onClick={() => navigate('/forms/new')}
              className="text-nexus-orange text-sm font-medium hover:underline"
            >
              Criar primeiro formulário
            </button>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-zinc-800/50">
            {forms.map(form => (
              <div key={form.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{form.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      form.isActive ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-400',
                    )}>
                      {form.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                    <span className="text-xs text-nexus-orange font-bold">{form._count?.submissions || 0} leads</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleOpenMenu(e, form.id)}
                  className={cn('p-2 rounded-lg shrink-0', isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100')}
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className={cn('text-xs font-semibold uppercase tracking-wide border-b', isDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-100 text-zinc-400')}>
                <th className="px-6 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Produto</th>
                <th className="px-4 py-3 text-center">Leads</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Criado por</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {forms.map(form => (
                <tr
                  key={form.id}
                  className={cn('transition-colors', isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50')}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-sm">{form.name}</p>
                      <p className={cn('text-xs mt-0.5 font-mono', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        /f/{form.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                      form.purpose === 'CAMPAIGN'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-purple-500/10 text-purple-500',
                    )}>
                      {form.purpose === 'CAMPAIGN' ? <Link2 size={11} /> : <Code2 size={11} />}
                      {form.purpose === 'CAMPAIGN' ? 'Campanha' : 'Embed'}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      {form.productType === 'ONE_NEXUS' ? 'One Nexus' : form.productType === 'LOCADORAS' ? 'Nexloc' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-nexus-orange">{form._count?.submissions || 0}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      {form.createdBy?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      form.isActive
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-zinc-500/10 text-zinc-400',
                    )}>
                      {form.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={(e) => handleOpenMenu(e, form.id)}
                      className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100')}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {/* Dropdown renderizado fora da tabela com position fixed */}
      {menuOpen && (
        <FormActions
          form={forms.find(f => f.id === menuOpen.id)!}
          pos={menuOpen}
          isDark={isDark}
          onClose={() => setMenuOpen(null)}
        />
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => navigate('/forms/new')}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 md:hidden w-14 h-14 bg-nexus-orange hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
