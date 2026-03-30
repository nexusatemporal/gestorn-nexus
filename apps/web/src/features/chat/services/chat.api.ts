import { api } from '@/services/api';

export interface SsoTokenResponse {
  ssoToken: string;
  chatUrl: string;
}

export const chatApi = {
  getSsoToken: async (): Promise<SsoTokenResponse> => {
    const { data } = await api.post<SsoTokenResponse>('/chat-nexus/sso-token');
    return data;
  },
};
