/**
 * ══════════════════════════════════════════════════════════════════════════
 * 👍 FEEDBACK BUTTONS - Thumbs up/down para feedback
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useSubmitFeedback } from '@/hooks/useSalesAI';

interface FeedbackButtonsProps {
  messageId: string;
  onFeedbackSubmitted?: (rating: 'helpful' | 'not_helpful') => void;
}

export function FeedbackButtons({
  messageId,
  onFeedbackSubmitted,
}: FeedbackButtonsProps) {
  const [selectedRating, setSelectedRating] = useState<
    'helpful' | 'not_helpful' | null
  >(null);
  const submitFeedback = useSubmitFeedback();

  const handleFeedback = async (rating: 'helpful' | 'not_helpful') => {
    setSelectedRating(rating);

    try {
      await submitFeedback.mutateAsync({
        messageId,
        rating,
      });

      onFeedbackSubmitted?.(rating);
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
      setSelectedRating(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback('helpful')}
        disabled={selectedRating !== null}
        className={clsx(
          'rounded-lg p-1.5 transition-colors',
          {
            'bg-green-100 text-green-600': selectedRating === 'helpful',
            'text-gray-400 hover:bg-gray-100 hover:text-green-600':
              selectedRating !== 'helpful',
            'cursor-not-allowed opacity-50': selectedRating !== null,
          }
        )}
        title="Útil"
      >
        <ThumbsUp size={16} />
      </button>

      <button
        onClick={() => handleFeedback('not_helpful')}
        disabled={selectedRating !== null}
        className={clsx(
          'rounded-lg p-1.5 transition-colors',
          {
            'bg-red-100 text-red-600': selectedRating === 'not_helpful',
            'text-gray-400 hover:bg-gray-100 hover:text-red-600':
              selectedRating !== 'not_helpful',
            'cursor-not-allowed opacity-50': selectedRating !== null,
          }
        )}
        title="Não útil"
      >
        <ThumbsDown size={16} />
      </button>

      {selectedRating && (
        <span className="ml-2 text-xs text-gray-500">
          Obrigado pelo feedback!
        </span>
      )}
    </div>
  );
}
