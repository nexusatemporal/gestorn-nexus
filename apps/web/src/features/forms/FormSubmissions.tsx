import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, Users, Download, ExternalLink,
  CheckCircle2, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useForm, useFormSubmissions } from './hooks/useForms';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOVO: { label: 'Novo', color: 'bg-blue-500/10 text-blue-400' },
  CONTATO: { label: 'Em contato', color: 'bg-yellow-500/10 text-yellow-400' },
  QUALIFICADO: { label: 'Qualificado', color: 'bg-green-500/10 text-green-400' },
  GANHO: { label: 'Ganho', color: 'bg-emerald-500/10 text-emerald-500' },
  PERDIDO: { label: 'Perdido', color: 'bg-red-500/10 text-red-400' },
};

export function FormSubmissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const [page, setPage] = useState(1);

  const { data: form, isLoading: formLoading } = useForm(id!);
  const { data, isLoading } = useFormSubmissions(id!, page, 25);

  const submissions = data?.submissions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  function exportCsv() {
    if (!submissions.length || !form) return;
    const fieldIds = (form.fields || []).map((f) => f.id);
    const fieldLabels = (form.fields || []).map((f) => f.label);

    const header = ['Data', ...fieldLabels, 'Lead Criado', 'Status Lead'].join(';');
    const rows = submissions.map((s) => {
      const values = fieldIds.map((fid) => `"${(s.data[fid] || '').replace(/"/g, '""')}"`);
      const leadStatus = s.lead?.status
        ? (STATUS_LABELS[s.lead.status]?.label || s.lead.status)
        : '—';
      return [
        `"${formatDate(s.createdAt)}"`,
        ...values,
        s.lead ? 'Sim' : 'Não',
        leadStatus,
      ].join(';');
    });

    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissoes-${form.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (formLoading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', isDark ? 'bg-zinc-950' : 'bg-zinc-50')}>
        <div className="w-8 h-8 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen p-3 md:p-6', isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900')}>
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <button
          onClick={() => navigate('/forms')}
          className={cn('flex items-center gap-1.5 text-sm mb-3 md:mb-4 py-1 transition-colors active:scale-95', isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700')}
        >
          <ArrowLeft size={16} />
          Formulários
        </button>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:flex-wrap md:gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
              <ClipboardList size={22} className="md:w-[26px] md:h-[26px] text-nexus-orange" />
              {form?.name || '—'}
            </h1>
            <p className={cn('text-xs md:text-sm mt-1 font-mono', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              /f/{form?.slug}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              disabled={!submissions.length}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 md:py-2 rounded-xl text-sm font-medium transition-colors border active:scale-95',
                isDark
                  ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40'
                  : 'border-zinc-200 hover:bg-zinc-100 text-zinc-600 disabled:opacity-40',
              )}
            >
              <Download size={15} />
              <span className="hidden md:inline">Exportar CSV</span>
              <span className="md:hidden">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        {[
          { label: 'Total de Submissões', value: total, icon: ClipboardList },
          { label: 'Leads Criados', value: submissions.filter(s => s.lead).length + (page > 1 ? '...' : ''), icon: Users },
          {
            label: 'Nesta Página',
            value: `${submissions.length} de ${total}`,
            icon: CheckCircle2,
          },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl p-4 border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={15} className="text-nexus-orange" />
              <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{stat.label}</span>
            </div>
            <p className="text-lg md:text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Clock size={48} className={isDark ? 'text-zinc-700' : 'text-zinc-300'} />
            <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              Nenhuma submissão ainda
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: card view */}
            <div className={cn('md:hidden divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-100')}>
              {submissions.map((sub) => {
                const statusInfo = sub.lead?.status
                  ? (STATUS_LABELS[sub.lead.status] || { label: sub.lead.status, color: 'bg-zinc-500/10 text-zinc-400' })
                  : null;
                // Show first 2 visible fields
                const previewFields = (form?.fields || []).slice(0, 2);
                return (
                  <div key={sub.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        {formatDate(sub.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {sub.lead && <CheckCircle2 size={14} className="text-green-500" />}
                        {statusInfo && (
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {previewFields.map((f) => (
                      <div key={f.id}>
                        <span className={cn('text-[10px] font-medium', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{f.label}: </span>
                        <span className={cn('text-xs', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                          {sub.data[f.id] || '—'}
                        </span>
                      </div>
                    ))}
                    {sub.lead && (
                      <button
                        onClick={() => navigate('/leads')}
                        className="text-[10px] font-bold text-nexus-orange flex items-center gap-1 mt-1"
                      >
                        Ver Lead <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Desktop: table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('text-xs font-semibold uppercase tracking-wide border-b', isDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-100 text-zinc-400')}>
                    <th className="px-5 py-3 text-left">Data</th>
                    {(form?.fields || []).map((f) => (
                      <th key={f.id} className="px-4 py-3 text-left whitespace-nowrap">{f.label}</th>
                    ))}
                    <th className="px-4 py-3 text-center">Lead</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => {
                    const statusInfo = sub.lead?.status
                      ? (STATUS_LABELS[sub.lead.status] || { label: sub.lead.status, color: 'bg-zinc-500/10 text-zinc-400' })
                      : null;
                    return (
                      <tr
                        key={sub.id}
                        className={cn('border-t transition-colors', isDark ? 'border-zinc-800 hover:bg-zinc-800/40' : 'border-zinc-100 hover:bg-zinc-50')}
                      >
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            {formatDate(sub.createdAt)}
                          </span>
                        </td>
                        {(form?.fields || []).map((f) => (
                          <td key={f.id} className="px-4 py-3 max-w-xs">
                            <span className={cn('text-xs truncate block', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                              {sub.data[f.id] || <span className="text-zinc-500">—</span>}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                          {sub.lead ? (
                            <CheckCircle2 size={16} className="inline text-green-500" />
                          ) : (
                            <span className={cn('text-xs', isDark ? 'text-zinc-600' : 'text-zinc-300')}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {statusInfo ? (
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusInfo.color)}>
                              {statusInfo.label}
                            </span>
                          ) : (
                            <span className={cn('text-xs', isDark ? 'text-zinc-600' : 'text-zinc-400')}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sub.lead && (
                            <button
                              onClick={() => navigate('/leads')}
                              title="Ver no Kanban"
                              className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={cn('flex items-center justify-between px-5 py-3 border-t', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
                <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn('p-1.5 rounded-lg transition-colors disabled:opacity-40', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={cn('p-1.5 rounded-lg transition-colors disabled:opacity-40', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
