import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useState, useEffect } from 'react';

interface SearchResult {
  type: 'lead' | 'client' | 'event';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResponse {
  leads: SearchResult[];
  clients: SearchResult[];
  events: SearchResult[];
}

export function useGlobalSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<SearchResponse>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      const { data } = await api.get('/search', {
        params: { q: debouncedQuery },
      });
      return data;
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
