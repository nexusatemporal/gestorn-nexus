/**
 * ✅ v2.48.0: Hook para gerenciar lógica de paginação
 */
import { useState } from 'react';

interface UsePaginationProps {
  initialPage?: number;
  initialLimit?: number;
}

export function usePagination({
  initialPage = 1,
  initialLimit = 10
}: UsePaginationProps = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);

  const nextPage = () => setPage((prev) => prev + 1);
  const prevPage = () => setPage((prev) => Math.max(1, prev - 1));
  const goToPage = (pageNumber: number) => setPage(Math.max(1, pageNumber));
  const reset = () => setPage(initialPage);

  return {
    page,
    limit,
    nextPage,
    prevPage,
    goToPage,
    reset,
  };
}
