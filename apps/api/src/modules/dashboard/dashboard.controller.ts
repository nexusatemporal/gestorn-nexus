import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  DashboardFiltersDto,
  DashboardFiltersSchema,
  PaginationQueryDto,
  PaginationQuerySchema,
} from './dto/dashboard-stats.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { GenerateInsightsResponseDto } from './dto/insights.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/stats
   * Busca estatísticas agregadas do dashboard
   * Suporta filtros: period, product
   */
  @Get('stats')
  async getStats(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query(new ZodValidationPipe(DashboardFiltersSchema))
    filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getStats(userId, userRole, filters);
  }

  /**
   * ✅ v2.48.0: GET /dashboard/leads/paginated
   * Busca leads paginados para expansão do card
   */
  @Get('leads/paginated')
  async getPaginatedLeads(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQueryDto,
  ) {
    return this.dashboardService.getPaginatedLeads(
      userId,
      userRole,
      query.page,
      query.limit,
    );
  }

  /**
   * ✅ v2.48.0: GET /dashboard/clients/paginated
   * Busca clientes paginados para expansão do card
   */
  @Get('clients/paginated')
  async getPaginatedClients(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQueryDto,
  ) {
    return this.dashboardService.getPaginatedClients(
      userId,
      userRole,
      query.page,
      query.limit,
    );
  }

  /**
   * ✅ v2.48.0: GET /dashboard/payments/paginated
   * Busca próximos vencimentos paginados para expansão do card
   */
  @Get('payments/paginated')
  async getPaginatedUpcomingPayments(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQueryDto,
  ) {
    return this.dashboardService.getPaginatedUpcomingPayments(
      userId,
      userRole,
      query.page,
      query.limit,
    );
  }

  /**
   * ✅ v2.49.0: GET /dashboard/insights
   * Gera insights de IA baseados nas métricas do dashboard
   * Suporta filtros: period, product
   */
  @Get('insights')
  async getInsights(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query(new ZodValidationPipe(DashboardFiltersSchema))
    filters: DashboardFiltersDto,
  ): Promise<GenerateInsightsResponseDto> {
    return this.dashboardService.generateInsights(userId, userRole, filters);
  }

}
