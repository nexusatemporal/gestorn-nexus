import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useCreateUser, useUpdateUser, useUsers } from '../../hooks/useUsers';
import type { User } from '../../api/settings.api';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * USER FORM MODAL - Criar ou Editar usuário
 * ══════════════════════════════════════════════════════════════════════════
 */

interface UserFormModalProps {
  onClose: () => void;
  editUser?: User | null;
}

export function UserFormModal({ onClose, editUser }: UserFormModalProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const isEditing = !!editUser;

  const { data: users } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'VENDEDOR' as User['role'],
    gestorId: '',
  });

  // Preenche o form ao editar
  useEffect(() => {
    if (editUser) {
      setFormData({
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        gestorId: editUser.gestorId || '',
      });
    }
  }, [editUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && editUser) {
      await updateMutation.mutateAsync({
        id: editUser.id,
        data: {
          name: formData.name,
          role: formData.role,
          gestorId: formData.gestorId || undefined,
        },
      });
    } else {
      await createMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        gestorId: formData.gestorId || undefined,
      });
    }

    onClose();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const gestores = users?.filter((u) => u.role === 'GESTOR') || [];

  const inputClass = cn(
    'w-full px-4 py-2.5 rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-nexus-orange/30',
    isDark
      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-nexus-orange'
      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-nexus-orange'
  );

  const labelClass = cn(
    'block text-sm font-medium mb-1.5',
    isDark ? 'text-zinc-300' : 'text-zinc-700'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          'w-full max-w-md rounded-2xl shadow-2xl',
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between p-6 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <h2 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {isEditing ? 'Editar Usuário' : 'Adicionar Usuário'}
          </h2>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass}>Nome Completo *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              placeholder="Ex: João Silva"
            />
          </div>

          <div>
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              disabled={isEditing}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={cn(inputClass, isEditing && 'opacity-50 cursor-not-allowed')}
              placeholder="email@nexusatemporal.com.br"
            />
            {isEditing ? (
              <p className="text-xs text-zinc-500 mt-1">Email não pode ser alterado</p>
            ) : (
              <p className="text-xs text-emerald-500 mt-1">
                Uma senha segura será gerada e enviada por email ao usuário
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Perfil de Acesso *</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
              className={inputClass}
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
              <label className={labelClass}>Gestor Responsável</label>
              <select
                value={formData.gestorId}
                onChange={(e) => setFormData({ ...formData, gestorId: e.target.value })}
                className={inputClass}
              >
                <option value="">Nenhum</option>
                {gestores.map((gestor) => (
                  <option key={gestor.id} value={gestor.id}>
                    {gestor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
              )}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-md shadow-nexus-orange/20"
            >
              {isPending
                ? isEditing ? 'Salvando...' : 'Criando...'
                : isEditing ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
