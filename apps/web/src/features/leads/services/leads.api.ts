import { api } from '@/services/api';
import type {
  Lead,
  CreateLeadDto,
  UpdateLeadDto,
  LeadStatus,
  ProductType,
  FunnelStage,
  CreateFunnelStageDto,
  UpdateFunnelStageDto,
  ConvertLeadPayload,
  ConvertLeadResponse,
  GenerateSummaryResponse,
  LeadScoreResponse,
} from '../types';

export const leadsApi = {
  getLeads: async (filters?: {
    status?: LeadStatus;
    productType?: ProductType;
    vendedorId?: string;
  }) => {
    const { data } = await api.get<Lead[]>('/leads', { params: filters });
    return data;
  },

  getLead: async (id: string) => {
    const { data } = await api.get<Lead>(`/leads/${id}`);
    return data;
  },

  createLead: async (payload: CreateLeadDto) => {
    const { data } = await api.post<{ data: Lead; message: string }>('/leads', payload);
    return data;
  },

  updateLead: async (id: string, payload: UpdateLeadDto) => {
    const { data } = await api.patch<{ data: Lead; message: string }>(`/leads/${id}`, payload);
    return data;
  },

  deleteLead: async (id: string) => {
    const { data } = await api.delete<{ message: string }>(`/leads/${id}`);
    return data;
  },

  /**
   * Converte lead em cliente com dados estratégicos (Smart Lock)
   */
  convert: async (leadId: string, payload: ConvertLeadPayload): Promise<ConvertLeadResponse> => {
    const { data } = await api.post<ConvertLeadResponse>(`/leads/${leadId}/convert`, payload);
    return data;
  },

  /**
   * Gera resumo da negociação com IA
   * @param params - { leadId: string, planId?: string }
   */
  generateSummary: async (params: { leadId: string; planId?: string }): Promise<GenerateSummaryResponse> => {
    const { data } = await api.post<GenerateSummaryResponse>(
      `/leads/${params.leadId}/generate-summary`,
      { planId: params.planId }, // ✅ Passar planId no body
    );
    return data;
  },

  /**
   * Obtém score detalhado do lead
   */
  getScore: async (leadId: string): Promise<LeadScoreResponse> => {
    const { data } = await api.get<LeadScoreResponse>(`/leads/${leadId}/score`);
    return data;
  },

  convertToClient: async (id: string) => {
    // Atualiza status para GANHO, o backend faz a conversão automática
    const { data } = await api.patch<{ data: Lead; message: string }>(`/leads/${id}`, {
      status: 'GANHO',
    });
    return data;
  },

  searchCities: async (query: string) => {
    const { data } = await api.get<Array<{ id: number; name: string }>>(
      `/leads/cities/search`,
      { params: { q: query } }
    );
    return data;
  },

  /**
   * Adiciona interação à linha do tempo do lead
   */
  addInteraction: async (leadId: string, content: string) => {
    const { data } = await api.post(`/leads/${leadId}/interactions`, { content });
    return data;
  },

  /**
   * Verifica se CNPJ já existe no sistema (leads ou clientes)
   */
  checkDuplicateCnpj: async (cnpj: string) => {
    const { data } = await api.get<{
      exists: boolean;
      type?: 'CLIENT' | 'LEAD';
      status?: string;
      record?: {
        id: string;
        name: string;
        cnpj: string;
        assignedTo: string;
      };
      message: string;
    }>(`/leads/check-duplicate-cnpj/${encodeURIComponent(cnpj)}`);
    return data;
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 🎯 FUNNEL STAGES API (Pipeline Configuration)
// ══════════════════════════════════════════════════════════════════════════════

export const funnelStagesApi = {
  getAll: async () => {
    const { data } = await api.get<FunnelStage[]>('/funnel-stages');
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<FunnelStage>(`/funnel-stages/${id}`);
    return data;
  },

  create: async (payload: CreateFunnelStageDto) => {
    const { data } = await api.post<FunnelStage>('/funnel-stages', payload);
    return data;
  },

  update: async (id: string, payload: UpdateFunnelStageDto) => {
    const { data } = await api.put<FunnelStage>(`/funnel-stages/${id}`, payload);
    return data;
  },

  reorder: async (payload: { stages: { id: string; order: number }[] }) => {
    const { data } = await api.patch<FunnelStage[]>('/funnel-stages/reorder', payload);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/funnel-stages/${id}`);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 👥 USERS API (Vendedores)
// ══════════════════════════════════════════════════════════════════════════════

export const usersApi = {
  getVendedores: async () => {
    const { data } = await api.get<Array<{
      id: string;
      name: string;
      email: string;
      role: string;
    }>>('/users', {
      params: { isActive: 'true' }
    });
    // Filtra apenas VENDEDOR e GESTOR (podem ser responsáveis por leads)
    return data.filter(user => ['VENDEDOR', 'GESTOR', 'SUPERADMIN'].includes(user.role));
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 📋 PLANS API (Planos de Assinatura)
// ══════════════════════════════════════════════════════════════════════════════

export const plansApi = {
  getAll: async () => {
    const { data } = await api.get<Array<{
      id: string;
      name: string;
      code: string;
      product: string;
      priceMonthly: number;
      priceAnnual: number; // ✅ Adicionado para modal de conversão
      isActive: boolean;
    }>>('/plans', {
      params: { isActive: 'true' }
    });
    return data;
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 🏷️ LEAD ORIGINS API (Origens de Leads)
// ══════════════════════════════════════════════════════════════════════════════

export const leadOriginsApi = {
  getAll: async () => {
    const { data } = await api.get<Array<{
      id: string;
      name: string;
      description?: string;
      isActive: boolean;
    }>>('/leads/origins');
    return data;
  },
};
