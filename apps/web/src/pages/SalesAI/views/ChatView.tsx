/**
 * ══════════════════════════════════════════════════════════════════════════
 * 💬 CHAT VIEW - Interface de chat com IA
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Send, Sparkles } from 'lucide-react';
import type { LeadContext, ChatMessage } from '@/hooks/useSalesAI';
import { useChatAI } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface ChatViewProps {
  leadContext: LeadContext | null;
  provider?: 'groq' | 'gemini' | 'openai';
}

export function ChatView({ leadContext, provider = 'groq' }: ChatViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useChatAI();

  // Auto-scroll ao adicionar mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !leadContext) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    try {
      const response = await chatMutation.mutateAsync({
        message: inputMessage,
        leadContext,
        history: messages,
        provider,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Atualizar sugestões e próximas ações
      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
      if (response.nextActions) {
        setNextActions(response.nextActions);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Selecione um lead para iniciar o chat</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col max-h-full overflow-hidden">
      {/* Chat Messages */}
      <div className="flex-1 p-8 space-y-6 overflow-y-auto min-h-0 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles size={48} className="mb-4 text-orange-500" />
            <h3 className={clsx('mb-2 text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Olá! Como posso ajudar?
            </h3>
            <p className="mb-6 text-sm text-zinc-500">
              Faça perguntas sobre o lead, estratégias de vendas, ou peça
              sugestões para a próxima ação.
            </p>

            {/* Quick Start Suggestions */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                SUGESTÕES RÁPIDAS
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Quais são as maiores dores desse lead?',
                  'Como abordar esse perfil DISC?',
                  'Qual a melhor estratégia para fechar?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={clsx('rounded-full border px-4 py-2 text-sm transition-colors', isDark ? 'border-zinc-800 text-zinc-400 hover:bg-zinc-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={clsx('flex animate-in fade-in slide-in-from-bottom-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[80%] p-5 rounded-3xl relative', {
                  'bg-orange-500 text-white rounded-tr-none shadow-xl shadow-orange-500/20': message.role === 'user',
                  'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none': message.role === 'assistant' && isDark,
                  'bg-white border border-zinc-200 shadow-sm text-zinc-800 rounded-tl-none': message.role === 'assistant' && !isDark,
                })}>
                  {message.role === 'assistant' && (
                    <div className="absolute -top-3 -left-3 p-1.5 bg-orange-500 text-white rounded-full">
                      <Sparkles size={12} />
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <div className={clsx('mt-3 flex items-center gap-2 text-[9px] uppercase font-bold tracking-widest', message.role === 'user' ? 'text-white/60' : 'text-zinc-500')}>
                    {message.role === 'user' ? 'Você' : 'Nexus AI'} • Agora
                  </div>
                </div>
              </div>
            ))}

            {/* Loading / Typing */}
            {chatMutation.isPending && (
              <div className="flex justify-start animate-pulse">
                <div className={clsx('p-4 rounded-3xl rounded-tl-none flex gap-1', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-orange-500/60 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-orange-500/30 rounded-full"></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Suggestions Pills */}
      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <p className="w-full text-xs font-medium text-zinc-500">
            PERGUNTAS SUGERIDAS
          </p>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className={clsx('rounded-full border px-3 py-1.5 text-xs transition-colors', isDark ? 'border-blue-800 bg-blue-950/50 text-blue-400 hover:bg-blue-900/50' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100')}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Next Actions */}
      {nextActions.length > 0 && (
        <div className={clsx('mb-3 rounded-lg p-3', isDark ? 'bg-green-950/30 border border-green-900/50' : 'bg-green-50')}>
          <p className={clsx('mb-2 text-xs font-medium', isDark ? 'text-green-400' : 'text-green-900')}>
            PRÓXIMAS AÇÕES RECOMENDADAS
          </p>
          <div className="space-y-1">
            {nextActions.map((action, index) => (
              <div
                key={index}
                className={clsx('flex items-center gap-2 text-sm', isDark ? 'text-green-300' : 'text-green-800')}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={clsx('p-8 border-t', isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}>
        <div className={clsx('relative flex items-center border rounded-2xl p-2 transition-all focus-within:ring-2 focus-within:ring-orange-500/30', isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300 shadow-lg shadow-black/5')}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Pergunte ao seu copiloto: 'Como quebrar a objeção de preço?' ou 'Gere um pitch para este lead'..."
            className={clsx('flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-sm outline-none', isDark ? 'text-white placeholder-zinc-600' : 'text-zinc-900 placeholder-zinc-400')}
            disabled={chatMutation.isPending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || chatMutation.isPending}
            className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
