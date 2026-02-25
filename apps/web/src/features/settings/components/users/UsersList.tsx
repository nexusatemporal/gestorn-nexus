import { useState } from 'react';
import { Plus, Search, UserCheck, UserX, Mail, Phone } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useUsers, useDeactivateUser, useRestoreUser } from '../../hooks/useUsers';
import { UserFormModal } from './UserFormModal';
import type { User } from '../../api/settings.api';

export function UsersList() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: users, isLoading } = useUsers();
  const deactivateMutation = useDeactivateUser();
  const restoreMutation = useRestoreUser();

  const filteredUsers = users?.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeactivate = (user: User) => {
    if (confirm(`Desativar usuário ${user.name}?`)) {
      deactivateMutation.mutate(user.id);
    }
  };

  const handleRestore = (user: User) => {
    restoreMutation.mutate(user.id);
  };

  const getRoleBadgeColor = (role: User['role']) => {
    const colors = {
      SUPERADMIN: 'bg-red-500/10 text-red-500',
      ADMINISTRATIVO: 'bg-blue-500/10 text-blue-500',
      GESTOR: 'bg-purple-500/10 text-purple-500',
      VENDEDOR: 'bg-green-500/10 text-green-500',
      DESENVOLVEDOR: 'bg-yellow-500/10 text-yellow-500',
    };
    return colors[role] || 'bg-zinc-500/10 text-zinc-500';
  };

  const getRoleLabel = (role: User['role']) => {
    const labels = {
      SUPERADMIN: 'Super Admin',
      ADMINISTRATIVO: 'Administrativo',
      GESTOR: 'Gestor',
      VENDEDOR: 'Vendedor',
      DESENVOLVEDOR: 'Desenvolvedor',
    };
    return labels[role] || role;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2',
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            )}
          />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg border transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-nexus-orange'
                : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-nexus-orange'
            )}
          />
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg transition-colors font-medium shadow-md shadow-nexus-orange/20"
        >
          <Plus size={18} />
          Adicionar Usuário
        </button>
      </div>

      {isLoading ? (
        <div className={cn('text-center py-12', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
          Carregando usuários...
        </div>
      ) : filteredUsers && filteredUsers.length > 0 ? (
        <div
          className={cn(
            'rounded-lg border overflow-hidden',
            isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
          )}
        >
          <table className="w-full">
            <thead className={cn(isDark ? 'bg-zinc-800' : 'bg-zinc-50')}>
              <tr>
                <th className={cn('px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  Usuário
                </th>
                <th className={cn('px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  Perfil
                </th>
                <th className={cn('px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  Status
                </th>
                <th className={cn('px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-200')}>
              {filteredUsers.map((user) => (
                <tr key={user.id} className={cn(isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50', 'transition-colors')}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-semibold', isDark ? 'bg-zinc-800 text-nexus-orange' : 'bg-nexus-orange/10 text-nexus-orange')}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                          {user.name}
                        </div>
                        <div className={cn('text-sm flex items-center gap-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                          <Mail size={14} />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className={cn('text-sm flex items-center gap-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                            <Phone size={14} />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-medium', getRoleBadgeColor(user.role))}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                        <UserCheck size={14} />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                        <UserX size={14} />
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.isActive ? (
                      <button
                        onClick={() => handleDeactivate(user)}
                        disabled={deactivateMutation.isPending}
                        className="text-sm text-red-500 hover:text-red-400 font-medium transition-colors disabled:opacity-50"
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestore(user)}
                        disabled={restoreMutation.isPending}
                        className="text-sm text-green-500 hover:text-green-400 font-medium transition-colors disabled:opacity-50"
                      >
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn('text-center py-12', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
          Nenhum usuário encontrado
        </div>
      )}

      {showModal && <UserFormModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
