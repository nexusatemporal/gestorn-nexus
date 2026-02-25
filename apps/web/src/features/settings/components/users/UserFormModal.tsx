import { useState } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useCreateUser, useUsers } from '../../hooks/useUsers';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * USER FORM MODAL - Modal para criar usuário
 * ══════════════════════════════════════════════════════════════════════════
 */

interface UserFormModalProps {
  onClose: () => void;
}

export function UserFormModal({ onClose }: UserFormModalProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const { data: users } = useUsers();
  const createMutation = useCreateUser();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'VENDEDOR' as const,
    gestorId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createMutation.mutateAsync({
      name: formData.name,
      email: formData.email,
      password: formData.password || undefined,
      phone: formData.phone || undefined,
      role: formData.role,
      gestorId: formData.gestorId || undefined,
    });

    onClose();
  };

  const gestores = users?.filter((u: { role: string }) => u.role === 'GESTOR') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className={cn(
          'w-full max-w-md rounded-2xl shadow-2xl',
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            Adicionar Usuário
          </h2>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(
                'w-full px-4 py-2 rounded-lg border transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white focus:border-nexus-orange'
                  : 'bg-white border-zinc-300 text-zinc-900 focus:border-nexus-orange'
              )}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={cn(
                'w-full px-4 py-2 rounded-lg border transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white focus:border-nexus-orange'
                  : 'bg-white border-zinc-300 text-zinc-900 focus:border-nexus-orange'
              )}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              Senha
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={cn(
                'w-full px-4 py-2 rounded-lg border transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white focus:border-nexus-orange'
                  : 'bg-white border-zinc-300 text-zinc-900 focus:border-nexus-orange'
              )}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              Telefone
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={cn(
                'w-full px-4 py-2 rounded-lg border transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white focus:border-nexus-orange'
                  : 'bg-white border-zinc-300 text-zinc-900 focus:border-nexus-orange'
              )}
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              Perfil *
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className={cn(
                'w-full px-4 py-2 rounded-lg border transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white focus:border-nexus-orange'
                  : 'bg-white border-zinc-300 text-zinc-900 focus:border-nexus-orange'
              )}
            >
              <option value="VENDEDOR">Vendedor</option>
              <option value="GESTOR">Gestor</option>
              <option value="ADMINISTRATIVO">Administrativo</option>
              <option value="DESENVOLVEDOR">Desenvolvedor</option>
              <option value="SUPERADMIN">Super Admin</option>
            </select>
          </div>

          {formData.role === 'VENDEDOR' && gestores.length > 0 && (
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                Gestor
              </label>
              <select
                value={formData.gestorId}
                onChange={(e) => setFormData({ ...formData, gestorId: e.target.value })}
                className={cn(
                  'w-full px-4 py-2 rounded-lg border transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white focus:border-nexus-orange'
                    : 'bg-white border-zinc-300 text-zinc-900 focus:border-nexus-orange'
                )}
              >
                <option value="">Nenhum</option>
                {gestores.map((gestor: { id: string; name: string }) => (
                  <option key={gestor.id} value={gestor.id}>
                    {gestor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
              )}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-md shadow-nexus-orange/20"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
