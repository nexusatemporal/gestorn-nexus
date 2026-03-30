import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { chatApi } from './services/chat.api';

/**
 * ChatPage — Página do Chat Nexus embeddado via iframe com SSO
 *
 * Fluxo:
 * 1. Componente monta → chama backend para gerar SSO token
 * 2. Backend chama Chat Nexus API → retorna token temporário (5 min)
 * 3. Renderiza iframe com URL do Chat + token
 *
 * v2.65.0
 */
export function ChatPage() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await chatApi.getSsoToken();
      setChatUrl(result.chatUrl);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erro ao conectar com o Chat Nexus';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Loading state
  if (loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[calc(100vh-8rem)] md:h-[calc(100vh-80px)] ${
          isDark ? 'bg-zinc-950' : 'bg-zinc-50'
        }`}
      >
        <div className="w-10 h-10 border-3 border-nexus-orange border-t-transparent rounded-full animate-spin mb-4" />
        <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Conectando ao Chat Nexus...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[calc(100vh-8rem)] md:h-[calc(100vh-80px)] ${
          isDark ? 'bg-zinc-950' : 'bg-zinc-50'
        }`}
      >
        <div
          className={`p-6 rounded-xl border max-w-md text-center ${
            isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-white border-zinc-200'
          }`}
        >
          <AlertTriangle
            size={40}
            className="text-nexus-orange mx-auto mb-3"
          />
          <h3
            className={`text-lg font-semibold mb-2 ${
              isDark ? 'text-zinc-100' : 'text-zinc-900'
            }`}
          >
            Erro ao carregar Chat
          </h3>
          <p
            className={`text-sm mb-4 ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            {error}
          </p>
          <button
            onClick={loadChat}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nexus-orange text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Chat iframe
  return (
    <div
      className={`h-[calc(100vh-8rem)] md:h-[calc(100vh-80px)] ${
        isDark ? 'bg-zinc-950' : 'bg-zinc-50'
      }`}
    >
      {chatUrl ? (
        <iframe
          src={chatUrl}
          title="Chat Nexus"
          className="w-full h-full border-0 rounded-lg"
          allow="microphone; camera; clipboard-write"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageCircle
              size={48}
              className={`mx-auto mb-3 ${
                isDark ? 'text-zinc-600' : 'text-zinc-300'
              }`}
            />
            <p
              className={`text-sm ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}
            >
              Chat não disponível
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
