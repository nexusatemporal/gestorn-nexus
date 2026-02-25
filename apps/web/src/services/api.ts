import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * API CLIENT - Axios Instance
 * v2.54.0: Auth proprio JWT (sem Clerk)
 */

// ──────────────────────────────────────────────────────────────────────────
// Token Getter (setado pelo AuthContext)
// ──────────────────────────────────────────────────────────────────────────

let getTokenFunction: (() => string | null) | null = null;

export function setTokenGetter(fn: () => string | null) {
  getTokenFunction = fn;
}

// ──────────────────────────────────────────────────────────────────────────
// Axios Instance
// ──────────────────────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Request Interceptor
// ──────────────────────────────────────────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (getTokenFunction) {
      const token = getTokenFunction();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Response Interceptor
// ──────────────────────────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => {
    // Log de sucesso (apenas dev)
    if (import.meta.env.DEV) {
      console.log('API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  (error: AxiosError) => {
    // Log de erro
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });

    // Tratar erros especificos
    if (error.response?.status === 401) {
      console.warn('Unauthorized - redirect to login');
    }

    return Promise.reject(error);
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Extrai mensagem de erro da resposta da API
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string })?.message;
    return message || error.message || 'Erro desconhecido';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro desconhecido';
}

// ──────────────────────────────────────────────────────────────────────────
// Dashboard API Methods (v2.48.0)
// ──────────────────────────────────────────────────────────────────────────

/**
 * v2.48.0: Busca leads paginados para expansao do card
 */
export async function fetchPaginatedLeads(page: number, limit: number) {
  const response = await api.get('/dashboard/leads/paginated', {
    params: { page, limit },
  });
  return response.data;
}

/**
 * v2.48.0: Busca clientes paginados para expansao do card
 */
export async function fetchPaginatedClients(page: number, limit: number) {
  const response = await api.get('/dashboard/clients/paginated', {
    params: { page, limit },
  });
  return response.data;
}

/**
 * v2.48.0: Busca proximos vencimentos paginados para expansao do card
 */
export async function fetchPaginatedPayments(page: number, limit: number) {
  const response = await api.get('/dashboard/payments/paginated', {
    params: { page, limit },
  });
  return response.data;
}

