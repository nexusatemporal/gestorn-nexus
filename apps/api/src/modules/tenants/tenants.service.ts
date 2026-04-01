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
import { OneNexusService, OneNexusModuleTree } from '../integrations/one-nexus/one-nexus.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly oneNexusService: OneNexusService,
  ) {}

  /**
   * Provisiona o tenant do cliente no One Nexus.
   * Cria o registro Tenant local (PENDING) e chama a API do One Nexus.
   * Em caso de falha, salva o erro mas não interrompe o fluxo do cliente.
   */
  async provisionOnOneNexus(clientId: string): Promise<void> {
    // Buscar client com dados necessários (incluindo módulos do plano)
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        plan: { select: { name: true, code: true, includedModules: true } },
        vendedor: { select: { name: true } },
      },
    });

    if (!client) {
      this.logger.warn(`[OneNexus] Cliente ${clientId} não encontrado para provisioning`);
      return;
    }

    // Garantir que o Tenant local existe (pode já ter sido criado na conversão)
    let tenant = await this.prisma.tenant.findUnique({ where: { clientId } });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          clientId,
          name: client.company,
          provisioningStatus: 'PENDING',
        },
      });
    }

    // Só provisionar se ainda está PENDING ou FAILED
    if (tenant.provisioningStatus === 'PROVISIONED') {
      this.logger.log(`[OneNexus] Tenant ${tenant.id} já provisionado, ignorando`);
      return;
    }

    const slug = OneNexusService.buildSlug(client.company);

    // Payload de provisioning (extraído para reutilizar na Camada 3)
    const provisionPayload = {
      name: client.company,
      slug,
      ownerName: client.contactName,
      ownerEmail: client.email,
      ownerPhone: client.phone || undefined,
      planId: client.plan?.code || undefined,
      billingEmail: client.email,
      taxId: client.cpfCnpj && client.cpfCnpj !== 'PENDING' ? client.cpfCnpj : undefined,
      country: 'BR',
    };

    // Camada 1: Chamar API do One Nexus com slug original
    const result = await this.oneNexusService.provision(provisionPayload);

    if (result) {
      // Sucesso: salvar tenantUuid e marcar como PROVISIONED
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          tenantUuid: result.tenant.id,
          provisioningStatus: 'PROVISIONED',
          provisioningError: null,
        },
      });

      this.logger.log(
        `[OneNexus] ✅ Tenant provisionado: ${client.company} | ` +
        `ID: ${result.tenant.id} | Schema: ${result.tenant.schemaName}`,
      );

      // ✅ Aplicar módulos do plano automaticamente (fire-and-forget)
      await this.applyPlanModules(result.tenant.id, client.plan?.includedModules, client.company);
    } else {
      // Falha na resposta — mas o tenant PODE ter sido criado no One Nexus (ex: 502 Bad Gateway).
      // Camada 2: Tentar recovery: buscar pelo slug para recuperar o UUID.
      this.logger.warn(
        `[OneNexus] ⚠️ Provisioning retornou null para ${client.company}. Tentando recovery por slug...`,
      );

      const recovered = await this.oneNexusService.findBySlug(slug);

      if (recovered) {
        // Recovery: tenant existe no One Nexus — salvar UUID e marcar como PROVISIONED
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            tenantUuid: recovered.id,
            provisioningStatus: 'PROVISIONED',
            provisioningError: null,
          },
        });

        this.logger.log(
          `[OneNexus] ✅ Recovery bem-sucedido: ${client.company} | ` +
          `UUID recuperado: ${recovered.id} (encontrado via slug '${slug}')`,
        );

        // ✅ Aplicar módulos do plano automaticamente (fire-and-forget)
        await this.applyPlanModules(recovered.id, client.plan?.includedModules, client.company);
      } else {
        // Camada 3: Slug pode ter conflito com tenant soft-deleted (schema órfão).
        // Tentar provisionar com slug alternativo único.
        const uniqueSuffix = Date.now().toString(36).slice(-5);
        const uniqueSlug = `${slug}-${uniqueSuffix}`.substring(0, 50);

        this.logger.warn(
          `[OneNexus] ⚠️ Tentando slug alternativo: ${uniqueSlug} (original '${slug}' pode ter conflito com tenant soft-deleted)`,
        );

        const retryResult = await this.oneNexusService.provision({
          ...provisionPayload,
          slug: uniqueSlug,
        });

        if (retryResult) {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              tenantUuid: retryResult.tenant.id,
              provisioningStatus: 'PROVISIONED',
              provisioningError: null,
            },
          });

          this.logger.log(
            `[OneNexus] ✅ Tenant provisionado com slug alternativo: ${client.company} | ` +
            `ID: ${retryResult.tenant.id} | Slug: ${uniqueSlug}`,
          );

          await this.applyPlanModules(retryResult.tenant.id, client.plan?.includedModules, client.company);
        } else {
          // Falha real — API One Nexus indisponível
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              provisioningStatus: 'FAILED',
              provisioningError: 'Falha ao comunicar com a API do One Nexus. Tentativas com slug original e alternativo falharam.',
            },
          });

          this.logger.warn(
            `[OneNexus] ⚠️ Provisioning falhou para ${client.company} com slug original e alternativo. ` +
            `Cliente criado normalmente no Gestor. Provisione manualmente.`,
          );
        }
      }
    }
  }

  /**
   * Aplica os módulos inclusos do plano ao tenant no One Nexus.
   * Fire-and-forget: se falhar, loga warning mas não interrompe o fluxo.
   * Pior caso = comportamento atual (admin configura manualmente).
   */
  private async applyPlanModules(
    oneNexusTenantId: string,
    includedModules: unknown,
    companyName: string,
  ): Promise<void> {
    // includedModules é Json no Prisma — pode ser qualquer coisa
    if (!Array.isArray(includedModules) || includedModules.length === 0) {
      this.logger.log(`[OneNexus] Plano sem módulos configurados para ${companyName} — usando padrão do One Nexus`);
      return;
    }

    try {
      // Buscar árvore atual para saber quais módulos existem
      const tree = await this.oneNexusService.getModulesTree(oneNexusTenantId);
      if (!tree) {
        this.logger.warn(`[OneNexus] ⚠️ Não foi possível buscar árvore de módulos para ${companyName}`);
        return;
      }

      // Montar lista de toggles: habilitar os do plano, desabilitar o resto
      const validModuleIds = (includedModules as unknown[]).filter((m): m is string => typeof m === 'string');
      const selectedIds = new Set(validModuleIds);
      const toggles: { moduleId: string; isEnabled: boolean }[] = [];

      for (const parent of tree) {
        toggles.push({ moduleId: parent.id, isEnabled: selectedIds.has(parent.id) });
        for (const child of parent.children) {
          toggles.push({ moduleId: child.id, isEnabled: selectedIds.has(child.id) });
        }
      }

      const result = await this.oneNexusService.toggleModules(oneNexusTenantId, toggles);

      if (result.success) {
        const enabledCount = toggles.filter((t) => t.isEnabled).length;
        this.logger.log(
          `[OneNexus] ✅ Módulos do plano aplicados: ${companyName} | ` +
          `${enabledCount}/${toggles.length} habilitados`,
        );
        if (result.skipped.length > 0) {
          this.logger.warn(
            `[OneNexus] ⚠️ ${result.skipped.length} módulo(s) core ignorados: ${result.skipped.map((s) => s.slug).join(', ')}`,
          );
        }
      } else {
        this.logger.warn(
          `[OneNexus] ⚠️ Falha ao aplicar módulos do plano para ${companyName}. ` +
          `Configurar manualmente na aba Módulos do cliente.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[OneNexus] ⚠️ Erro ao aplicar módulos do plano para ${companyName}: ` +
        `${error?.message || 'Erro desconhecido'}. Configurar manualmente.`,
      );
    }
  }

  /**
   * Retenta o provisioning de um tenant com status FAILED.
   * Reseta para PENDING e re-executa provisionOnOneNexus().
   */
  async retryProvision(
    tenantId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { id: true, vendedorId: true } } },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    await this.validateAccess(tenant.client?.vendedorId ?? null, currentUserId, currentUserRole);

    if (tenant.provisioningStatus === 'PROVISIONED') {
      return { message: 'Tenant já está provisionado', tenant };
    }

    // Resetar para PENDING antes de chamar provisionOnOneNexus
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { provisioningStatus: 'PENDING', provisioningError: null },
    });

    await this.provisionOnOneNexus(tenant.client.id);

    // Verificar status final — lançar erro se ainda FAILED
    const updated = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { id: true, company: true } } },
    });

    if (updated?.provisioningStatus === 'FAILED') {
      throw new BadRequestException(
        updated.provisioningError || 'Provisioning falhou. Verifique a conexão com o One Nexus.',
      );
    }

    return updated;
  }

  /**
   * Deleta o tenant no One Nexus antes do cascade delete no Gestor.
   * DEVE ser chamado ANTES do prisma.client.delete() para não perder o tenantUuid.
   * Graceful degradation: erros são logados, não interrompem o fluxo.
   */
  async deleteOnOneNexus(tenantUuid: string): Promise<void> {
    try {
      await this.oneNexusService.delete(tenantUuid);
    } catch (error) {
      this.logger.error(`[OneNexus] Erro ao deletar tenant ${tenantUuid}: ${error.message}`);
    }
  }

  /**
   * Sincroniza o status do tenant no One Nexus baseado no status do cliente.
   * Graceful degradation: erros são logados, não interrompem o fluxo.
   */
  async syncStatusToOneNexus(clientId: string, targetStatus: 'active' | 'suspended' | 'canceled'): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { clientId },
        select: { tenantUuid: true, provisioningStatus: true },
      });

      if (!tenant?.tenantUuid || tenant.provisioningStatus !== 'PROVISIONED') return;

      await this.oneNexusService.updateStatus(tenant.tenantUuid, targetStatus);
    } catch (error) {
      this.logger.error(`[OneNexus] Erro ao sincronizar status para clientId ${clientId}: ${error.message}`);
    }
  }

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

    // Sincronizar status com One Nexus (graceful degradation)
    if (tenant.tenantUuid && tenant.provisioningStatus === 'PROVISIONED') {
      await this.oneNexusService.updateStatus(tenant.tenantUuid, 'suspended').catch((err) =>
        this.logger.error(`[OneNexus] Falha ao sincronizar suspend para ${tenant.tenantUuid}: ${err.message}`),
      );
    }

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

    // Sincronizar status com One Nexus (graceful degradation)
    if (tenant.tenantUuid && tenant.provisioningStatus === 'PROVISIONED') {
      await this.oneNexusService.updateStatus(tenant.tenantUuid, 'active').catch((err) =>
        this.logger.error(`[OneNexus] Falha ao sincronizar activate para ${tenant.tenantUuid}: ${err.message}`),
      );
    }

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

    // Sincronizar status com One Nexus (graceful degradation — 'suspended' = bloqueado)
    if (tenant.tenantUuid && tenant.provisioningStatus === 'PROVISIONED') {
      await this.oneNexusService.updateStatus(tenant.tenantUuid, 'suspended').catch((err) =>
        this.logger.error(`[OneNexus] Falha ao sincronizar block para ${tenant.tenantUuid}: ${err.message}`),
      );
    }

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

    // Sincronizar status com One Nexus (graceful degradation)
    if (tenant.tenantUuid && tenant.provisioningStatus === 'PROVISIONED') {
      await this.oneNexusService.updateStatus(tenant.tenantUuid, 'canceled').catch((err) =>
        this.logger.error(`[OneNexus] Falha ao sincronizar delete para ${tenant.tenantUuid}: ${err.message}`),
      );
    }

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

  /**
   * Retorna lista de módulos disponíveis do One Nexus.
   * Tenta buscar da API; usa lista padrão como fallback.
   */
  async getAvailableModules() {
    return this.oneNexusService.getModules();
  }

  /**
   * Atualiza os módulos habilitados de um tenant.
   * 1. Salva em Tenant.enabledModules no Gestor
   * 2. Sincroniza com One Nexus (graceful: erro logado, não lança)
   */
  async updateEnabledModules(
    tenantId: string,
    modules: string[],
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { vendedorId: true } } },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);

    await this.validateAccess(tenant.client?.vendedorId ?? null, currentUserId, currentUserRole);

    // Salvar localmente
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { enabledModules: modules },
    });

    this.logger.log(
      `✅ Módulos atualizados localmente: tenant ${tenantId} → [${modules.join(', ')}]`,
    );

    // Sincronizar com One Nexus (graceful)
    if (tenant.tenantUuid) {
      const synced = await this.oneNexusService.updateModules(tenant.tenantUuid, modules);
      if (!synced) {
        this.logger.warn(
          `[OneNexus] ⚠️ Módulos salvos no Gestor mas falha ao sincronizar com One Nexus (tenant ${tenant.tenantUuid})`,
        );
      }
    } else {
      this.logger.log(`[OneNexus] Tenant ${tenantId} não provisionado — módulos salvos apenas localmente`);
    }

    return updated;
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULOS V3 — Hierárquicos
  // ════════════════════════════════════════════════════════════════

  /**
   * Retorna a árvore hierárquica de módulos do tenant.
   * Requer tenant provisionado com tenantUuid.
   */
  async getModulesTree(
    tenantId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<OneNexusModuleTree[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { vendedorId: true } } },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    await this.validateAccess(tenant.client?.vendedorId ?? null, currentUserId, currentUserRole);

    if (!tenant.tenantUuid) {
      throw new BadRequestException('Tenant não provisionado no One Nexus — tenantUuid ausente');
    }

    const tree = await this.oneNexusService.getModulesTree(tenant.tenantUuid);
    if (!tree) {
      throw new BadRequestException('Não foi possível buscar módulos do One Nexus');
    }

    // Desbloquear "Configurações" (settings) — permitir toggle no Gestor
    for (const mod of tree) {
      if (mod.slug === 'settings') {
        mod.isCore = false;
      }
    }

    return tree;
  }

  /**
   * Toggle individual de módulos com cascata (V3 API).
   * Envia para One Nexus que aplica as regras de cascata automaticamente.
   */
  async toggleModules(
    tenantId: string,
    modules: { moduleId: string; isEnabled: boolean }[],
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<{ success: boolean; skipped?: { moduleId: string; slug: string; reason: string }[] }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { vendedorId: true } } },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    await this.validateAccess(tenant.client?.vendedorId ?? null, currentUserId, currentUserRole);

    if (!tenant.tenantUuid) {
      throw new BadRequestException('Tenant não provisionado no One Nexus');
    }

    const result = await this.oneNexusService.toggleModules(tenant.tenantUuid, modules);
    if (!result.success) {
      throw new BadRequestException('Falha ao atualizar módulos no One Nexus');
    }
    return { success: true, skipped: result.skipped };
  }

  /**
   * Habilita todos os 77 módulos do tenant.
   */
  async enableAllModules(
    tenantId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<{ success: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { vendedorId: true } } },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    await this.validateAccess(tenant.client?.vendedorId ?? null, currentUserId, currentUserRole);

    if (!tenant.tenantUuid) {
      throw new BadRequestException('Tenant não provisionado no One Nexus');
    }

    const ok = await this.oneNexusService.enableAllModules(tenant.tenantUuid);
    if (!ok) {
      throw new BadRequestException('Falha ao habilitar todos os módulos no One Nexus');
    }
    return { success: true };
  }

  /**
   * Aplica preset de módulos ao tenant.
   * Presets: all, basic, clinical, business, enterprise, none
   */
  async applyModulePreset(
    tenantId: string,
    preset: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<{ success: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { client: { select: { vendedorId: true } } },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    await this.validateAccess(tenant.client?.vendedorId ?? null, currentUserId, currentUserRole);

    if (!tenant.tenantUuid) {
      throw new BadRequestException('Tenant não provisionado no One Nexus');
    }

    const validPresets = ['all', 'basic', 'clinical', 'business', 'enterprise', 'none'];
    if (!validPresets.includes(preset)) {
      throw new BadRequestException(`Preset inválido. Válidos: ${validPresets.join(', ')}`);
    }

    const ok = await this.oneNexusService.applyPreset(tenant.tenantUuid, preset);
    if (!ok) {
      throw new BadRequestException(`Falha ao aplicar preset '${preset}' no One Nexus`);
    }
    return { success: true };
  }
}
