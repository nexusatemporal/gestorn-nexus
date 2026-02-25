import { api } from '../../../services/api';

export interface ReactivateClientData {
  clientId: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
  newPaymentDate: string; // "YYYY-MM-DD"
  amount: number;
}

export const subscriptionsApi = {
  getByClient: (clientId: string) =>
    api.get(`/subscriptions/client/${clientId}`).then((r) => r.data),

  getActive: (clientId: string) =>
    api.get(`/subscriptions/client/${clientId}/active`).then((r) => r.data),

  reactivate: (data: ReactivateClientData) =>
    api.post('/subscriptions/reactivate', data).then((r) => r.data),
};
