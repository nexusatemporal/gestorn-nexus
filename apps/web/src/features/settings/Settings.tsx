import { useState } from 'react';
import { Users, Shield, Package, Tags, ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { UsersList } from './components/users/UsersList';
import { PlansTab } from './components/plans/PlansTab';
import { StatusTab } from './components/status/StatusTab';

type SettingsTab = 'users' | 'rbac' | 'plans' | 'status';

export function Settings() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const tabs = [
    { id: 'users' as SettingsTab, label: 'Usuários', icon: Users, available: true },
    { id: 'plans' as SettingsTab, label: 'Planos', icon: Package, available: true },
    { id: 'status' as SettingsTab, label: 'Status', icon: Tags, available: true },
    { id: 'rbac' as SettingsTab, label: 'Permissões', icon: Shield, available: false },
  ];

  const activeItem = tabs.find(t => t.id === activeTab) || tabs[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className={cn(
          'border-b px-4 py-3 md:px-6 md:py-4',
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
            <SettingsIcon size={20} className="text-nexus-orange" />
          </div>
          <div>
            <h1 className={cn('text-xl md:text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              Configurações
            </h1>
            <p className={cn('text-xs md:text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
              Usuários, planos e sistema
            </p>
          </div>
        </div>
      </div>

      {/* Tabs — Mobile Custom Dropdown */}
      <div className={cn('px-4 py-3 border-b md:hidden relative', isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white')}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all',
            isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800 shadow-sm'
          )}
        >
          <span className="flex items-center gap-2">
            <ActiveIcon size={16} className="text-nexus-orange" />
            {activeItem.label}
          </span>
          <ChevronDown size={16} className={cn('transition-transform', dropdownOpen && 'rotate-180', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
        </button>
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className={cn(
              'absolute left-4 right-4 top-[calc(100%-4px)] z-20 rounded-xl border shadow-xl overflow-hidden',
              isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
            )}>
              {tabs.filter(t => t.available).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setDropdownOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                      activeTab === tab.id
                        ? 'text-nexus-orange bg-nexus-orange/5'
                        : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-50'
                    )}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Tabs — Desktop */}
      <div
        className={cn(
          'border-b px-6 hidden md:block',
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
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'status' && <StatusTab />}
      </div>
    </div>
  );
}
