import { useState } from 'react';
import { Search, Sun, Moon, Bell, LogOut, User as UserIcon } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

export function Header() {
  const { theme, toggleTheme } = useUIStore();
  const { user, logout } = useAuth();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <header
      className={cn(
        'h-20 border-b backdrop-blur-md flex items-center justify-between px-8 z-20 transition-colors duration-300',
        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/80 border-zinc-200'
      )}
    >
      {/* LEFT - Search Bar */}
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Buscar clientes, leads, pagamentos..."
            className={cn(
              'w-full rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-nexus-orange transition-all border-none outline-none',
              isDark ? 'bg-zinc-800 text-zinc-100 placeholder:text-zinc-600' : 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400'
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* RIGHT - Controls & User */}
      <div className="flex items-center gap-4">
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

        {/* Notifications */}
        <div className="relative">
          <button className={cn('p-2 rounded-full relative transition-colors', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}>
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-nexus-orange rounded-full border-2 border-zinc-900 dark:border-zinc-900"></span>
          </button>
        </div>

        {/* Divider */}
        <div className={cn('h-8 w-[1px] mx-2', isDark ? 'bg-zinc-800' : 'bg-zinc-200')} />

        {/* User Menu */}
        <div className="relative flex items-center gap-3 pl-2">
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
                  onClick={() => setShowUserMenu(false)}
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
  );
}
