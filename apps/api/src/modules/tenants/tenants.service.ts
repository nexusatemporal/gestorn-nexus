import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UserRole, TenantStatus } from '@prisma/client';

/**
 * Tenants Service
 * Gerencia tenants (instâncias) dos sistemas One Nexus e Locadoras
 *
 * REGRAS DE ACESSO:
 * - SUPERADMIN/DESENVOLVEDOR: Acesso total
 * - ADMINISTRATIVO: Apenas visualização
 * - GESTOR/VENDEDOR: Visualização apenas dos tenants da sua equipe
 *
 * RELACIONAMENTO:
 * - Relacionamento 1:1 com Client (clientId único)
 * - Cada cliente tem no máximo 1 tenant
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listar tenants (com scoping por role)
   */
  async findAll(params: {
    currentUserId: string;
    currentUserRole: UserRole;
    status?: TenantStatus;
    vpsLocation?: string;
  }) {
    const { currentUserId, currentUserRole, status, vpsLocation } = params;

    // Construir filtros baseado na role
    const where: any = {
      status,
      vpsLocation,
    };

    // GESTOR/VENDEDOR: Ver apenas tenants dos clientes da sua equipe
    if (currentUserRole === UserRole.GESTOR || currentUserRole === UserRole.VENDEDOR) {
      // Buscar clientes do usuário ou da equipe
      const clientWhere: any = {};

      if (currentUserRole === UserRole.GESTOR) {
        const vendedores = await this.prisma.user.findMany({
          where: { gestorId: currentUserId },
          select: { id: true },
        });

        const vendedorIds = vendedores.map((v) => v.id);
        vendedorIds.push(currentUserId);

        clientWhere.vendedorId = { in: vendedorIds };
      } else {
        // VENDEDOR: apenas seus clientes
        clientWhere.vendedorId = currentUserId;
      }

      where.client = clientWhere;
    }

    return this.prisma.tenant.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            company: true,
            contactName: true,
            email: true,
            productType: true,
            status: true,
            vendedor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            plan: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Buscar tenant por ID (com validação de acesso)
   */
  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            vendedor: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            plan: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    // Validar acesso
    await this.validateAccess(tenant.client.vendedorId, currentUserId, currentUserRole);

    return tenant;
  }

  /**
   * Buscar tenant por Client ID
   */
  async findByClientId(clientId: string, currentUserId: string, currentUserRole: UserRole) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { clientId },
      include: {
        client: {
          include: {
            vendedor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            plan: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant do cliente ${clientId} não encontrado`);
    }

    // Validar acesso
    await this.validateAccess(tenant.client.vendedorId, currentUserId, currentUserRole);

    return tenant;
  }

  /**
   * Buscar tenant por UUID no sistema destino
   */
  async findByTenantUuid(
    tenantUuid: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { tenantUuid },
      include: {
        client: {
          include: {
            vendedor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant com UUID ${tenantUuid} não encontrado`);
    }

    // Validar acesso
    await this.validateAccess(tenant.client.vendedorId, currentUserId, currentUserRole);

    return tenant;
  }

  /**
   * Criar tenant
   */
  async create(dto: CreateTenantDto, currentUserId: string, currentUserRole: UserRole) {
    // Apenas SUPERADMIN e DESENVOLVEDOR podem criar tenants
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.DESENVOLVEDOR
    ) {
      throw new ForbiddenException('Apenas administradores podem criar tenants');
    }

    // Verificar se cliente existe
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      include: {
        vendedor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${dto.clientId} não encontrado`);
    }

    // Verificar se cliente já tem tenant
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { clientId: dto.clientId },
    });

    if (existingTenant) {
      throw new ConflictException(`Cliente ${dto.clientId} já possui um tenant`);
    }

    // Verificar se tenantUuid já existe
    const existingTenantUuid = await this.prisma.tenant.findUnique({
      where: { tenantUuid: dto.tenantUuid },
    });

    if (existingTenantUuid) {
      throw new ConflictException(`Tenant UUID ${dto.tenantUuid} já existe`);
    }

    // Criar tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        ...dto,
        name: client.company, // Nome do tenant é o nome da empresa
        enabledModules: dto.enabledModules || [],
      },
      include: {
        client: {
          select: {
            id: true,
            company: true,
            contactName: true,
            productType: true,
          },
        },
      },
    });

    this.logger.log(
      `✅ Tenant criado: ${tenant.systemUrl} - Cliente: ${client.company} (${client.contactName})`,
    );

    return tenant;
  }

  /**
   * Atualizar tenant (com validação de acesso)
   */
  async update(
    id: string,
    dto: UpdateTenantDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // Apenas SUPERADMIN e DESENVOLVEDOR podem atualizar tenants
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.DESENVOLVEDOR
    ) {
      throw new ForbiddenException('Apenas administradores podem atualizar tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            company: true,
            contactName: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    // Tenant DELETADO não pode ser editado
    if (tenant.status === TenantStatus.DELETADO) {
      throw new BadRequestException('Tenant deletado não pode ser editado');
    }

    // Apenas SUPERADMIN pode marcar como DELETADO
    if (dto.status === TenantStatus.DELETADO && currentUserRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Apenas SUPERADMIN pode deletar tenants');
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: dto,
      include: {
        client: {
          select: {
            id: true,
            company: true,
            contactName: true,
          },
        },
      },
    });

    this.logger.log(
      `✅ Tenant atualizado: ${updated.systemUrl} - Cliente: ${tenant.client.company}`,
    );

    return updated;
  }

  /**
   * Suspender tenant
   */
  async suspend(id: string, currentUserId: string, currentUserRole: UserRole) {
    // Apenas SUPERADMIN e DESENVOLVEDOR podem suspender
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.DESENVOLVEDOR
    ) {
      throw new ForbiddenException('Apenas administradores podem suspender tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            company: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENSO },
    });

    this.logger.warn(
      `⚠️ Tenant suspenso: ${tenant.systemUrl} - Cliente: ${tenant.client.company}`,
    );

    return updated;
  }

  /**
   * Ativar tenant
   */
  async activate(id: string, currentUserId: string, currentUserRole: UserRole) {
    // Apenas SUPERADMIN e DESENVOLVEDOR podem ativar
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.DESENVOLVEDOR
    ) {
      throw new ForbiddenException('Apenas administradores podem ativar tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            company: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ATIVO },
    });

    this.logger.log(
      `✅ Tenant ativado: ${tenant.systemUrl} - Cliente: ${tenant.client.company}`,
    );

    return updated;
  }

  /**
   * Bloquear tenant (por inadimplência)
   */
  async block(id: string, currentUserId: string, currentUserRole: UserRole) {
    // Apenas SUPERADMIN e ADMINISTRATIVO podem bloquear
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem bloquear tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            company: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.BLOQUEADO },
    });

    this.logger.warn(
      `⚠️ Tenant bloqueado: ${tenant.systemUrl} - Cliente: ${tenant.client.company}`,
    );

    return updated;
  }

  /**
   * Deletar tenant (soft delete - marca como DELETADO)
   */
  async delete(id: string, currentUserId: string, currentUserRole: UserRole) {
    // Apenas SUPERADMIN pode deletar
    if (currentUserRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Apenas SUPERADMIN pode deletar tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            company: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.DELETADO },
    });

    this.logger.warn(
      `⚠️ Tenant deletado: ${tenant.systemUrl} - Cliente: ${tenant.client.company}`,
    );

    return updated;
  }

  /**
   * Atualizar métricas do tenant (activeUsers, storageUsedMb, lastAccessAt)
   */
  async updateMetrics(
    id: string,
    metrics: {
      activeUsers?: number;
      storageUsedMb?: number;
      lastAccessAt?: Date;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} não encontrado`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: metrics,
    });

    this.logger.log(`✅ Métricas atualizadas: ${tenant.systemUrl}`);

    return updated;
  }

  /**
   * Helper: Validar acesso a um tenant
   */
  private async validateAccess(
    clientVendedorId: string | null,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // SUPERADMIN, ADMINISTRATIVO e DESENVOLVEDOR têm acesso total
    if (
      currentUserRole === UserRole.SUPERADMIN ||
      currentUserRole === UserRole.ADMINISTRATIVO ||
      currentUserRole === UserRole.DESENVOLVEDOR
    ) {
      return;
    }

    // Se cliente não tem vendedor, apenas admins podem acessar
    if (!clientVendedorId) {
      throw new ForbiddenException('Você não tem permissão para acessar este tenant');
    }

    // GESTOR pode acessar tenants dos clientes da sua equipe
    if (currentUserRole === UserRole.GESTOR) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: clientVendedorId },
      });

      if (vendedor && (vendedor.gestorId === currentUserId || clientVendedorId === currentUserId)) {
        return;
      }
    }

    // VENDEDOR pode acessar apenas tenants dos seus próprios clientes
    if (clientVendedorId === currentUserId) {
      return;
    }

    throw new ForbiddenException('Você não tem permissão para acessar este tenant');
  }
}
