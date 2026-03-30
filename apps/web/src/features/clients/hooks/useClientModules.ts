import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/services/api';

export interface ImpersonateLog {
  id: string;
  userId: string;
  clientId: string;
  tenantId: string;
  reason: string;
  ipAddress: string;
  userAgent?: string;
  startedAt: string;
  endedAt?: string | null;
  actions?: Record<string, unknown> | null;
  user?: { id: string; name: string };
}

export interface ClientTenant {
  id: string;
  tenantUuid?: string | null;
  provisioningStatus: string;
  enabledModules: string[];
}

export const useClientTenant = (clientId: string) => {
  return useQuery<ClientTenant | null>({
    queryKey: ['tenant', 'client', clientId],
    queryFn: async () => {
      try {
        const { data } = await api.get<ClientTenant>(`/tenants/client/${clientId}`);
        return data;
      } catch {
        return null;
      }
    },
    enabled: !!clientId,
  });
};

// ════════════════════════════════════════════════════════════════
// MÓDULOS V3 — Hierárquicos
// ════════════════════════════════════════════════════════════════

export interface ModuleChild {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isEnabled: boolean;
}

export interface ModuleTree {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isEnabled: boolean;
  children: ModuleChild[];
}

export type ModulePreset = 'all' | 'basic' | 'clinical' | 'business' | 'enterprise' | 'none';

export const useModulesTree = (tenantId: string | undefined, isProvisioned: boolean = false) => {
  return useQuery<ModuleTree[]>({
    queryKey: ['modules-tree', tenantId],
    queryFn: () => api.get(`/tenants/${tenantId}/modules/tree`).then((r) => r.data),
    enabled: !!tenantId && isProvisioned,
    staleTime: 30 * 1000, // 30s — módulos não mudam com frequência
  });
};

export const useToggleModules = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (modules: { moduleId: string; isEnabled: boolean }[]) =>
      api.patch(`/tenants/${tenantId}/modules/toggle`, { modules }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules-tree', tenantId] });
      toast.success('Módulo atualizado com sucesso!');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erro ao atualizar módulo';
      toast.error(msg);
    },
  });
};

export const useEnableAllModules = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch(`/tenants/${tenantId}/modules/enable-all`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules-tree', tenantId] });
      toast.success('Todos os módulos foram habilitados!');
    },
    onError: () => toast.error('Erro ao habilitar todos os módulos'),
  });
};

export const useApplyModulePreset = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preset: ModulePreset) =>
      api.patch(`/tenants/${tenantId}/modules/preset`, { preset }).then((r) => r.data),
    onSuccess: (_, preset) => {
      queryClient.invalidateQueries({ queryKey: ['modules-tree', tenantId] });
      toast.success(`Preset "${preset}" aplicado com sucesso!`);
    },
    onError: () => toast.error('Erro ao aplicar preset'),
  });
};

export const useRetryProvision = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tenants/${tenantId}/retry-provision`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'client'] });
      queryClient.invalidateQueries({ queryKey: ['modules-tree', tenantId] });
      toast.success('Provisioning realizado com sucesso!');
    },
    onError: () => {
      toast.error('Falha no provisioning. Tente novamente mais tarde.');
    },
  });
};

export const useStartImpersonate = () => {
  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason: string }) =>
      api.post(`/clients/${clientId}/impersonate`, { reason }).then((r) => r.data as { magicLink: string; sessionId: string; logId: string }),
  });
};

export const useEndImpersonate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, logId }: { clientId: string; logId: string }) =>
      api.patch(`/clients/${clientId}/impersonate/${logId}/end`).then((r) => r.data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['impersonate-logs', vars.clientId] });
      toast.success('Sessão de impersonate encerrada');
    },
    onError: () => {
      toast.error('Erro ao encerrar sessão de impersonate');
    },
  });
};

export const useClientImpersonateLogs = (clientId: string | undefined) => {
  return useQuery<ImpersonateLog[]>({
    queryKey: ['impersonate-logs', clientId],
    queryFn: () => api.get(`/clients/${clientId}/impersonate-logs`).then((r) => r.data),
    enabled: !!clientId,
  });
};
