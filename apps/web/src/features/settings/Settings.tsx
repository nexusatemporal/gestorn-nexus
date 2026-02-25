import { useState } from 'react';
import { Users, Shield } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { UsersList } from './components/users/UsersList';

type SettingsTab = 'users' | 'rbac';

export function Settings() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  const tabs = [
    { id: 'users' as SettingsTab, label: 'Usuários', icon: Users, available: true },
    { id: 'rbac' as SettingsTab, label: 'Permissões', icon: Shield, available: false },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className={cn(
          'border-b px-6 py-4',
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
        )}
      >
        <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
          Configurações
        </h1>
        <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
          Gerencie usuários, permissões e configurações do sistema
        </p>
      </div>

      {/* Tabs */}
      <div
        className={cn(
          'border-b px-6',
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
        )}
      >
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => tab.available && setActiveTab(tab.id)}
                disabled={!tab.available}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium',
                  isActive
                    ? 'border-nexus-orange text-nexus-orange'
                    : isDark
                    ? 'border-transparent text-zinc-400 hover:text-zinc-100'
                    : 'border-transparent text-zinc-600 hover:text-nexus-orange',
                  !tab.available && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon size={18} />
                {tab.label}
                {!tab.available && (
                  <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                    Em breve
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'users' && <UsersList />}
      </div>
    </div>
  );
}
