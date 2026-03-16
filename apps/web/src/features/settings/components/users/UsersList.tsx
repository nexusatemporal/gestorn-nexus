import { useState } from 'react';
import { Plus, Search, Mail, Pencil, Trash2, Send } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useUsers, useDeleteUser, useResendEmail } from '../../hooks/useUsers';
import { UserFormModal } from './UserFormModal';
import type { User } from '../../api/settings.api';

const ROLE_BADGE: Record<User['role'], string> = {
  SUPERADMIN: 'bg-red-500/10 text-red-500',
  ADMINISTRATIVO: 'bg-blue-500/10 text-blue-500',
  GESTOR: 'bg-purple-500/10 text-purple-500',
  VENDEDOR: 'bg-green-500/10 text-green-500',
  DESENVOLVEDOR: 'bg-yellow-500/10 text-yellow-500',
};

const ROLE_LABEL: Record<User['role'], string> = {
  SUPERADMIN: 'Super Admin',
  ADMINISTRATIVO: 'Administrativo',
  GESTOR: 'Gestor',
  VENDEDOR: 'Vendedor',
  DESENVOLVEDOR: 'Desenvolvedor',
};

export function UsersList() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data: users, isLoading } = useUsers();
  const deleteMutation = useDeleteUser();
  const resendEmailMutation = useResendEmail();

  const filtered = users?.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditUser(null);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setModalOpen(true);
  };

  const handleDelete = (user: User) => {
    if (confirm(`Excluir permanentemente o usuário "${user.name}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleResendEmail = (user: User) => {
    if (confirm(`Atenção: isso vai gerar uma nova senha e invalidar a senha atual de "${user.name}". Deseja continuar?`)) {
      resendEmailMutation.mutate(user.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className={cn('absolute left-3 top-1/2 -translate-y-1/2', isDark ? 'text-zinc-400' : 'text-zinc-500')}
          />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-9 pr-4 py-2 rounded-lg border text-sm transition-colors outline-none focus:ring-2 focus:ring-nexus-orange/30',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-nexus-orange'
                : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-nexus-orange'
            )}
          />
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg transition-colors font-medium text-sm shadow-md shadow-nexus-orange/20 shrink-0"
        >
          <Plus size={16} />
          Adicionar Usuário
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className={cn('text-center py-12 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
          Carregando usuários...
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <table className="w-full text-sm">
            <thead className={cn(isDark ? 'bg-zinc-800/80' : 'bg-zinc-50')}>
              <tr>
                <th className={cn('px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  Usuário
                </th>
                <th className={cn('px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  Perfil
                </th>
                <th className={cn('px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', isDark ? 'divide-zinc-800' : 'divide-zinc-100')}>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className={cn('transition-colors', isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50')}
                >
                  {/* Usuário */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                        isDark ? 'bg-nexus-orange/20 text-nexus-orange' : 'bg-nexus-orange/10 text-nexus-orange'
                      )}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                          {user.name}
                        </div>
                        <div className={cn('text-xs flex items-center gap-1 mt-0.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                          <Mail size={11} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Perfil */}
                  <td className="px-5 py-4">
                    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', ROLE_BADGE[user.role])}>
                      {ROLE_LABEL[user.role]}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* Reenviar Email */}
                      <button
                        onClick={() => handleResendEmail(user)}
                        disabled={resendEmailMutation.isPending}
                        title="Reenviar email de boas-vindas"
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50',
                          isDark
                            ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'
                            : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600'
                        )}
                      >
                        <Send size={12} /> Email
                      </button>

                      {/* Editar */}
                      <button
                        onClick={() => openEdit(user)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          isDark
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        )}
                      >
                        <Pencil size={12} /> Editar
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn('text-center py-12 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
          {search ? 'Nenhum usuário encontrado para essa busca' : 'Nenhum usuário cadastrado'}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <UserFormModal
          editUser={editUser}
          onClose={() => {
            setModalOpen(false);
            setEditUser(null);
          }}
        />
      )}
    </div>
  );
}
