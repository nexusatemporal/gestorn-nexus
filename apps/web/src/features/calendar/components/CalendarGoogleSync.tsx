/**
 * Calendar Google Sync Component
 * Button for Google Calendar integration
 */

import { useEffect } from 'react';
import { RefreshCw } from '@/components/icons';
import {
  useGoogleCalendarStatus,
  useGoogleAuthUrl,
  useGoogleSync,
  useGoogleDisconnect,
  openGoogleAuthPopup,
} from '../hooks/useGoogleCalendar';

export function CalendarGoogleSync() {
  const { data: status, refetch: refetchStatus } = useGoogleCalendarStatus();
  const { refetch: getAuthUrl } = useGoogleAuthUrl();
  const syncMutation = useGoogleSync();
  const disconnectMutation = useGoogleDisconnect();

  const isConnected = status?.isConnected || false;
  const isSyncing = syncMutation.isPending;

  const handleConnect = async () => {
    try {
      const { data } = await getAuthUrl();
      if (data?.authUrl) {
        openGoogleAuthPopup(data.authUrl, {
          onSuccess: () => {
            refetchStatus();
            alert('Google Calendar conectado com sucesso!');
          },
          onError: () => {
            alert('Erro ao conectar Google Calendar. Tente novamente.');
          },
        });
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Erro ao gerar URL de autorização');
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      alert(`${result.imported} eventos importados do Google Calendar!`);
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Erro ao sincronizar. Tente novamente.');
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Deseja realmente desconectar o Google Calendar?')) {
      try {
        await disconnectMutation.mutateAsync();
        refetchStatus();
        alert('Google Calendar desconectado com sucesso!');
      } catch (error) {
        console.error('Error disconnecting:', error);
        alert('Erro ao desconectar. Tente novamente.');
      }
    }
  };

  // Listen for Google OAuth callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-calendar-connected') {
        refetchStatus();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetchStatus]);

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="p-2.5 rounded-xl border transition-all flex items-center gap-2 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-nexus-orange/50"
        title="Conectar Google Calendar"
      >
        <RefreshCw size={18} />
        <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">
          Conectar Google
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="p-2.5 rounded-xl border transition-all flex items-center gap-2 bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Sincronizar com Google Calendar"
      >
        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
        <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">
          {isSyncing ? 'Sincronizando...' : 'Google Sync'}
        </span>
      </button>

      {/* Disconnect button */}
      <button
        onClick={handleDisconnect}
        className="p-2.5 rounded-xl border transition-all bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20"
        title="Desconectar Google Calendar"
      >
        <span className="text-sm font-bold">×</span>
      </button>
    </div>
  );
}
