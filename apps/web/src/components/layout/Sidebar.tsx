import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  DollarSign,
  Calendar as CalendarIcon,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Truck,
  Bell,
  ClipboardList,
  MessageCircle,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * SIDEBAR - Navegação Lateral
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Sidebar com navegação principal da aplicação.
 *
 * FEATURES:
 * - Colapsável (icon only mode)
 * - Links com NavLink para active state
 * - Ícones Lucide React
 * - Logo Nexus laranja
 * - Dark mode support
 */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Leads', href: '/leads', icon: TrendingUp },
  { label: 'Vendas IA', href: '/sales-ai', icon: Sparkles },
  { label: 'Clientes One Nexus', href: '/clients', icon: Users },
  { label: 'Clientes Nexloc', href: '/clients-locadoras', icon: Truck },
  { label: 'Calendário', href: '/calendar', icon: CalendarIcon },
  { label: 'Financeiro', href: '/finance', icon: DollarSign },
  { label: 'Formulários', href: '/forms', icon: ClipboardList },
  { label: 'Chat', href: '/chat', icon: MessageCircle },
  { label: 'Notificações', href: '/notifications', icon: Bell },
  { label: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, theme } = useUIStore();
  const isDark = theme === 'dark';

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-full transition-all duration-300 ease-in-out z-30 border-r',
        sidebarCollapsed ? 'w-20' : 'w-64',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HEADER - Logo e Toggle */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'px-4 flex items-center justify-center border-b h-20',
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        )}
      >
        {!sidebarCollapsed && (
          <img
            src={isDark ? '/logos/logo-dark.png' : '/logos/logo-light.png'}
            alt="Nexus Atemporal"
            className="h-10 w-auto object-contain"
          />
        )}
        {sidebarCollapsed && (
          <img
            src={isDark ? '/logos/icon-dark.png' : '/logos/icon-light.png'}
            alt="Nexus Atemporal"
            className="h-10 w-10 object-contain mx-auto"
          />
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* NAVIGATION */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group',
                  isActive
                    ? 'bg-nexus-orange text-white shadow-md shadow-nexus-orange/10'
                    : isDark
                    ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                    : 'hover:bg-zinc-100 text-zinc-500 hover:text-nexus-orange'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    className={
                      isActive
                        ? 'text-white'
                        : 'text-zinc-400 group-hover:text-nexus-orange'
                    }
                  />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* FOOTER - Profile Badge e Toggle */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          'p-4 border-t',
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        )}
      >
        {!sidebarCollapsed && (
          <div
            className={cn(
              'mb-4 flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold',
              isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
            )}
          >
            <ShieldAlert size={12} className="text-nexus-orange" /> PERFIL:
            SUPERADMIN
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
            isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
          )}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  );
}
