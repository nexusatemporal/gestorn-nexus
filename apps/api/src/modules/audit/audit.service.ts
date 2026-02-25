import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueryAuditDto, CreateAuditLogDto } from './dto/query-audit.dto';
import { UserRole } from '@prisma/client';

/**
 * Audit Service
 * Gerencia logs de auditoria do sistema
 *
 * REGRAS:
 * - SUPERADMIN: Pode ver todos os logs
 * - ADMINISTRATIVO: Pode ver todos os logs
 * - DESENVOLVEDOR: Pode ver todos os logs (para debugging)
 * - GESTOR/VENDEDOR: Não têm acesso aos logs
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Criar log de auditoria
   * Método usado internamente por outros serviços
   */
  async log(dto: CreateAuditLogDto) {
    try {
      const log = await this.prisma.auditLog.create({
        data: dto,
      });
      this.logger.debug(`📝 Audit log created: ${dto.action} on ${dto.entity}:${dto.entityId}`);
      return log;
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
      // Não lançar erro - auditoria não deve bloquear operações
      return null;
    }
  }

  /**
   * Listar logs de auditoria (com filtros)
   */
  async findAll(query: QueryAuditDto, currentUserRole: UserRole) {
    // Apenas SUPERADMIN, ADMINISTRATIVO e DESENVOLVEDOR podem ver logs
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO &&
      currentUserRole !== UserRole.DESENVOLVEDOR
    ) {
      return {
        data: [],
        meta: { total: 0, page: query.page, limit: query.limit, totalPages: 0 },
      };
    }

    const { page, limit, userId, action, entity, entityId, startDate, endDate, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar log específico por ID
   */
  async findOne(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Listar logs de impersonate
   */
  async findImpersonateLogs(currentUserRole: UserRole) {
    // Apenas SUPERADMIN e DESENVOLVEDOR podem ver logs de impersonate
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.DESENVOLVEDOR
    ) {
      return [];
    }

    return this.prisma.impersonateLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        client: {
          select: {
            id: true,
            contactName: true,
            company: true,
          },
        },
      },
    });
  }

  /**
   * Exportar logs para CSV
   */
  async export(query: QueryAuditDto, currentUserRole: UserRole): Promise<string> {
    const { data } = await this.findAll({ ...query, limit: 10000 }, currentUserRole);

    // Gerar CSV
    const headers = ['Data', 'Usuário', 'Ação', 'Entidade', 'ID da Entidade', 'IP'];
    const rows = data.map((log) => [
      log.createdAt.toISOString(),
      log.user?.name || 'Sistema',
      log.action,
      log.entity,
      log.entityId,
      log.ipAddress || '-',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    return csv;
  }
}
