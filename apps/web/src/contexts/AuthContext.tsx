import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setTokenGetter } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: storedUser, setUser, clearUser } = useAuthStore();
  const accessTokenRef = useRef<string | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshing = useRef(false);

  // Getter estável — sempre lê do ref, sem stale closure
  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  // Setter unificado: atualiza ref (síncrono) + state (para re-render)
  const setAccessToken = (token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  };

  // Registrar token getter UMA VEZ no mount — ref garante valor sempre atual
  useEffect(() => {
    setTokenGetter(getAccessToken);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tentar restaurar sessao no boot via refresh token (cookie ou localStorage)
  useEffect(() => {
    const refreshToken = localStorage.getItem('gmnexus-refresh-token');
    if (refreshToken && storedUser) {
      // Tentar renovar o access token
      api.post('/auth/refresh', { refreshToken })
        .then((res) => {
          setAccessToken(res.data.accessToken);
        })
        .catch(() => {
          // Refresh falhou - limpar sessao
          clearUser();
          localStorage.removeItem('gmnexus-refresh-token');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken: token, refreshToken, user } = res.data;

    setAccessToken(token);
    setUser(user);
    localStorage.setItem('gmnexus-refresh-token', refreshToken);
  };

  const logout = async () => {
    try {
      if (accessToken) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch {
      // Ignora erro no logout
    } finally {
      setAccessToken(null);
      clearUser();
      localStorage.removeItem('gmnexus-refresh-token');
    }
  };

  // Interceptor de refresh automatico
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isRefreshing.current
        ) {
          originalRequest._retry = true;
          isRefreshing.current = true;

          const refreshToken = localStorage.getItem('gmnexus-refresh-token');
          if (refreshToken) {
            try {
              const res = await api.post('/auth/refresh', { refreshToken });
              const newToken = res.data.accessToken;
              setAccessToken(newToken);
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              isRefreshing.current = false;
              return api(originalRequest);
            } catch {
              // Refresh falhou - fazer logout
              setAccessToken(null);
              clearUser();
              localStorage.removeItem('gmnexus-refresh-token');
              isRefreshing.current = false;
            }
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [clearUser]);

  const value: AuthContextType = {
    user: storedUser,
    isAuthenticated: !!accessToken && !!storedUser,
    isLoading,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
