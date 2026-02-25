import { api } from '@/services/api';

/**
 * Settings API Client
 */

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'SUPERADMIN' | 'ADMINISTRATIVO' | 'GESTOR' | 'VENDEDOR' | 'DESENVOLVEDOR';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  gestorId?: string;
  gestor?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    assignedClients: number;
    assignedLeads: number;
    vendedores: number;
  };
}

export interface CreateUserDto {
  email: string;
  name: string;
  password?: string;
  phone?: string;
  role: User['role'];
  gestorId?: string;
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  role?: User['role'];
  gestorId?: string;
}

export const settingsApi = {
  async getUsers(params?: { role?: string; isActive?: boolean }) {
    const { data } = await api.get<User[]>('/users', { params });
    return data;
  },

  async getUser(id: string) {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  async getMe() {
    const { data } = await api.get<User>('/users/me');
    return data;
  },

  async createUser(dto: CreateUserDto) {
    const { data } = await api.post<User>('/users', dto);
    return data;
  },

  async updateUser(id: string, dto: UpdateUserDto) {
    const { data } = await api.put<User>(`/users/${id}`, dto);
    return data;
  },

  async deactivateUser(id: string) {
    await api.delete(`/users/${id}`);
  },

  async restoreUser(id: string) {
    const { data } = await api.post<User>(`/users/${id}/restore`);
    return data;
  },
};
