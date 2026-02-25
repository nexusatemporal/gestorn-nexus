/**
 * ✅ v2.48.0: Hook para gerenciar estado de expansão de cards
 */
import { useState } from 'react';

export function useExpand(initialState = false) {
  const [isExpanded, setIsExpanded] = useState(initialState);

  const toggle = () => setIsExpanded((prev) => !prev);
  const expand = () => setIsExpanded(true);
  const collapse = () => setIsExpanded(false);

  return {
    isExpanded,
    toggle,
    expand,
    collapse,
  };
}
