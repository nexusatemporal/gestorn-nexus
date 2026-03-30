import { api } from '@/services/api';

export type StatusEntity = 'CLIENT' | 'LEAD' | 'SUBSCRIPTION' | 'TENANT';

export interface StatusConfig {
  id: string;
  entity: StatusEntity;
  slug: string;
  label: string;
  color: string;
  bgColor: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStatusConfigDto {
  entity: StatusEntity;
  slug: string;
  label: string;
  color: string;
  bgColor: string;
  description?: string;
  sortOrder?: number;
}

export type UpdateStatusConfigDto = Partial<Omit<CreateStatusConfigDto, 'entity' | 'slug'>>;

export const statusConfigsApi = {
  async getAll(entity?: StatusEntity) {
    const { data } = await api.get<StatusConfig[]>('/status-configs', {
      params: entity ? { entity } : undefined,
    });
    return data;
  },

  async getOne(id: string) {
    const { data } = await api.get<StatusConfig>(`/status-configs/${id}`);
    return data;
  },

  async create(dto: CreateStatusConfigDto) {
    const { data } = await api.post<StatusConfig>('/status-configs', dto);
    return data;
  },

  async update(id: string, dto: UpdateStatusConfigDto) {
    const { data } = await api.put<StatusConfig>(`/status-configs/${id}`, dto);
    return data;
  },

  async remove(id: string) {
    await api.delete(`/status-configs/${id}`);
  },
};
