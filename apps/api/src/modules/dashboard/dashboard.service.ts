import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DashboardFiltersDto,
  DashboardStatsDto,
} from './dto/dashboard-stats.dto';
import {
  ClientStatus,
  LeadStatus,
  PaymentStatus,
  ProductType,
  UserRole,
} from '@prisma/client';
import { subMonths, startOfMonth, format } from 'date-fns';
import { z } from 'zod';
import {
  DashboardInsightSchema,
  GenerateInsightsResponseDto,
  InsightSeverity,
} from './dto/insights.dto';
import { getDashboardInsightsPrompt } from '../../lib/ai/prompts/insights';
import { salesAI } from '../../lib/ai/service';

/**
 * ✅ v2.53.0: Interface para cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  /**
   * ✅ v2.53.0: In-memory cache para insights (TTL: 5 minutos)
   * Pattern usado por: Stripe, Salesforce, HubSpot
   */
  private insightsCache = new Map<string, CacheEntry<GenerateInsightsResponseDto>>();
  private readonly INSIGHTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca estatísticas agregadas para o dashboard
   *
   * ✅ v2.51.0: Removido filtro de tempo global - Dashboard = "estado AGORA"
   * - Métricas sempre mostram ESTADO ATUAL (não período específico)
   * - Trends sempre comparam MÊS ATUAL vs MÊS ANTERIOR (MoM - Month over Month)
   * - Análise histórica pertence aos módulos específicos (Finance)
   */
  async getStats(
    userId: string,
    userRole: UserRole,
    filters: DashboardFiltersDto,
  ): Promise<DashboardStatsDto> {
    this.logger.log(
      `📊 Buscando estatísticas do dashboard - User: ${userId}, Role: ${userRole}, Filters: ${JSON.stringify(filters)}`,
    );

    // ✅ v2.51.0: Período atual = mês atual completo (MoM)
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = now;

    // Período anterior = mês anterior completo
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = subMonths(now, 1);

    // Scoping: VENDEDOR/GESTOR veem apenas seus dados
    const whereClause =
      userRole === UserRole.VENDEDOR || userRole === UserRole.GESTOR
        ? { vendedorId: userId }
        : {};

    // ✅ v2.50.0: Criar whereClause separado para Lead (interestProduct) e Client (productType)
    const whereClauseForLeads = {
      ...whereClause,
      ...(filters.product ? { interestProduct: filters.product } : {}),
    };

    const whereClauseForClients = {
      ...whereClause,
      ...(filters.product ? { productType: filters.product } : {}),
    };

    // ✅ v2.51.0: Buscar KPIs (MoM comparison)
    const kpis = await this.calculateKPIs(
      whereClauseForClients,
      whereClauseForLeads,
      currentMonthStart,
      currentMonthEnd,
      previousMonthStart,
      previousMonthEnd,
    );

    // ✅ v2.51.0: Distribuições mostram MÊS ATUAL (não período dinâmico)
    // ✅ v2.52.0: Removido leadsByOrigin, leadsByStatus, paymentsByStatus (não usados pelo frontend)
    const clientsByPlan = await this.getClientsByPlan(whereClauseForClients);

    // MRR graph mantém filtro independente (6/12 meses)
    const revenueOverTime = await this.getRevenueOverTime(whereClauseForClients, filters.mrrMonths || 6);

    // Atividades recentes NÃO filtradas por tempo (sempre últimas 5)
    const recentActivity = await this.getRecentActivity(
      whereClauseForClients,
      whereClauseForLeads,
    );

    return {
      kpis,
      revenueOverTime,
      clientsByPlan,
      recentActivity,
    };
  }

  /**
   * Calcula KPIs principais
   * ✅ v2.50.0: Aceita whereClause separado para Client e Lead
   * ✅ v2.51.0: MoM (Month over Month) - compara mês atual vs mês anterior
   */
  private async calculateKPIs(
    whereClauseForClients: any,
    whereClauseForLeads: any,
    currentMonthStart: Date,
    currentMonthEnd: Date,
    previousMonthStart: Date,
    previousMonthEnd: Date,
  ) {

    // Total de clientes (✅ v2.50.0: usar whereClauseForClients)
    const totalClients = await this.prisma.client.count({
      where: whereClauseForClients,
    });

    // Clientes ativos (✅ v2.43.0: inclui EM_TRIAL)
    const activeClients = await this.prisma.client.count({
      where: {
        ...whereClauseForClients,
        status: {
          in: [ClientStatus.ATIVO, ClientStatus.EM_TRIAL],
        },
      },
    });

    // Clientes em trial
    const trialClients = await this.prisma.client.count({
      where: {
        ...whereClauseForClients,
        status: ClientStatus.EM_TRIAL,
      },
    });

    // Clientes cancelados no mês atual
    const churnedClients = await this.prisma.client.count({
      where: {
        ...whereClauseForClients,
        status: ClientStatus.CANCELADO,
        updatedAt: {
          gte: currentMonthStart,
        },
      },
    });

    // MRR (Monthly Recurring Revenue) - soma dos valores dos planos dos clientes ativos
    // ✅ v2.52.0: Usando método consolidado calculateMrrForPeriod()
    const mrr = await this.calculateMrrForPeriod(whereClauseForClients);

    // ✅ v2.51.0: Leads do MÊS ATUAL (não período dinâmico)
    // Leads EM ABERTO (para o card "Leads em Aberto")
    const openLeads = await this.prisma.lead.count({
      where: {
        ...whereClauseForLeads,
        status: LeadStatus.ABERTO, // Apenas leads ainda no funil
        createdAt: {
          gte: currentMonthStart,
        },
      },
    });

    // TOTAL de leads criados no mês atual (para taxa de conversão - TODOS os status)
    const totalLeads = await this.prisma.lead.count({
      where: {
        ...whereClauseForLeads,
        createdAt: {
          gte: currentMonthStart,
        },
      },
    });

    // Leads ganhos (convertidos) no mês atual
    const wonLeads = await this.prisma.lead.count({
      where: {
        ...whereClauseForLeads,
        status: LeadStatus.GANHO,
        createdAt: {
          gte: currentMonthStart,
        },
      },
    });

    // Taxa de conversão: (GANHO / TODOS) * 100 (padrão CRM: Pipedrive, HubSpot, Salesforce)
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    // Pagamentos vencidos (✅ v2.50.0: usar whereClauseForClients limpo)
    const overduePayments = await this.prisma.payment.count({
      where: {
        status: PaymentStatus.OVERDUE,
        client: Object.keys(whereClauseForClients).length > 0
          ? whereClauseForClients
          : {},
      },
    });

    // ✅ v2.55.0: Métricas do MÊS ANTERIOR (snapshot cumulativo até fim do mês anterior)
    // Ambos (current e previous) são cumulativos — trend mostra crescimento real MoM
    const totalClientsPrevious = await this.prisma.client.count({
      where: {
        ...whereClauseForClients,
        createdAt: {
          lte: previousMonthEnd,
        },
      },
    });

    // ✅ v2.55.0: MRR cumulativo até fim do mês anterior (snapshot)
    const mrrPrevious = await this.calculateMrrForPeriod(
      whereClauseForClients,
      previousMonthEnd,
    );

    // Leads em aberto do mês anterior (para trend do card)
    const openLeadsPrevious = await this.prisma.lead.count({
      where: {
        ...whereClauseForLeads,
        status: LeadStatus.ABERTO,
        createdAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
      },
    });

    const overduePaymentsPrevious = await this.prisma.payment.count({
      where: {
        status: PaymentStatus.OVERDUE,
        createdAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
        client: Object.keys(whereClauseForClients).length > 0
          ? whereClauseForClients
          : {},
      },
    });

    // ✅ v2.51.0: Calcular trends MoM (Month over Month)
    const calculateTrend = (current: number, previous: number): { trend: string; trendUp: boolean } => {
      // Primeiro mês: mostrar "Novo" se há dados (profissional, não assusta com +100%)
      if (previous === 0) {
        return { trend: current > 0 ? 'Novo' : '0%', trendUp: current > 0 };
      }
      // Crescimento normal: mostrar percentual real (pode passar de 100%, é legítimo)
      const percentage = ((current - previous) / previous) * 100;
      const rounded = Math.round(percentage * 10) / 10;
      return {
        trend: `${rounded > 0 ? '+' : ''}${rounded}%`,
        trendUp: rounded > 0,
      };
    };

    const totalClientsTrendData = calculateTrend(totalClients, totalClientsPrevious);
    const mrrTrendData = calculateTrend(mrr, mrrPrevious);
    const totalLeadsTrendData = calculateTrend(openLeads, openLeadsPrevious); // ✅ v2.50.7: Trend de leads em aberto
    const overduePaymentsTrendData = calculateTrend(overduePayments, overduePaymentsPrevious);

    return {
      totalClients,
      activeClients,
      trialClients,
      churnedClients,
      mrr,
      totalLeads: openLeads, // ✅ v2.50.7: Card mostra leads em aberto, não total
      conversionRate: Math.round(conversionRate * 100) / 100, // ✅ Taxa usa totalLeads (todos)
      overduePayments,
      // Trends
      totalClientsTrend: totalClientsTrendData.trend,
      totalClientsTrendUp: totalClientsTrendData.trendUp,
      mrrTrend: mrrTrendData.trend,
      mrrTrendUp: mrrTrendData.trendUp,
      totalLeadsTrend: totalLeadsTrendData.trend,
      totalLeadsTrendUp: totalLeadsTrendData.trendUp,
      overduePaymentsTrend: overduePaymentsTrendData.trend,
      overduePaymentsTrendUp: overduePaymentsTrendData.trendUp,
    };
  }

  /**
   * MRR acumulado ao longo dos últimos N meses
   * ✅ v2.55.0: Lógica de acumulação igual ao Finance (getMrrHistory)
   * - Histórico imutável: cancelar em março não altera fevereiro
   * - New MRR sem filtro de status (conta pela data de criação)
   * - Churn/Overdue descontados apenas no mês em que ocorrem
   */
  private async getRevenueOverTime(whereClause: any, months: number) {
    const now = new Date();

    // Filtro de scoping (vendedor/produto) — merge num único objeto client
    const clientFilterInner: any = {};
    if (whereClause.vendedorId) clientFilterInner.vendedorId = whereClause.vendedorId;
    if (whereClause.productType) clientFilterInner.productType = whereClause.productType;
    const clientFilter = Object.keys(clientFilterInner).length > 0
      ? { client: clientFilterInner }
      : {};

    // MRR inicial: tudo ativo ANTES do período
    const firstMonthStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const mrrInicial = await this.prisma.financeTransaction.aggregate({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: { in: ['PAID', 'PENDING'] },
        date: { lt: firstMonthStart },
        ...clientFilter,
      },
      _sum: { amount: true },
    });

    let mrrAcumulado = Number(mrrInicial._sum.amount || 0);
    const result: Array<{ month: string; revenue: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthKey = format(monthStart, 'yyyy-MM');

      // New MRR: transações criadas no mês (SEM filtro de status — histórico imutável)
      const newMrr = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          date: { gte: monthStart, lte: monthEnd },
          ...clientFilter,
        },
        _sum: { amount: true },
      });

      // Churn: canceladas no mês (pela data do cancelamento)
      const churn = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: 'CANCELLED',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...clientFilter,
        },
        _sum: { amount: true },
      });

      // Overdue: viraram inadimplente no mês
      const overdue = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: 'OVERDUE',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...clientFilter,
        },
        _sum: { amount: true },
      });

      const newValue = Number(newMrr._sum.amount || 0);
      const churnValue = Number(churn._sum.amount || 0);
      const overdueValue = Number(overdue._sum.amount || 0);

      mrrAcumulado += newValue - churnValue - overdueValue;

      result.push({ month: monthKey, revenue: mrrAcumulado });
    }

    return result;
  }

  /**
   * Busca distribuição de clientes por plano
   */
  /**
   * ✅ v2.52.0: Otimizado com Prisma groupBy (agregação no banco)
   * Performance: ~200ms mais rápido que findMany + reduce manual
   */
  private async getClientsByPlan(whereClause: any) {
    // ✅ v2.55.0: Mostra TODOS os clientes ativos por plano (não só do mês atual)
    const planGroups = await this.prisma.client.groupBy({
      by: ['planId'],
      where: {
        ...whereClause,
        status: {
          in: [ClientStatus.ATIVO, ClientStatus.EM_TRIAL],
        },
      },
      _count: {
        id: true,
      },
    });

    // ✅ Busca apenas os nomes dos planos únicos (poucos registros)
    const planIds = planGroups.map((g) => g.planId).filter(Boolean);
    const plans = await this.prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true },
    });

    // ✅ Mapeia para formato final (processamento mínimo em Node.js)
    const planMap = new Map(plans.map((p) => [p.id, p.name]));

    return planGroups.map((group) => ({
      plan: group.planId
        ? planMap.get(group.planId) || 'Sem plano'
        : 'Sem plano',
      count: group._count.id,
    }));
  }

  /**
   * Busca atividades recentes
   * ✅ v2.50.1: Aceita whereClause separado para Client e Lead
   * ✅ v2.52.0: Queries executadas em paralelo com Promise.all()
   */
  private async getRecentActivity(
    whereClauseForClients: any,
    whereClauseForLeads: any,
  ) {
    // ✅ PARALELO: Executa todas as 3 queries simultaneamente
    const [recentLeads, recentClients, upcomingPayments] = await Promise.all([
      // Query 1: Últimos 5 leads criados
      this.prisma.lead.findMany({
        where: whereClauseForLeads,
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          name: true,
          originId: true,
          origin: {
            select: {
              name: true,
            },
          },
          createdAt: true,
        },
      }),

      // Query 2: Últimos 5 clientes criados
      this.prisma.client.findMany({
        where: whereClauseForClients,
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          contactName: true,
          productType: true,
          plan: {
            select: {
              name: true,
            },
          },
          createdAt: true,
        },
      }),

      // Query 3: Próximos 5 vencimentos de subscriptions ativas (não pagas)
      this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          nextBillingDate: {
            gte: new Date(), // Apenas vencimentos futuros
          },
          client: Object.keys(whereClauseForClients).length > 0
            ? whereClauseForClients
            : {},
          // ✅ v2.48.2: Exclui subscriptions com FinanceTransaction PAID para essa data
          NOT: {
            financeTransactions: {
              some: {
                dueDate: {
                  gte: new Date(), // Vencimentos futuros
                },
                status: 'PAID', // Já pagos
              },
            },
          },
        },
        orderBy: {
          nextBillingDate: 'asc',
        },
        take: 5,
        select: {
          id: true,
          clientId: true,
          amount: true,
          nextBillingDate: true,
          client: {
            select: {
              contactName: true,
            },
          },
          plan: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      recentLeads: recentLeads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        origin: lead.origin?.name || 'Não informado',
        createdAt: lead.createdAt.toISOString(),
      })),
      recentClients: recentClients.map((client) => ({
        id: client.id,
        responsibleName: client.contactName,
        planName: client.plan?.name || 'Sem plano', // ✅ v2.48.2: Nome do plano
        productType: client.productType, // ✅ v2.48.2: Mantém enum para cor
        createdAt: client.createdAt.toISOString(),
      })),
      upcomingPayments: upcomingPayments
        .filter((sub) => sub.client && sub.clientId && sub.nextBillingDate) // Remove entries sem cliente ou sem data
        .map((sub) => ({
          id: sub.id,
          clientId: sub.clientId,
          clientName: sub.client.contactName,
          amount: Number(sub.amount),
          dueDate: sub.nextBillingDate!.toISOString(), // ✅ v2.48.1: Usa nextBillingDate da subscription
        })),
    };
  }

  /**
   * ✅ v2.48.0: Busca leads paginados para expansão do card
   */
  async getPaginatedLeads(
    userId: string,
    userRole: UserRole,
    page: number,
    limit: number,
  ) {
    // Scoping por role (Lead usa vendedorId, não userId)
    const whereClause =
      userRole === UserRole.VENDEDOR || userRole === UserRole.GESTOR
        ? { vendedorId: userId }
        : {};

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          originId: true,
          origin: { select: { name: true } },
          createdAt: true,
        },
      }),
      this.prisma.lead.count({ where: whereClause }),
    ]);

    return {
      data: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        origin: lead.origin?.name || 'Não informado',
        createdAt: lead.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ v2.48.0: Busca clientes paginados para expansão do card
   */
  async getPaginatedClients(
    userId: string,
    userRole: UserRole,
    page: number,
    limit: number,
  ) {
    // Scoping por role
    const whereClause =
      userRole === UserRole.VENDEDOR || userRole === UserRole.GESTOR
        ? { vendedorId: userId }
        : {};

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          contactName: true,
          productType: true,
          plan: { select: { name: true } }, // ✅ v2.48.2: Inclui plan relation
          createdAt: true,
        },
      }),
      this.prisma.client.count({ where: whereClause }),
    ]);

    return {
      data: clients.map((client) => ({
        id: client.id,
        responsibleName: client.contactName,
        planName: client.plan?.name || 'Sem plano', // ✅ v2.48.2: Retorna planName
        productType: client.productType, // ✅ v2.48.2: Enum para cor
        createdAt: client.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ v2.48.2: Busca próximos vencimentos paginados (Subscription, não FinanceTransaction)
   * Unificado com lógica do card inicial para consistência
   */
  async getPaginatedUpcomingPayments(
    userId: string,
    userRole: UserRole,
    page: number,
    limit: number,
  ) {
    // Scoping por role (busca de Subscription)
    const whereClause: any = {
      status: 'ACTIVE',
      nextBillingDate: {
        gte: new Date(), // Apenas vencimentos futuros
      },
      // ✅ v2.48.2: Exclui subscriptions com FinanceTransaction PAID para essa data
      NOT: {
        financeTransactions: {
          some: {
            dueDate: {
              gte: new Date(), // Vencimentos futuros
            },
            status: 'PAID', // Já pagos
          },
        },
      },
    };

    // Filtro por vendedor se aplicável
    if (userRole === UserRole.VENDEDOR || userRole === UserRole.GESTOR) {
      whereClause.client = { vendedorId: userId };
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: whereClause,
        orderBy: { nextBillingDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          clientId: true,
          amount: true,
          nextBillingDate: true,
          client: { select: { contactName: true } },
        },
      }),
      this.prisma.subscription.count({ where: whereClause }),
    ]);

    return {
      data: subscriptions
        .filter((sub) => sub.client && sub.clientId && sub.nextBillingDate) // Remove entries sem cliente ou sem data
        .map((sub) => ({
          id: sub.id,
          clientId: sub.clientId,
          clientName: sub.client.contactName,
          amount: Number(sub.amount),
          dueDate: sub.nextBillingDate!.toISOString(),
        })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ v2.53.0: Helper - Gera cache key para insights
   */
  private getInsightsCacheKey(userId: string, product?: ProductType): string {
    return `insights:${userId}:${product || 'all'}`;
  }

  /**
   * ✅ v2.53.0: Helper - Verifica se cache ainda é válido
   */
  private isCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * ✅ v2.53.0: Helper - Busca insights do cache
   */
  private getFromCache(cacheKey: string): GenerateInsightsResponseDto | null {
    const cached = this.insightsCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      this.logger.log(`⚡ [Cache HIT] Returning cached insights (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return {
        ...cached.data,
        metadata: {
          ...cached.data.metadata,
          cached: true,
          cachedAt: new Date(cached.timestamp).toISOString(),
        },
      };
    }

    if (cached) {
      this.logger.log(`🗑️ [Cache EXPIRED] Removing stale entry`);
      this.insightsCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * ✅ v2.53.0: Helper - Salva insights no cache
   */
  private saveToCache(cacheKey: string, data: GenerateInsightsResponseDto): void {
    this.insightsCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: this.INSIGHTS_CACHE_TTL,
    });
    this.logger.log(`💾 [Cache SAVE] Insights cached for 5 minutes`);
  }

  /**
   * ✅ v2.49.0: Gera insights de IA baseados nas métricas do dashboard
   * ✅ v2.53.0: Implementado cache com TTL de 5 minutos (pattern Stripe/Salesforce)
   */
  async generateInsights(
    userId: string,
    userRole: UserRole,
    filters: DashboardFiltersDto,
  ): Promise<GenerateInsightsResponseDto> {
    const cacheKey = this.getInsightsCacheKey(userId, filters.product);

    this.logger.log(
      `🧠 [Nexus Intel] Generating insights - User: ${userId}, Filters: ${JSON.stringify(filters)}`,
    );

    // ✅ v2.55.0: Bypass cache quando refresh=true
    if (filters.refresh) {
      this.insightsCache.delete(cacheKey);
      this.logger.log(`🔄 [Cache BYPASS] Refresh solicitado, gerando insights frescos...`);
    } else {
      const cachedInsights = this.getFromCache(cacheKey);
      if (cachedInsights) {
        return cachedInsights;
      }
    }

    // Cache miss - gerar novos insights
    this.logger.log(`💨 [Cache MISS] Generating fresh insights...`);

    // ✅ v2.55.0: Buscar stats UMA vez (reutilizado no fallback)
    const stats = await this.getStats(userId, userRole, filters);

    try {
      // ✅ v2.51.0: Gerar insights via IA (MoM - sem período dinâmico)
      const prompt = getDashboardInsightsPrompt(
        stats,
        filters.product,
      );

      this.logger.log(`🤖 [Nexus Intel] Calling Groq AI...`);

      const response = await salesAI.generate({
        task: 'dashboard-insights',
        systemPrompt: prompt.system,
        prompt: prompt.user,
        provider: 'groq', // Ultra-rápido
        jsonMode: true,
      });

      this.logger.log(`✅ [Nexus Intel] AI response received`);

      // Parse e validação
      const parsed = JSON.parse(response);
      const validated = z
        .object({
          insights: z.array(DashboardInsightSchema).length(3),
        })
        .parse(parsed);

      const result: GenerateInsightsResponseDto = {
        insights: validated.insights,
        metadata: {
          generatedAt: new Date().toISOString(),
          period: 'MoM', // ✅ v2.51.0: Month over Month (mês atual vs mês anterior)
          product: filters.product,
          cached: false,
        },
      };

      this.logger.log(`🎯 [Nexus Intel] Successfully generated 3 insights`);

      // ✅ v2.53.0: Salvar no cache antes de retornar
      this.saveToCache(cacheKey, result);

      return result;
    } catch (error) {
      this.logger.error(`❌ [Nexus Intel] AI generation failed:`, error);

      // Fallback to static insights based on simple rules (reusa stats acima)

      const fallbackResult: GenerateInsightsResponseDto = {
        insights: [
          {
            severity: InsightSeverity.INFO,
            title: 'Dashboard Operacional',
            description: `Sistema funcionando corretamente. ${stats.kpis.totalClients} clientes ativos gerando R$ ${stats.kpis.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em MRR.`,
          },
          {
            severity:
              stats.kpis.conversionRate < 30
                ? InsightSeverity.WARNING
                : InsightSeverity.SUCCESS,
            title: 'Taxa de Conversão',
            description: `Sua taxa de conversão está em ${stats.kpis.conversionRate.toFixed(1)}%. ${stats.kpis.conversionRate < 30 ? 'Revise seu funil de vendas.' : 'Continue o bom trabalho!'}`,
            actionable:
              stats.kpis.conversionRate < 30
                ? 'Identifique objeções comuns e treine o time.'
                : undefined,
          },
          {
            severity:
              stats.kpis.overduePayments > 0
                ? InsightSeverity.CRITICAL
                : InsightSeverity.SUCCESS,
            title: 'Inadimplência',
            description: `${stats.kpis.overduePayments} pagamentos vencidos. ${stats.kpis.overduePayments > 0 ? 'Ação urgente necessária.' : 'Todos os pagamentos em dia!'}`,
            actionable:
              stats.kpis.overduePayments > 0
                ? 'Entre em contato com clientes inadimplentes hoje.'
                : undefined,
          },
        ],
        metadata: {
          generatedAt: new Date().toISOString(),
          period: 'MoM', // ✅ v2.51.0: Month over Month (mês atual vs mês anterior)
          product: filters.product,
          cached: false,
        },
      };

      // ✅ v2.53.0: Cache fallback também (evita recalcular stats repetidamente)
      this.saveToCache(cacheKey, fallbackResult);

      return fallbackResult;
    }
  }

  /**
   * ✅ v2.55.0: Método consolidado para calcular MRR (snapshot cumulativo)
   *
   * @param whereClause - Filtro de clientes (scoping por role, product, etc.)
   * @param asOfDate - Se fornecido, retorna MRR cumulativo até aquela data
   * @returns MRR (Monthly Recurring Revenue)
   */
  private async calculateMrrForPeriod(
    whereClause: any,
    asOfDate?: Date,
  ): Promise<number> {
    const where: any = {
      ...whereClause,
      status: {
        in: [ClientStatus.ATIVO, ClientStatus.EM_TRIAL],
      },
    };

    // Se asOfDate fornecido, retorna snapshot cumulativo até aquela data
    if (asOfDate) {
      where.createdAt = { lte: asOfDate };
    }

    const clientsWithPlans = await this.prisma.client.findMany({
      where,
      include: {
        plan: true,
      },
    });

    return clientsWithPlans.reduce(
      (sum, client) => {
        const monthly = Number(client.plan?.priceMonthly || 0);
        // ✅ v2.55.0: Aplica desconto 10% para billing ANNUAL (regra de negócio v2.42.2)
        const discount = client.billingCycle === 'ANNUAL' ? 0.9 : 1;
        return sum + (monthly * discount);
      },
      0,
    );
  }
}
