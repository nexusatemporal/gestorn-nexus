import axios from 'axios';
import { api } from '@/services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export type FieldType =
  | 'text' | 'email' | 'phone' | 'cnpj' | 'cep' | 'select' | 'textarea'
  | 'number' | 'state' | 'date' | 'url' | 'radio' | 'checkbox' | 'heading' | 'hidden';

export interface FormFieldDef {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: string[];
  mappedTo?: 'name' | 'email' | 'phone' | 'cpfCnpj' | 'companyName' | 'city' | 'role' | 'notes';
  order: number;
  minLength?: number;
  maxLength?: number;
  halfWidth?: boolean;
  defaultValue?: string;
}

export type FormPurpose = 'CAMPAIGN' | 'EMBED';
export type VendorAssignmentMode = 'FIXED' | 'CREATOR' | 'ROUND_ROBIN';

export interface Form {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  purpose: FormPurpose;
  productType?: string | null;
  fields: FormFieldDef[];
  successMessage?: string | null;
  vendorAssignmentMode: VendorAssignmentMode;
  defaultVendedorId?: string | null;
  roundRobinVendedorIds: string[];
  originId?: string | null;
  isActive: boolean;
  createdById: string;
  createdBy: { id: string; name: string };
  origin?: { id: string; name: string } | null;
  defaultVendedor?: { id: string; name: string } | null;
  _count?: { submissions: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormPayload {
  name: string;
  description?: string;
  purpose: FormPurpose;
  productType?: string;
  fields: FormFieldDef[];
  successMessage?: string;
  vendorAssignmentMode?: VendorAssignmentMode;
  defaultVendedorId?: string;
  roundRobinVendedorIds?: string[];
  originId?: string;
  isActive?: boolean;
  slug?: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  leadId?: string | null;
  data: Record<string, string>;
  ipAddress?: string | null;
  createdAt: string;
  lead?: {
    id: string;
    name: string;
    email: string;
    status: string;
    score: number;
    createdAt: string;
  } | null;
}

export const formsApi = {
  // Autenticados
  getAll: async (): Promise<Form[]> => {
    const { data } = await api.get<Form[]>('/forms');
    return data;
  },

  getById: async (id: string): Promise<Form> => {
    const { data } = await api.get<Form>(`/forms/${id}`);
    return data;
  },

  create: async (payload: CreateFormPayload): Promise<Form> => {
    const { data } = await api.post<Form>('/forms', payload);
    return data;
  },

  update: async (id: string, payload: Partial<CreateFormPayload>): Promise<Form> => {
    const { data } = await api.patch<Form>(`/forms/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/forms/${id}`);
  },

  getSubmissions: async (
    id: string,
    page = 1,
    limit = 50,
  ): Promise<{ submissions: FormSubmission[]; total: number; page: number; limit: number }> => {
    const { data } = await api.get(`/forms/${id}/submissions`, { params: { page, limit } });
    return data;
  },

  // Públicos — sem interceptor de auth
  getPublic: async (slug: string): Promise<Pick<Form, 'id' | 'name' | 'description' | 'purpose' | 'productType' | 'fields' | 'successMessage' | 'isActive'>> => {
    const { data } = await axios.get(`${API_BASE}/forms/public/${slug}`);
    return data;
  },

  submit: async (
    slug: string,
    formData: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await axios.post(`${API_BASE}/forms/public/${slug}/submit`, { data: formData });
    return data;
  },
};
