import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';

export function Login() {
  const { login } = useAuth();
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || 'Email ou senha incorretos';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center relative overflow-hidden',
        isDark ? 'bg-zinc-950' : 'bg-zinc-50'
      )}
    >
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-nexus-orange rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-nexus-orangeDark rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-nexus-orange rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-md space-y-8 px-4 relative z-10">
        {/* Logo e Titulo */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-nexus-orange rounded-2xl flex items-center justify-center font-bold text-white text-4xl shadow-2xl shadow-nexus-orange/30">
              N
            </div>
          </div>
          <div>
            <h1 className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              Gestor<span className="text-nexus-orange">Nexus</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Sistema de Gestao Comercial</p>
            <p className="text-xs text-zinc-600">Nexus Atemporal</p>
          </div>
        </div>

        {/* Form */}
        <div
          className={cn(
            'rounded-2xl shadow-2xl p-8 border',
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
          )}
        >
          <h2 className={cn('text-xl font-semibold mb-6', isDark ? 'text-white' : 'text-zinc-900')}>
            Entrar na sua conta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className={cn('block text-sm font-medium mb-1.5', isDark ? 'text-zinc-300' : 'text-zinc-700')}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={cn(
                  'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-nexus-orange/40',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                )}
              />
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="password"
                className={cn('block text-sm font-medium mb-1.5', isDark ? 'text-zinc-300' : 'text-zinc-700')}
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className={cn(
                    'w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-nexus-orange/40',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-nexus-orange hover:bg-nexus-orangeDark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-nexus-orange/20"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500">
          Gestor Nexus v2.54.0 -- Nexus Atemporal
        </p>
      </div>
    </div>
  );
}
