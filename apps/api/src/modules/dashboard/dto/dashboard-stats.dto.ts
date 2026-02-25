import { z } from 'zod';
import { ProductType } from '@prisma/client';

/**
 * DTO para filtros do dashboard
 *
 * ✅ v2.51.0: Removido filtro de tempo global
 * - Dashboard = "estado AGORA" (não análise histórica)
 * - Métricas sempre comparam mês atual vs mês anterior (MoM - Month over Month)
 * - Análise histórica pertence aos módulos específicos (Finance, etc.)
 */
export const DashboardFiltersSchema = z.object({
  product: z.nativeEnum(ProductType).optional(),
  mrrMonths: z.coerce.number().int().min(1).max(24).optional(),
  refresh: z.coerce.boolean().optional(),
});

export type DashboardFiltersDto = z.infer<typeof DashboardFiltersSchema>;

/**
 * DTO para estatísticas do dashboard
 */
export interface DashboardStatsDto {
  // KPIs principais
  kpis: {
    totalClients: number;
    activeClients: number;
    trialClients: number;
    churnedClients: number;
    mrr: number;
    totalLeads: number;
    conversionRate: number;
    overduePayments: number;
    // Trends (v2.48.0)
    totalClientsTrend?: string;
    totalClientsTrendUp?: boolean;
    mrrTrend?: string;
    mrrTrendUp?: boolean;
    totalLeadsTrend?: string;
    totalLeadsTrendUp?: boolean;
    overduePaymentsTrend?: string;
    overduePaymentsTrendUp?: boolean;
  };

  // Revenue ao longo do tempo (últimos 6 meses)
  revenueOverTime: Array<{
    month: string;
    revenue: number;
  }>;

  // Clientes por plano
  clientsByPlan: Array<{
    plan: string;
    count: number;
  }>;

  // Atividades recentes
  recentActivity: {
    recentLeads: Array<{
      id: string;
      name: string;
      origin: string;
      createdAt: string;
    }>;
    recentClients: Array<{
      id: string;
      responsibleName: string;
      planName: string;      // ✅ v2.48.2: Nome do plano
      productType: string;   // ✅ v2.48.2: ProductType enum para cor
      createdAt: string;
    }>;
    upcomingPayments: Array<{
      id: string;
      clientId: string;
      clientName: string;
      amount: number;
      dueDate: string | null;
    }>;
  };
}

/**
 * ✅ v2.48.0: DTO para query de paginação
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type PaginationQueryDto = z.infer<typeof PaginationQuerySchema>;

/**
 * ✅ v2.48.0: DTO genérico para resposta paginada
 */
export interface PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
