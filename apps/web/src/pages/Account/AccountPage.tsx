import { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';
import { useMe, useUpdateProfile, useChangePassword } from '@/features/settings/hooks/useUsers';

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMINISTRATIVO: 'Administrativo',
  GESTOR: 'Gestor',
  VENDEDOR: 'Vendedor',
  DESENVOLVEDOR: 'Desenvolvedor',
};

/** Validação client-side da senha (espelha o backend) */
function validatePassword(password: string, userName: string, userEmail: string) {
  const rules = [
    { key: 'length', label: 'Mínimo 8 caracteres', test: password.length >= 8 },
    { key: 'upper', label: 'Letra maiúscula', test: /[A-Z]/.test(password) },
    { key: 'lower', label: 'Letra minúscula', test: /[a-z]/.test(password) },
    { key: 'number', label: 'Número', test: /[0-9]/.test(password) },
    { key: 'special', label: 'Caractere especial (!@#$%...)', test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ];

  // Não pode conter nome
  const nameParts = userName.toLowerCase().split(/\s+/);
  const passLower = password.toLowerCase();
  const nameConflict = nameParts.some((p) => p.length >= 3 && passLower.includes(p));
  rules.push({ key: 'name', label: 'Não conter seu nome', test: !nameConflict });

  // Não pode conter email
  const emailLocal = userEmail.split('@')[0].toLowerCase();
  const emailConflict = emailLocal.length >= 3 && passLower.includes(emailLocal);
  rules.push({ key: 'email', label: 'Não conter seu email', test: !emailConflict });

  return rules;
}

export function AccountPage() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const { data: me, isLoading } = useMe();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name);
      setPhone(me.phone || '');
    }
  }, [me]);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfileMutation.mutate({ name: name.trim(), phone: phone.trim() || undefined });
  };

  const passwordRules = validatePassword(newPassword, me?.name || '', me?.email || '');
  const allRulesPass = newPassword.length > 0 && passwordRules.every((r) => r.test);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !allRulesPass || !passwordsMatch || !me) return;

    changePasswordMutation.mutate(
      { id: me.id, currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      },
    );
  };

  const initials = me?.name
    ? me.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-20', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
        Carregando...
      </div>
    );
  }

  const cardClass = cn(
    'rounded-xl border p-4 md:p-6',
    isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200',
  );

  const inputClass = cn(
    'w-full px-4 py-2.5 rounded-lg border text-sm transition-colors outline-none focus:ring-2 focus:ring-nexus-orange/30',
    isDark
      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-nexus-orange'
      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-nexus-orange',
  );

  const labelClass = cn('block text-sm font-medium mb-1.5', isDark ? 'text-zinc-300' : 'text-zinc-700');

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-nexus-orange flex items-center justify-center text-white text-lg md:text-xl font-bold">
          {initials}
        </div>
        <div>
          <h1 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            Minha Conta
          </h1>
          <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            {me?.email} &middot; {ROLE_LABEL[me?.role || ''] || me?.role}
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-5">
          <UserIcon size={18} className="text-nexus-orange" />
          <h2 className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            Dados Pessoais
          </h2>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Seu nome completo"
              required
            />
          </div>

          <div>
            <label className={labelClass}>Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={me?.email || ''}
              disabled
              className={cn(inputClass, 'opacity-50 cursor-not-allowed')}
            />
            <p className={cn('text-xs mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              O email não pode ser alterado.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending || !name.trim()}
              className="px-5 py-2.5 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Section */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-5">
          <Lock size={18} className="text-nexus-orange" />
          <h2 className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            Alterar Senha
          </h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Senha Atual */}
          <div>
            <label className={labelClass}>Senha Atual</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Digite sua senha atual"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className={cn('absolute right-3 top-1/2 -translate-y-1/2', isDark ? 'text-zinc-500' : 'text-zinc-400')}
              >
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nova Senha */}
          <div>
            <label className={labelClass}>Nova Senha</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Digite a nova senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className={cn('absolute right-3 top-1/2 -translate-y-1/2', isDark ? 'text-zinc-500' : 'text-zinc-400')}
              >
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password Rules */}
            {newPassword.length > 0 && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {passwordRules.map((rule) => (
                  <div key={rule.key} className="flex items-center gap-1.5 text-xs">
                    {rule.test ? (
                      <Check size={12} className="text-green-500 shrink-0" />
                    ) : (
                      <X size={12} className="text-red-500 shrink-0" />
                    )}
                    <span className={rule.test ? 'text-green-500' : isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirmar Senha */}
          <div>
            <label className={labelClass}>Confirmar Nova Senha</label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Repita a nova senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className={cn('absolute right-3 top-1/2 -translate-y-1/2', isDark ? 'text-zinc-500' : 'text-zinc-400')}
              >
                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> As senhas não coincidem
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending || !currentPassword || !allRulesPass || !passwordsMatch}
              className="px-5 py-2.5 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
