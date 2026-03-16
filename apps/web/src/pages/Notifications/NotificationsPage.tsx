import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Bell, Settings2, CheckCheck, Search, X, ChevronLeft, ChevronRight,
  TrendingUp, DollarSign, Zap, Users, AlertTriangle, Info, Save,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import {
  useNotificationsPage,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  usePreferences,
  useUpdatePreferences,
} from '@/features/notifications/hooks/useNotifications';
import type { NotificationPreferences } from '@/features/notifications/services/notifications.api';

// ──────────────────────────────────────────────────────────────────────────
// Configurações visuais por tipo
// ──────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string; label: string; group: string }> = {
  PAYMENT_RECEIVED:      { icon: DollarSign,    color: 'text-green-500',  bg: 'bg-green-500/10',  label: 'Pagamento Recebido',    group: 'Financeiro' },
  PAYMENT_OVERDUE:       { icon: AlertTriangle,  color: 'text-red-500',    bg: 'bg-red-500/10',    label: 'Pagamento em Atraso',   group: 'Financeiro' },
  SUBSCRIPTION_EXPIRING: { icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Assinatura Vencendo',   group: 'Financeiro' },
  NEW_LEAD:              { icon: TrendingUp,     color: 'text-blue-500',   bg: 'bg-blue-500/10',   label: 'Novo Lead',             group: 'Leads' },
  LEAD_ASSIGNED:         { icon: Users,          color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Lead Atribuído',        group: 'Leads' },
  LEAD_CONVERTED:        { icon: TrendingUp,     color: 'text-green-500',  bg: 'bg-green-500/10',  label: 'Lead Convertido',       group: 'Leads' },
  AI_CHURN_ALERT:        { icon: Zap,            color: 'text-red-500',    bg: 'bg-red-500/10',    label: 'Risco de Churn',        group: 'IA' },
  AI_OPPORTUNITY:        { icon: Zap,            color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Oportunidade IA',       group: 'IA' },
  AI_LEAD_SCORE:         { icon: Zap,            color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Score de Lead',         group: 'IA' },
  SYSTEM_UPDATE:         { icon: Info,           color: 'text-blue-500',   bg: 'bg-blue-500/10',   label: 'Atualização do Sistema', group: 'Sistema' },
  SYSTEM_ALERT:          { icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Alerta do Sistema',     group: 'Sistema' },
};

const DEFAULT_CFG = { icon: Bell, color: 'text-zinc-500', bg: 'bg-zinc-500/10', label: 'Notificação', group: '' };
const EMAIL_TYPES = new Set(['PAYMENT_OVERDUE', 'AI_CHURN_ALERT', 'SYSTEM_ALERT']);

const TYPE_GROUPS = [
  { key: 'Financeiro', types: ['PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_EXPIRING'] },
  { key: 'Leads',      types: ['NEW_LEAD', 'LEAD_ASSIGNED', 'LEAD_CONVERTED'] },
  { key: 'IA',         types: ['AI_LEAD_SCORE', 'AI_OPPORTUNITY', 'AI_CHURN_ALERT'] },
  { key: 'Sistema',    types: ['SYSTEM_UPDATE', 'SYSTEM_ALERT'] },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ──────────────────────────────────────────────────────────────────────────
// PreferencesPanel
// ──────────────────────────────────────────────────────────────────────────

function PreferencesPanel({
  isDark,
  onClose,
}: {
  isDark: boolean;
  onClose: () => void;
}) {
  const { data: prefs, isLoading } = usePreferences();
  const update = useUpdatePreferences();

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);
  const effective = localPrefs ?? prefs ?? {};

  const toggle = (type: string, channel: 'inApp' | 'email') => {
    const current = effective[type] ?? { inApp: true, email: true };
    setLocalPrefs({ ...effective, [type]: { ...current, [channel]: !current[channel] } });
  };

  const handleSave = () => {
    const payload = Object.entries(effective).map(([type, val]) => ({
      type,
      inApp: val.inApp,
      email: val.email,
    }));
    update.mutate(payload, { onSuccess: onClose });
  };

  return (
    <div
      className={clsx(
        'absolute right-0 top-0 h-full w-80 z-20 border-l shadow-xl flex flex-col overflow-hidden',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200',
      )}
    >
      {/* Header */}
      <div className={clsx('flex items-center justify-between px-5 py-4 border-b', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-nexus-orange" />
          <span className={clsx('font-bold text-sm', isDark ? 'text-white' : 'text-zinc-900')}>Preferências</span>
        </div>
        <button onClick={onClose} className={clsx('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}>
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
        {isLoading ? (
          <p className={clsx('text-xs text-center py-8', isDark ? 'text-zinc-500' : 'text-zinc-400')}>Carregando...</p>
        ) : (
          TYPE_GROUPS.map(({ key, types }) => (
            <div key={key}>
              <p className={clsx('text-[10px] font-bold uppercase tracking-widest mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{key}</p>
              <div className="space-y-2">
                {types.map((type) => {
                  const cfg = TYPE_CONFIG[type] ?? DEFAULT_CFG;
                  const pref = effective[type] ?? { inApp: true, email: true };
                  const hasEmail = EMAIL_TYPES.has(type);
                  return (
                    <div key={type} className={clsx('flex items-center justify-between py-2 px-3 rounded-xl', isDark ? 'bg-zinc-800/50' : 'bg-zinc-50')}>
                      <span className={clsx('text-xs font-medium truncate', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{cfg.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* In-app toggle */}
                        <button
                          onClick={() => toggle(type, 'inApp')}
                          title="Notificação no app"
                          className={clsx(
                            'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors',
                            pref.inApp
                              ? 'bg-nexus-orange text-white'
                              : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-400',
                          )}
                        >
                          <Bell size={9} /> App
                        </button>
                        {/* Email toggle (só para tipos críticos) */}
                        {hasEmail && (
                          <button
                            onClick={() => toggle(type, 'email')}
                            title="Email"
                            className={clsx(
                              'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors',
                              pref.email
                                ? 'bg-blue-500 text-white'
                                : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-400',
                            )}
                          >
                            @ Email
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className={clsx('px-5 py-3 border-t', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
        <button
          onClick={handleSave}
          disabled={update.isPending || !localPrefs}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-nexus-orange text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          <Save size={14} /> {update.isPending ? 'Salvando...' : 'Salvar Preferências'}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [readFilter, setReadFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);

  const { data, isLoading } = useNotificationsPage({
    page,
    limit: 20,
    type: selectedType,
    isRead: readFilter,
    search: debouncedSearch || undefined,
  });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotif = useDeleteNotification();

  const notifications = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const unreadCount = data?.unreadCount ?? 0;

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as unknown as { _notifSearchTimer?: ReturnType<typeof setTimeout> })._notifSearchTimer);
    (window as unknown as { _notifSearchTimer?: ReturnType<typeof setTimeout> })._notifSearchTimer = setTimeout(
      () => { setDebouncedSearch(val); setPage(1); },
      400,
    );
  };

  const handleTypeFilter = (t?: string) => { setSelectedType(t); setPage(1); };
  const handleReadFilter = (v?: boolean) => { setReadFilter(v); setPage(1); };

  return (
    <div className={clsx('flex flex-col h-full', isDark ? 'bg-zinc-950' : 'bg-zinc-50')}>
      {/* ── Header ── */}
      <div className={clsx('px-8 py-6 border-b', isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-nexus-orange/10">
              <Bell size={20} className="text-nexus-orange" />
            </div>
            <div>
              <h1 className={clsx('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                Notificações
              </h1>
              <p className={clsx('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                {total > 0 ? `${total} notificações` : 'Nenhuma notificação'}{unreadCount > 0 && ` · ${unreadCount} não lidas`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                  isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100',
                )}
              >
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            )}
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                showPrefs
                  ? 'bg-nexus-orange text-white'
                  : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100',
              )}
            >
              <Settings2 size={14} /> Preferências
            </button>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* Read status */}
          <div className={clsx('flex rounded-xl p-0.5', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
            {[
              { label: `Todas`, val: undefined },
              { label: `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}`, val: false },
              { label: 'Lidas', val: true },
            ].map(({ label, val }) => (
              <button
                key={String(val)}
                onClick={() => handleReadFilter(val)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  readFilter === val
                    ? 'bg-nexus-orange text-white shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: '📋 Todas', val: undefined },
              { label: '💰 Financeiro', val: 'PAYMENT_RECEIVED,PAYMENT_OVERDUE,SUBSCRIPTION_EXPIRING' },
              { label: '👤 Leads', val: 'NEW_LEAD,LEAD_ASSIGNED,LEAD_CONVERTED' },
              { label: '🤖 IA', val: 'AI_LEAD_SCORE,AI_OPPORTUNITY,AI_CHURN_ALERT' },
              { label: '⚙️ Sistema', val: 'SYSTEM_UPDATE,SYSTEM_ALERT' },
            ].map(({ label, val }) => (
              <button
                key={String(val)}
                onClick={() => handleTypeFilter(val)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                  selectedType === val
                    ? 'border-nexus-orange bg-nexus-orange/10 text-nexus-orange'
                    : isDark
                    ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                    : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar notificações..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className={clsx(
                'pl-9 pr-3 py-2 text-xs rounded-xl border outline-none focus:ring-1 focus:ring-nexus-orange w-56',
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400',
              )}
            />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Notification list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Bell size={40} className="text-zinc-300" />
              <p className={clsx('text-sm font-medium', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                {debouncedSearch || selectedType || readFilter !== undefined
                  ? 'Nenhuma notificação encontrada para os filtros aplicados'
                  : 'Nenhuma notificação'}
              </p>
            </div>
          ) : (
            <div className={clsx('divide-y', isDark ? 'divide-zinc-800/60' : 'divide-zinc-100')}>
              {notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? DEFAULT_CFG;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={clsx(
                      'group flex items-start gap-4 px-8 py-4 transition-colors relative',
                      !n.isRead && (isDark ? 'bg-orange-500/5' : 'bg-orange-50/40'),
                      isDark ? 'hover:bg-zinc-900' : 'hover:bg-zinc-50',
                    )}
                  >
                    {/* Dot não lido */}
                    {!n.isRead && (
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-nexus-orange" />
                    )}

                    {/* Ícone */}
                    <div className={clsx('p-2.5 rounded-xl shrink-0 mt-0.5', cfg.bg)}>
                      <Icon size={16} className={cfg.color} />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <p className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className={clsx('text-xs mt-0.5 leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                        {n.message}
                      </p>
                      <span className={clsx('inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead.mutate(n.id)}
                          className={clsx('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700 text-zinc-500' : 'hover:bg-zinc-200 text-zinc-400')}
                          title="Marcar como lida"
                        >
                          <CheckCheck size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotif.mutate(n.id)}
                        className={clsx('p-1.5 rounded-lg transition-colors text-red-400 hover:text-red-500', isDark ? 'hover:bg-zinc-700' : 'hover:bg-red-50')}
                        title="Remover"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <div className={clsx('flex items-center justify-between px-8 py-4 border-t', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
              <p className={clsx('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                Mostrando {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} de {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className={clsx('p-1.5 rounded-lg transition-colors disabled:opacity-30', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={clsx(
                        'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                        p === page
                          ? 'bg-nexus-orange text-white'
                          : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100',
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className={clsx('p-1.5 rounded-lg transition-colors disabled:opacity-30', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preferences slide-over */}
        {showPrefs && (
          <PreferencesPanel isDark={isDark} onClose={() => setShowPrefs(false)} />
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;
