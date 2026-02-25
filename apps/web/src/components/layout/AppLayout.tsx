import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * APP LAYOUT - Layout Principal
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Layout padrão da aplicação com sidebar e header.
 *
 * ESTRUTURA:
 * - Sidebar lateral (colapsável)
 * - Header fixo no topo
 * - Main content com Outlet para rotas
 *
 * USAGE:
 * ```tsx
 * <Route element={<AppLayout />}>
 *   <Route path="/" element={<Dashboard />} />
 * </Route>
 * ```
 */

export function AppLayout() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'flex h-screen w-full overflow-hidden transition-colors duration-300',
        isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      )}
    >
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Sidebar />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <Header />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
