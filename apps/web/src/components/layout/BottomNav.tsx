import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  DollarSign,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Sparkles,
  ClipboardList,
  MessageCircle,
  Bell,
  Settings,
  User as UserIcon,
  LogOut,
  X,
  Truck,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const MAIN_NAV: BottomNavItem[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Leads', href: '/leads', icon: TrendingUp },
  { label: 'Clientes', href: '/clients', icon: Users },
  { label: 'Financeiro', href: '/finance', icon: DollarSign },
];

const MORE_NAV: BottomNavItem[] = [
  { label: 'Clientes Nexloc', href: '/clients-locadoras', icon: Truck },
  { label: 'Calendário', href: '/calendar', icon: CalendarIcon },
  { label: 'Vendas IA', href: '/sales-ai', icon: Sparkles },
  { label: 'Formulários', href: '/forms', icon: ClipboardList },
  { label: 'Chat', href: '/chat', icon: MessageCircle },
  { label: 'Notificações', href: '/notifications', icon: Bell },
  { label: 'Configurações', href: '/settings', icon: Settings },
  { label: 'Meu Perfil', href: '/account', icon: UserIcon },
];

export function BottomNav() {
  const [showMore, setShowMore] = useState(false);
  const { theme } = useUIStore();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'dark';

  const isMoreActive = MORE_NAV.some((item) => location.pathname === item.href || location.pathname.startsWith(item.href + '/'));

  const handleMoreNav = (href: string) => {
    setShowMore(false);
    navigate(href);
  };

  const handleLogout = async () => {
    setShowMore(false);
    await logout();
  };

  return (
    <>
      {/* Bottom Sheet Overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 animate-fade-in" />

          {/* Sheet */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 rounded-t-2xl pb-20 animate-slide-up',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className={cn('w-10 h-1 rounded-full', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
            </div>

            {/* Header */}
            <div className={cn('flex items-center justify-between px-5 pb-3 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
              <span className={cn('text-base font-semibold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>Menu</span>
              <button
                onClick={() => setShowMore(false)}
                className={cn('p-2 rounded-full', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav Items */}
            <nav className="px-3 py-2 space-y-0.5">
              {MORE_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                return (
                  <button
                    key={item.href}
                    onClick={() => handleMoreNav(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-nexus-orange/10 text-nexus-orange'
                        : isDark
                        ? 'text-zinc-300 hover:bg-zinc-800'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    )}
                  >
                    <Icon size={20} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Divider */}
            <div className={cn('mx-5 my-2 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')} />

            {/* Logout */}
            <div className="px-3 space-y-0.5">
              <button
                onClick={handleLogout}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 transition-colors',
                  isDark ? 'hover:bg-zinc-800' : 'hover:bg-red-50'
                )}
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-30 md:hidden border-t',
          'pb-[env(safe-area-inset-bottom)]',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center justify-around h-16">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 w-full h-full text-[10px] font-medium transition-colors',
                    isActive
                      ? 'text-nexus-orange'
                      : isDark
                      ? 'text-zinc-500 active:text-zinc-300'
                      : 'text-zinc-400 active:text-zinc-600'
                  )
                }
              >
                <Icon size={22} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 w-full h-full text-[10px] font-medium transition-colors',
              isMoreActive || showMore
                ? 'text-nexus-orange'
                : isDark
                ? 'text-zinc-500 active:text-zinc-300'
                : 'text-zinc-400 active:text-zinc-600'
            )}
          >
            <MoreHorizontal size={22} />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
