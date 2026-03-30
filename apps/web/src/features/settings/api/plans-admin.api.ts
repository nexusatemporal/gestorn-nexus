import { api } from '@/services/api';

export interface ModuleChild {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isEnabled: boolean;
  isCore?: boolean;
}

export interface ModuleTree {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isEnabled: boolean;
  isCore?: boolean;
  children: ModuleChild[];
}

export interface Plan {
  id: string;
  name: string;
  code: string;
  product: 'ONE_NEXUS' | 'LOCADORAS';
  priceMonthly: number;
  priceAnnual: number;
  setupFee: number;
  maxUsers: number;
  maxUnits: number;
  storageGb: number;
  includedModules: string[];
  isActive: boolean;
  isHighlighted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    clients: number;
    leads: number;
  };
}

export interface CreatePlanDto {
  name: string;
  code: string;
  product: Plan['product'];
  priceMonthly: number;
  priceAnnual: number;
  setupFee?: number;
  maxUsers?: number;
  maxUnits?: number;
  storageGb?: number;
  includedModules?: string[];
  isHighlighted?: boolean;
  sortOrder?: number;
}

export type UpdatePlanDto = Partial<CreatePlanDto>;

export const plansAdminApi = {
  async getAll(params?: { product?: string; isActive?: boolean }) {
    const { data } = await api.get<Plan[]>('/plans', { params });
    return data;
  },

  async getOne(id: string) {
    const { data } = await api.get<Plan>(`/plans/${id}`);
    return data;
  },

  async create(dto: CreatePlanDto) {
    const { data } = await api.post<Plan>('/plans', dto);
    return data;
  },

  async update(id: string, dto: UpdatePlanDto) {
    const { data } = await api.put<Plan>(`/plans/${id}`, dto);
    return data;
  },

  async remove(id: string) {
    await api.delete(`/plans/${id}`);
  },

  async restore(id: string) {
    const { data } = await api.post<Plan>(`/plans/${id}/restore`);
    return data;
  },

  async getModulesCatalog() {
    const { data } = await api.get<ModuleTree[]>('/plans/modules-catalog');
    return data;
  },
};
