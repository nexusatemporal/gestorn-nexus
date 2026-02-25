/**
 * ✅ v2.48.0: Controles de paginação reutilizáveis
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  isDark: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  isDark,
}: PaginationControlsProps) {
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-700/50">
      <button
        onClick={onPrevPage}
        disabled={isFirstPage}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isFirstPage
            ? 'opacity-50 cursor-not-allowed'
            : isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
              : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
        }`}
      >
        <ChevronLeft size={16} />
        Anterior
      </button>

      <span
        className={`text-sm font-medium ${
          isDark ? 'text-zinc-400' : 'text-zinc-600'
        }`}
      >
        Página {currentPage} de {totalPages}
      </span>

      <button
        onClick={onNextPage}
        disabled={isLastPage}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isLastPage
            ? 'opacity-50 cursor-not-allowed'
            : isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
              : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
        }`}
      >
        Próximo
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
