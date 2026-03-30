import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Bell, LogOut, User as UserIcon } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import { NotificationPanel } from '@/features/notifications/components/NotificationPanel';
import { useUnreadCount, useNotificationStream } from '@/features/notifications/hooks/useNotifications';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SearchDropdown } from './SearchDropdown';

export function Header() {
  const { theme, toggleTheme } = useUIStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { data: searchData, isLoading: searchLoading } = useGlobalSearch(searchQuery);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.count ?? 0;
  useNotificationStream();

  // Close search dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <>
      <header
        className={cn(
          'h-16 md:h-20 border-b flex items-center justify-between px-3 md:px-8 md:relative md:z-20 transition-colors duration-300',
          isDark ? 'bg-zinc-900 border-zinc-800 md:bg-zinc-900/50 md:backdrop-blur-md' : 'bg-white border-zinc-200 md:bg-white/80 md:backdrop-blur-md'
        )}
      >
        {/* LEFT - Logo (mobile) + Search Bar (desktop) */}
        <div className="flex items-center flex-1 max-w-xl">
          {/* Mobile: show full logo with name */}
          <img
            src={isDark ? '/logos/logo-dark.png' : '/logos/logo-light.png'}
            alt="Nexus"
            className="h-8 object-contain md:hidden mr-3 flex-shrink-0"
          />
          {/* Desktop: show search */}
          <div ref={searchRef} className="relative w-full hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Buscar clientes, leads, eventos..."
              className={cn(
                'w-full rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-nexus-orange transition-all border-none outline-none',
                isDark ? 'bg-zinc-800 text-zinc-100 placeholder:text-zinc-600' : 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400'
              )}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowSearch(false); (e.target as HTMLInputElement).blur(); }
              }}
            />
            {showSearch && (
              <SearchDropdown
                data={searchData}
                isLoading={searchLoading}
                query={searchQuery}
                onClose={() => { setShowSearch(false); setSearchQuery(''); }}
              />
            )}
          </div>
        </div>

        {/* RIGHT - Controls & User */}
        <div className="flex items-center gap-1.5 md:gap-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              'p-2 rounded-full transition-colors',
              isDark ? 'hover:bg-zinc-800 text-yellow-400' : 'hover:bg-zinc-100 text-indigo-600'
            )}
            title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
              className={cn('p-2 rounded-full relative transition-colors', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold bg-nexus-orange text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {/* Desktop: panel inside relative parent */}
            <div className="hidden md:block">
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                  <NotificationPanel onClose={() => setShowNotifications(false)} />
                </>
              )}
            </div>
          </div>

          {/* Mobile Profile Avatar */}
          <button
            onClick={() => navigate('/account')}
            className={cn(
              'w-8 h-8 min-w-[32px] shrink-0 rounded-full flex items-center justify-center text-[11px] leading-none font-bold text-white md:hidden',
              'bg-nexus-orange active:scale-95 transition-transform'
            )}
          >
            {initials}
          </button>

          {/* Divider — desktop only */}
          <div className={cn('h-8 w-[1px] mx-2 hidden md:block', isDark ? 'bg-zinc-800' : 'bg-zinc-200')} />

          {/* User Menu — desktop only */}
          <div className="relative items-center gap-3 pl-2 hidden md:flex">
            <div className="text-right hidden sm:block">
              <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{user?.name || 'Usuario'}</p>
              <p className="text-xs text-zinc-500">{user?.role || 'VENDEDOR'}</p>
            </div>

            {/* Avatar Button */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 transition-all',
                isDark ? 'bg-nexus-orange ring-zinc-800 hover:ring-nexus-orange' : 'bg-nexus-orange ring-zinc-200 hover:ring-nexus-orange'
              )}
            >
              {initials}
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                {/* Overlay */}
                <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                {/* Menu */}
                <div className={cn(
                  'absolute right-0 top-12 w-48 rounded-xl border shadow-xl z-40 py-1 overflow-hidden',
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                )}>
                  <div className={cn('px-4 py-3 border-b', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
                    <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-zinc-900')}>{user?.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                  </div>

                  <button
                    onClick={() => { setShowUserMenu(false); navigate('/account'); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-50'
                    )}
                  >
                    <UserIcon size={15} />
                    Meu Perfil
                  </button>

                  <button
                    onClick={handleLogout}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-red-500 hover:text-red-600',
                      isDark ? 'hover:bg-zinc-800' : 'hover:bg-red-50'
                    )}
                  >
                    <LogOut size={15} />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile: Notification panel rendered OUTSIDE header to escape stacking context */}
      <div className="md:hidden">
        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 animate-fade-in" onClick={() => setShowNotifications(false)} />
            <div className={cn(
              'fixed inset-x-0 top-16 bottom-0 z-50 flex flex-col overflow-hidden animate-fade-in',
              isDark ? 'bg-zinc-900' : 'bg-white'
            )}>
              <NotificationPanel onClose={() => setShowNotifications(false)} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
