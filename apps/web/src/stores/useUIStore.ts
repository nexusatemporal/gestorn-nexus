import { create } from 'zustand';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * UI STORE - Zustand
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Gerencia estado global da UI.
 *
 * FEATURES:
 * - Sidebar collapsed/expanded
 * - Theme (light/dark)
 * - Modal states
 * - Loading states globais
 *
 * USAGE:
 * ```tsx
 * const { sidebarCollapsed, toggleSidebar } = useUIStore();
 * ```
 */

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Global loading
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

// Initialize theme from localStorage or default to dark
const getInitialTheme = (): 'light' | 'dark' => {
  const saved = localStorage.getItem('nexus-theme');
  return (saved as 'light' | 'dark') || 'dark'; // Dark mode por padrão
};

// Apply theme class to document
const applyTheme = (theme: 'light' | 'dark') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('nexus-theme', theme);
};

// Initialize theme on load
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useUIStore = create<UIState>((set) => ({
  // ──────────────────────────────────────────────────────────────────────
  // Sidebar
  // ──────────────────────────────────────────────────────────────────────
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
  setSidebarCollapsed: (collapsed) =>
    set({
      sidebarCollapsed: collapsed,
    }),

  // ──────────────────────────────────────────────────────────────────────
  // Theme
  // ──────────────────────────────────────────────────────────────────────
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      return { theme: newTheme };
    }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  // ──────────────────────────────────────────────────────────────────────
  // Global Loading
  // ──────────────────────────────────────────────────────────────────────
  isGlobalLoading: false,
  setGlobalLoading: (loading) =>
    set({
      isGlobalLoading: loading,
    }),
}));
