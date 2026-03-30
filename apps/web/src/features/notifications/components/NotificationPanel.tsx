import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Bell, BellOff, X, CheckCheck, ExternalLink,
  TrendingUp, DollarSign, Zap, Users, AlertTriangle, Info, Megaphone, Send,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, useMarkAsRead, useMarkAllAsRead, useBroadcast } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import type { Notification } from '../services/notifications.api';

interface NotificationPanelProps {
  onClose: () => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  PAYMENT_RECEIVED:      { icon: DollarSign,    color: 'text-green-500',  bg: 'bg-green-500/10' },
  PAYMENT_OVERDUE:       { icon: AlertTriangle,  color: 'text-red-500',    bg: 'bg-red-500/10' },
  SUBSCRIPTION_EXPIRING: { icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  NEW_LEAD:              { icon: TrendingUp,     color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  LEAD_ASSIGNED:         { icon: Users,          color: 'text-purple-500', bg: 'bg-purple-500/10' },
  LEAD_CONVERTED:        { icon: TrendingUp,     color: 'text-green-500',  bg: 'bg-green-500/10' },
  AI_CHURN_ALERT:        { icon: Zap,            color: 'text-red-500',    bg: 'bg-red-500/10' },
  AI_OPPORTUNITY:        { icon: Zap,            color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  AI_LEAD_SCORE:         { icon: Zap,            color: 'text-orange-500', bg: 'bg-orange-500/10' },
  SYSTEM_UPDATE:         { icon: Info,           color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  SYSTEM_ALERT:          { icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
};

const DEFAULT_CONFIG = { icon: Bell, color: 'text-zinc-500', bg: 'bg-zinc-500/10' };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function NotificationItem({
  notification,
  isDark,
  onRead,
  onClose,
}: {
  notification: Notification;
  isDark: boolean;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[notification.type] ?? DEFAULT_CONFIG;
  const Icon = cfg.icon;

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
    onClose();
    navigate('/notifications');
  };

  return (
    <div
      className={clsx(
        'group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer relative',
        !notification.isRead && (isDark ? 'bg-orange-500/5' : 'bg-orange-50/60'),
        isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'
      )}
      onClick={handleClick}
    >
      {/* Dot não lido */}
      {!notification.isRead && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-nexus-orange" />
      )}

      {/* Ícone */}
      <div className={clsx('p-2 rounded-xl shrink-0 mt-0.5', cfg.bg)}>
        <Icon size={14} className={cfg.color} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-semibold leading-tight', isDark ? 'text-white' : 'text-zinc-900')}>
          {notification.title}
        </p>
        <p className={clsx('text-xs mt-0.5 leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          {notification.message}
        </p>
        <p className="text-[10px] text-zinc-500 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>

      {/* Botão dismiss (marca como lida) */}
      {!notification.isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onRead(notification.id); }}
          className={clsx(
            'opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 md:p-1 rounded-lg md:rounded transition-all shrink-0 active:scale-95',
            isDark ? 'hover:bg-zinc-700 text-zinc-500' : 'hover:bg-zinc-200 text-zinc-400'
          )}
        >
          <X size={14} className="md:w-3 md:h-3" />
        </button>
      )}
    </div>
  );
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { theme } = useUIStore();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const broadcast = useBroadcast();
  const { isMuted, toggleMute, isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe, permission: pushPermission } = usePushNotifications();

  const canBroadcast = user?.role === 'SUPERADMIN' || user?.role === 'ADMINISTRATIVO';
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => localStorage.getItem('gnx_push_banner_dismissed') === 'true');
  const [pushSubscribing, setPushSubscribing] = useState(false);

  const showPushBanner = pushSupported && !pushSubscribed && !pushBannerDismissed && pushPermission !== 'denied';

  const handleEnablePush = async () => {
    setPushSubscribing(true);
    const ok = await pushSubscribe();
    setPushSubscribing(false);
    if (ok) setPushBannerDismissed(true);
  };

  const handleDismissPushBanner = () => {
    localStorage.setItem('gnx_push_banner_dismissed', 'true');
    setPushBannerDismissed(true);
  };
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');

  const handleBroadcast = () => {
    if (!bTitle.trim() || !bMessage.trim()) return;
    broadcast.mutate(
      { title: bTitle.trim(), message: bMessage.trim() },
      {
        onSuccess: () => {
          setBTitle('');
          setBMessage('');
          setShowBroadcast(false);
        },
      },
    );
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      ref={panelRef}
      className={clsx(
        'overflow-hidden flex flex-col',
        // Mobile: fills parent container (Header renders fixed wrapper outside)
        'w-full h-full',
        // Desktop: absolute dropdown with border/shadow
        'md:absolute md:right-0 md:top-12 md:w-96 md:max-h-[520px] md:h-auto md:rounded-2xl md:border md:shadow-2xl',
        isDark ? 'bg-zinc-900 md:border-zinc-800' : 'bg-white md:border-zinc-200',
      )}
    >
      {/* Header */}
      <div className={clsx('flex items-center justify-between px-4 py-3 border-b', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-nexus-orange" />
          <span className={clsx('font-bold text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
            Notificações
          </span>
          {unread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-nexus-orange text-white">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Mute push notifications button */}
          {pushSupported && pushSubscribed && (
            <button
              onClick={toggleMute}
              title={isMuted ? 'Ativar notificações push' : 'Silenciar notificações push'}
              className={clsx(
                'p-2 md:p-1.5 rounded-lg transition-colors active:scale-95',
                isMuted
                  ? 'text-red-400 hover:text-red-500 ' + (isDark ? 'hover:bg-zinc-800' : 'hover:bg-red-50')
                  : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100',
              )}
            >
              {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
            </button>
          )}
          {unread > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              className={clsx('flex items-center gap-1 px-2.5 md:px-2 py-1.5 md:py-1 rounded-lg text-sm md:text-[11px] font-medium transition-colors active:scale-95',
                isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100'
              )}
            >
              <CheckCheck size={12} /> Marcar todas
            </button>
          )}
          <button
            onClick={onClose}
            className={clsx('p-2 md:p-1.5 rounded-lg transition-colors active:scale-95', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Push activation banner */}
      {showPushBanner && (
        <div className={clsx('px-4 py-3 border-b flex items-start gap-3', isDark ? 'border-zinc-800 bg-nexus-orange/5' : 'border-zinc-100 bg-orange-50/60')}>
          <div className="p-1.5 rounded-lg bg-nexus-orange/10 shrink-0 mt-0.5">
            <Bell size={14} className="text-nexus-orange" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={clsx('text-xs font-semibold leading-tight', isDark ? 'text-white' : 'text-zinc-900')}>
              Ativar notificações push
            </p>
            <p className={clsx('text-[11px] mt-0.5 leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              Receba alertas mesmo quando não estiver no Gestor
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleEnablePush}
                disabled={pushSubscribing}
                className="text-sm md:text-[11px] font-semibold px-3 py-1.5 md:py-1 rounded-lg bg-nexus-orange text-white disabled:opacity-50 transition-opacity active:scale-95"
              >
                {pushSubscribing ? 'Ativando...' : 'Ativar'}
              </button>
              <button
                onClick={handleDismissPushBanner}
                className={clsx('text-sm md:text-[11px] px-2.5 md:px-2 py-1.5 md:py-1 rounded-lg transition-colors active:scale-95', isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600')}
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            onClick={handleDismissPushBanner}
            className={clsx('p-0.5 rounded shrink-0', isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-300 hover:text-zinc-500')}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {isLoading ? (
          <div className={clsx('py-12 text-center text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Carregando...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={32} className="mx-auto mb-3 text-zinc-300" />
            <p className={clsx('text-sm font-medium', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              Nenhuma notificação
            </p>
            <p className="text-xs text-zinc-500 mt-1">Você está em dia!</p>
          </div>
        ) : (
          <div className={clsx('divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-100')}>
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                isDark={isDark}
                onRead={(id) => markAsRead.mutate(id)}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ver tudo */}
      <div className={clsx('px-4 py-2 border-t text-center', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
        <Link
          to="/notifications"
          onClick={onClose}
          className={clsx('inline-flex items-center gap-1.5 text-xs font-medium transition-colors', isDark ? 'text-zinc-400 hover:text-nexus-orange' : 'text-zinc-500 hover:text-nexus-orange')}
        >
          <ExternalLink size={11} /> Ver centro de notificações
        </Link>
      </div>

      {/* Footer — Marcar todas como lidas */}
      {unread > 0 && (
        <div className={clsx('px-4 py-2.5 border-t text-center', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
          <button
            onClick={() => markAllAsRead.mutate()}
            className={clsx('flex items-center gap-1.5 mx-auto text-sm md:text-xs py-1 transition-colors active:scale-95', isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-400 hover:text-zinc-600')}
          >
            <CheckCheck size={11} /> Marcar todas como lidas
          </button>
        </div>
      )}

      {/* Footer — Broadcast (apenas SUPERADMIN / ADMINISTRATIVO) */}
      {canBroadcast && (
        <div className={clsx('border-t', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
          {!showBroadcast ? (
            <div className="px-4 py-2 text-center">
              <button
                onClick={() => setShowBroadcast(true)}
                className={clsx(
                  'flex items-center gap-1.5 mx-auto text-sm md:text-xs py-1 transition-colors active:scale-95',
                  isDark ? 'text-zinc-600 hover:text-orange-400' : 'text-zinc-400 hover:text-nexus-orange',
                )}
              >
                <Megaphone size={11} /> Broadcast
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 flex flex-col gap-2">
              <input
                type="text"
                placeholder="Título do broadcast"
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                className={clsx(
                  'w-full text-base md:text-xs rounded-lg px-3 py-2 border outline-none focus:ring-1 focus:ring-nexus-orange',
                  isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400',
                )}
              />
              <textarea
                placeholder="Mensagem..."
                rows={2}
                value={bMessage}
                onChange={(e) => setBMessage(e.target.value)}
                className={clsx(
                  'w-full text-base md:text-xs rounded-lg px-3 py-2 border outline-none focus:ring-1 focus:ring-nexus-orange resize-none',
                  isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400',
                )}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowBroadcast(false); setBTitle(''); setBMessage(''); }}
                  className={clsx('text-sm md:text-xs px-3 py-2 md:py-1.5 rounded-lg transition-colors active:scale-95', isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100')}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={!bTitle.trim() || !bMessage.trim() || broadcast.isPending}
                  className="flex items-center gap-1.5 text-sm md:text-xs px-3 py-2 md:py-1.5 rounded-lg bg-nexus-orange text-white font-medium disabled:opacity-50 transition-opacity active:scale-95"
                >
                  <Send size={10} />
                  {broadcast.isPending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
