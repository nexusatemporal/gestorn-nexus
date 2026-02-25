/**
 * ══════════════════════════════════════════════════════════════════════════
 * 💬 MESSAGE BUBBLE - Componente de mensagem do chat
 * ══════════════════════════════════════════════════════════════════════════
 */

import { clsx } from 'clsx';
import { Bot, User } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '@/stores/useUIStore';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  timestamp,
  isStreaming = false,
}: MessageBubbleProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const isUser = role === 'user';

  return (
    <div
      className={clsx('flex gap-3', {
        'flex-row-reverse': isUser,
      })}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          {
            'bg-orange-500 text-white': isUser,
            'bg-purple-100 text-purple-600': !isUser && !isDark,
            'bg-purple-900/50 text-purple-400': !isUser && isDark,
          }
        )}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      {/* Message Content */}
      <div className="flex max-w-[70%] flex-col gap-1">
        <div
          className={clsx('rounded-2xl px-4 py-2.5', {
            'bg-orange-500 text-white': isUser,
            'bg-gray-100 text-gray-900': !isUser && !isDark,
            'bg-zinc-800 text-zinc-100': !isUser && isDark,
          })}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {content}
          </p>

          {/* Streaming indicator */}
          {isStreaming && !isUser && (
            <span className={clsx('mt-1 inline-block animate-pulse text-xs', isDark ? 'text-zinc-500' : 'text-gray-500')}>
              ●●●
            </span>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span
            className={clsx('text-xs', isDark ? 'text-zinc-500' : 'text-gray-500', {
              'text-right': isUser,
            })}
          >
            {format(timestamp, 'HH:mm')}
          </span>
        )}
      </div>
    </div>
  );
}
