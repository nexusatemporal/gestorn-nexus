import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, funnelStagesApi, usersApi, plansApi, leadOriginsApi } from '../services/leads.api';
import type {
  CreateLeadDto,
  UpdateLeadDto,
  LeadStatus,
  ProductType,
  CreateFunnelStageDto,
  UpdateFunnelStageDto,
  ConvertLeadPayload,
} from '../types';

export const useLeads = (filters?: {
  status?: LeadStatus;
  productType?: ProductType;
  vendedorId?: string;
}) => {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => leadsApi.getLeads(filters),
  });
};

export const useLead = (id: string) => {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsApi.getLead(id),
    enabled: !!id,
  });
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateLeadDto) => leadsApi.createLead(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false }); // ✅ v2.50.3: Auto-refresh dashboard
    },
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLeadDto }) =>
      leadsApi.updateLead(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false }); // ✅ v2.50.3: Auto-refresh dashboard
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar lead:', error.response?.data?.message || error.message);
    },
  });
};

export const useDeleteLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leadsApi.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false }); // ✅ v2.50.3: Auto-refresh dashboard
    },
    onError: (error: any) => {
      console.error('Erro ao excluir lead:', error.response?.data?.message || error.message);
    },
  });
};

/**
 * Hook para converter lead em cliente com Smart Lock
 * Requer dados estratégicos obrigatórios para handoff
 */
export const useConvertLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: ConvertLeadPayload }) =>
      leadsApi.convert(leadId, payload),
    onSuccess: (data) => {
      // Invalida queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['transactions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payments'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['finance'], exact: false }); // ✅ v2.43.0: Invalida finance para atualizar transações
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false }); // ✅ v2.50.3: Auto-refresh dashboard

      // Log de sucesso com módulo correto
      console.log('Lead convertido com sucesso!', `Agora em: ${data._conversion.moduleName}`);
    },
    onError: (error: any) => {
      console.error('Erro ao converter lead:', error.response?.data?.message || error.message);
    },
  });
};

/**
 * Hook para converter lead de forma simples (método antigo)
 * Mantido para compatibilidade
 */
export const useConvertLeadSimple = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leadsApi.convertToClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['finance'], exact: false }); // ✅ v2.43.0: Invalida finance para atualizar transações
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false }); // ✅ v2.50.3: Auto-refresh dashboard
    },
  });
};

/**
 * Hook para gerar resumo da negociação com IA
 */
export const useGenerateSummary = () => {
  return useMutation({
    mutationFn: (params: { leadId: string; planId?: string }) => leadsApi.generateSummary(params),
    onError: (error: any) => {
      console.error('Erro ao gerar resumo:', error.response?.data?.message || 'Tente novamente');
    },
  });
};

/**
 * Hook para obter score detalhado do lead
 */
export const useLeadScore = (leadId: string) => {
  return useQuery({
    queryKey: ['lead-score', leadId],
    queryFn: () => leadsApi.getScore(leadId),
    enabled: !!leadId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// 🎯 FUNNEL STAGES HOOKS (Pipeline Configuration)
// ══════════════════════════════════════════════════════════════════════════════

export const useFunnelStages = () => {
  return useQuery({
    queryKey: ['funnel-stages'],
    queryFn: funnelStagesApi.getAll,
    staleTime: 1000 * 60 * 5, // 5 minutos (stages mudam raramente)
  });
};

export const useFunnelStage = (id: string) => {
  return useQuery({
    queryKey: ['funnel-stages', id],
    queryFn: () => funnelStagesApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateFunnelStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateFunnelStageDto) => funnelStagesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
    },
  });
};

export const useUpdateFunnelStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFunnelStageDto }) =>
      funnelStagesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
    },
  });
};

export const useReorderFunnelStages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { stages: { id: string; order: number }[] }) =>
      funnelStagesApi.reorder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'], exact: false });
    },
  });
};

export const useDeleteFunnelStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => funnelStagesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['leads'], exact: false });
    },
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// 👥 USERS HOOKS (Vendedores)
// ══════════════════════════════════════════════════════════════════════════════

export const useVendedores = () => {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: usersApi.getVendedores,
    staleTime: 1000 * 60 * 10, // 10 minutos (vendedores mudam raramente)
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// 📋 PLANS HOOKS (Planos de Assinatura)
// ══════════════════════════════════════════════════════════════════════════════

export const usePlans = () => {
  return useQuery({
    queryKey: ['plans'],
    queryFn: plansApi.getAll,
    staleTime: 1000 * 60 * 10, // 10 minutos (planos mudam raramente)
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// 🏷️ LEAD ORIGINS HOOKS (Origens de Leads)
// ══════════════════════════════════════════════════════════════════════════════

export const useLeadOrigins = () => {
  return useQuery({
    queryKey: ['lead-origins'],
    queryFn: leadOriginsApi.getAll,
    staleTime: 1000 * 60 * 10, // 10 minutos (origens mudam raramente)
  });
};
