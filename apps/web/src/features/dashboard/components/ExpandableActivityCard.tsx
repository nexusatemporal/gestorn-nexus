/**
 * ✅ v2.48.0: Card expansível genérico para atividades recentes
 */
import React, { useEffect } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { useExpand } from '../hooks/useExpand';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from './PaginationControls';

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ExpandableActivityCardProps<T> {
  title: string;
  icon: React.ElementType;
  initialItems: T[];
  fetchMore: (page: number, limit: number) => Promise<{ data: T[]; meta: PaginationMeta }>;
  renderItem: (item: T) => React.ReactNode;
  emptyMessage: string;
  viewAllLabel: string;
  isDark: boolean;
}

export function ExpandableActivityCard<T extends { id: string }>({
  title,
  icon: Icon,
  initialItems,
  fetchMore,
  renderItem,
  emptyMessage,
  viewAllLabel,
  isDark,
}: ExpandableActivityCardProps<T>) {
  const { isExpanded, toggle } = useExpand();
  const { page, limit, nextPage, prevPage, reset } = usePagination();

  const [paginatedData, setPaginatedData] = React.useState<T[]>(initialItems);
  const [meta, setMeta] = React.useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch paginated data when expanded
  useEffect(() => {
    if (isExpanded) {
      setIsLoading(true);
      fetchMore(page, limit)
        .then((response) => {
          setPaginatedData(response.data);
          setMeta(response.meta);
        })
        .catch((error) => {
          console.error('Error fetching paginated data:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isExpanded, page, limit, fetchMore]);

  // Reset pagination when collapsing
  const handleToggle = () => {
    if (isExpanded) {
      reset();
    }
    toggle();
  };

  const displayItems = isExpanded ? paginatedData : initialItems;
  const showPagination = isExpanded && meta && meta.totalPages > 1;

  return (
    <div
      className={`border p-6 rounded-2xl transition-all duration-300 ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
            <Icon size={18} className="text-nexus-orange" />
          </div>
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            {title}
          </h3>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-nexus-orange" />
          </div>
        ) : displayItems.length > 0 ? (
          displayItems.map((item) => (
            <div key={item.id}>{renderItem(item)}</div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 text-center py-4">{emptyMessage}</p>
        )}
      </div>

      {/* Pagination Controls */}
      {showPagination && (
        <PaginationControls
          currentPage={meta.page}
          totalPages={meta.totalPages}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          isDark={isDark}
        />
      )}

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className="mt-4 w-full text-nexus-orange text-sm font-semibold hover:underline flex items-center justify-center gap-1 transition-all hover:gap-2"
      >
        {isExpanded ? (
          <>
            Recolher <ChevronDown size={14} />
          </>
        ) : (
          <>
            {viewAllLabel} <ChevronRight size={14} />
          </>
        )}
      </button>
    </div>
  );
}
