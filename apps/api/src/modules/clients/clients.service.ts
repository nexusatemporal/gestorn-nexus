import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionService } from '../subscriptions/subscriptions.service'; // v2.46.0
import { TenantsService } from '../tenants/tenants.service';
import { OneNexusService } from '../integrations/one-nexus/one-nexus.service';
import { AuthUser } from '@/common/interfaces/auth-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UserRole, ClientStatus, ProductType, LeadStatus } from '@prisma/client';

/**
 * Clients Service
 * Gerencia clientes ativos do sistema com controle de acesso baseado em roles
 *
 * REGRAS DE ACESSO:
 * - SUPERADMIN/ADMINISTRATIVO: Acesso total a todos os clientes
 * - GESTOR: Acesso aos clientes da sua equipe (vendedores vinculados)
 * - VENDEDOR: Acesso apenas aos seus próprios clientes
 *
 * CONVERSÃO DE LEAD:
 * - Ao criar cliente a partir de lead (leadId), marca lead como GANHO
 * - Valida se lead pertence ao vendedor
 */
@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService, // v2.46.0
    private readonly tenantsService: TenantsService,
    private readonly oneNexusService: OneNexusService,
  ) {}

  /**
   * Listar clientes (com scoping por role)
   */
  async findAll(params: {
    currentUserId: string;
    currentUserRole: UserRole;
    status?: ClientStatus;
    productType?: ProductType;
    vendedorId?: string;
  }) {
    const { currentUserId, currentUserRole, status, productType, vendedorId } = params;

    // Validar permissão granular por módulo (se productType especificado)
    if (productType) {
      const hasPermission = await this.checkModulePermission(
        currentUserId,
        productType,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Você não tem permissão para acessar clientes de ${productType}`,
        );
      }
    }

    // Construir filtros baseado na role
    const where: any = {
      status,
      productType,
    };

    // GESTOR: Ver apenas clientes da sua equipe
    if (currentUserRole === UserRole.GESTOR) {
      // Buscar vendedores do gestor
      const vendedores = await this.prisma.user.findMany({
        where: { gestorId: currentUserId },
        select: { id: true },
      });

      const vendedorIds = vendedores.map((v) => v.id);
      vendedorIds.push(currentUserId); // Incluir clientes do próprio gestor

      where.vendedorId = { in: vendedorIds };

      // Se filtrou por vendedorId, validar se pertence à equipe
      if (vendedorId && !vendedorIds.includes(vendedorId)) {
        throw new ForbiddenException('Você não tem acesso aos clientes deste vendedor');
      }
    }

    // VENDEDOR: Ver apenas seus próprios clientes
    if (currentUserRole === UserRole.VENDEDOR) {
      where.vendedorId = currentUserId;

      // Ignorar filtro de vendedorId se não for o próprio
      if (vendedorId && vendedorId !== currentUserId) {
        throw new ForbiddenException('Você só pode visualizar seus próprios clientes');
      }
    }

    // SUPERADMIN/ADMINISTRATIVO podem filtrar por vendedorId livremente
    if (
      (currentUserRole === UserRole.SUPERADMIN ||
        currentUserRole === UserRole.ADMINISTRATIVO) &&
      vendedorId
    ) {
      where.vendedorId = vendedorId;
    }

    const clients = await this.prisma.client.findMany({
      where,
      include: {
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
            priceMonthly: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            systemUrl: true,
          },
        },
        _count: {
          select: {
            payments: true,
          },
        },
        // ✅ v2.46.0: Incluir subscriptions ativas para obter billingAnchorDay
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'TRIALING'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            billingAnchorDay: true,
            nextBillingDate: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ✅ v2.39.0: Calcular nextDueDate (próximo vencimento) para cada cliente
    const clientsWithNextDueDate = await Promise.all(
      clients.map(async (client) => ({
        ...client,
        nextDueDate: await this.calculateNextDueDate(client),
      })),
    );

    return clientsWithNextDueDate;
  }

  /**
   * Buscar cliente por ID (com validação de acesso)
   */
  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        vendedor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            gestor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        plan: true,
        tenant: true,
        payments: {
          orderBy: { dueDate: 'desc' },
          take: 10,
        },
        // ✅ v2.46.0: Incluir subscriptions ativas para obter billingAnchorDay
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'TRIALING'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            billingAnchorDay: true,
            nextBillingDate: true,
            status: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }

    // Validar acesso
    await this.validateAccess(client.vendedorId, currentUserId, currentUserRole);

    // ✅ v2.39.0: Adicionar nextDueDate ao retorno
    return {
      ...client,
      nextDueDate: await this.calculateNextDueDate(client),
    };
  }

  /**
   * Buscar cliente por CPF/CNPJ
   */
  async findByCpfCnpj(cpfCnpj: string, currentUserId: string, currentUserRole: UserRole) {
    const client = await this.prisma.client.findFirst({
      where: {
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        status: { not: 'CANCELADO' as any },
      },
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
    });

    if (!client) {
      throw new NotFoundException(`Cliente com CPF/CNPJ ${cpfCnpj} não encontrado`);
    }

    // Validar acesso
    await this.validateAccess(client.vendedorId, currentUserId, currentUserRole);

    // ✅ v2.39.0: Adicionar nextDueDate ao retorno
    return {
      ...client,
      nextDueDate: await this.calculateNextDueDate(client),
    };
  }

  /**
   * Criar cliente
   */
  async create(dto: CreateClientDto, currentUserId: string, currentUserRole: UserRole) {
    // VENDEDOR sempre cria cliente para si mesmo
    if (currentUserRole === UserRole.VENDEDOR) {
      dto.vendedorId = currentUserId;
    }

    // ✅ v2.45.0: Se vendedorId não foi fornecido, atribuir ao usuário logado
    if (!dto.vendedorId) {
      dto.vendedorId = currentUserId;
    }

    // GESTOR pode criar cliente para seus vendedores
    if (currentUserRole === UserRole.GESTOR) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: dto.vendedorId },
      });

      if (!vendedor) {
        throw new NotFoundException(`Vendedor ${dto.vendedorId} não encontrado`);
      }

      if (vendedor.gestorId !== currentUserId && dto.vendedorId !== currentUserId) {
        throw new ForbiddenException('Você só pode criar clientes para sua equipe');
      }
    }

    // Verificar se CPF/CNPJ já existe (ignora clientes CANCELADOS — podem ser recriados)
    const existingCpfCnpj = await this.prisma.client.findFirst({
      where: {
        cpfCnpj: dto.cpfCnpj,
        status: { not: 'CANCELADO' as any },
      },
    });

    if (existingCpfCnpj) {
      throw new ConflictException(`Cliente com CPF/CNPJ ${dto.cpfCnpj} já existe`);
    }

    // Validar vendedor
    const vendedor = await this.prisma.user.findUnique({
      where: { id: dto.vendedorId },
    });

    if (!vendedor || !vendedor.isActive) {
      throw new BadRequestException('Vendedor inválido ou inativo');
    }

    // Validar plano
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plano ${dto.planId} não encontrado`);
    }

    if (!plan.isActive) {
      throw new BadRequestException('Plano inativo não pode ser atribuído');
    }

    // Validar produto do plano vs cliente
    if (plan.product !== dto.productType) {
      throw new BadRequestException(
        `Plano ${plan.name} é para ${plan.product}, mas cliente é para ${dto.productType}`,
      );
    }

    // Se veio de um lead, validar e marcar como convertido
    if (dto.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
      });

      if (!lead) {
        throw new NotFoundException(`Lead ${dto.leadId} não encontrado`);
      }

      // Validar se lead pertence ao vendedor (ou à equipe do gestor/admin)
      if (lead.vendedorId) {
        await this.validateAccess(lead.vendedorId, currentUserId, currentUserRole);
      }

      // Verificar se lead já foi convertido
      if (lead.status === LeadStatus.GANHO && lead.convertedAt) {
        // Verificar se já existe cliente com este lead
        const existingClient = await this.prisma.client.findFirst({
          where: { leadId: dto.leadId },
        });

        if (existingClient) {
          throw new ConflictException(`Lead ${dto.leadId} já foi convertido em cliente`);
        }
      }
    }

    // Criar cliente em transação (incluindo atualização do lead)
    // ✅ v2.63.2: Try-catch externo para capturar P2002 de race conditions (double submit)
    let client: any;
    try {
    client = await this.prisma.$transaction(async (tx) => {
      // Criar cliente
      // ✅ v2.60.0: Extrair billingAnchorDay antes de passar ao Prisma (campo pertence à Subscription, não ao Client)
      const { billingAnchorDay: _billingAnchorDay, ...clientData } = dto as any;
      const newClient = await tx.client.create({
        data: clientData,
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
      });

      // ═══════════════════════════════════════════════════════════════════
      // v2.46.0: CRIAR SUBSCRIPTION (Billing Lifecycle Onda 1)
      // ═══════════════════════════════════════════════════════════════════

      const plan = newClient.plan; // Plan já incluído no query

      // ✅ v2.46.0: Prioriza billingAnchorDay do frontend, fallback para firstPaymentDate
      const anchorDay = dto.billingAnchorDay
        ?? (dto.firstPaymentDate ? new Date(dto.firstPaymentDate).getDate() : new Date().getDate());
      const safeBillingAnchorDay = Math.min(Math.max(anchorDay, 1), 28);

      // Construir firstPaymentDate usando billingAnchorDay
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const firstPaymentDateStr = `${year}-${String(month).padStart(2, '0')}-${String(safeBillingAnchorDay).padStart(2, '0')}`;
      const firstPaymentDate = new Date(`${firstPaymentDateStr}T12:00:00.000Z`); // Para cálculo de nextDueDate

      // Calcular MRR baseado no billing cycle
      const monthlyAmount = Number(plan.priceMonthly);
      const subscriptionAmount = dto.billingCycle === 'ANNUAL'
        ? monthlyAmount * 0.9  // 10% desconto para anual
        : monthlyAmount;

      const subscription = await this.subscriptionService.createFromConversion(
        {
          clientId: newClient.id,
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          firstPaymentDate: firstPaymentDateStr,
          amount: subscriptionAmount,
        },
        tx, // Pass transaction context
      );

      this.logger.log(
        `✅ Subscription criada: ${subscription.id} | ` +
        `Cliente: ${newClient.company} | ` +
        `Anchor: dia ${subscription.billingAnchorDay} | ` +
        `Próximo billing: ${subscription.nextBillingDate?.toISOString().split('T')[0] || 'N/A'}`,
      );

      // ═══════════════════════════════════════════════════════════════════
      // v2.45.3: CRIAR FINANCE TRANSACTION AUTOMATICAMENTE
      // Integra o cliente no módulo financeiro para MRR tracking
      // (Mesma lógica do LeadsService.convert() para consistência)
      // ═══════════════════════════════════════════════════════════════════

      // Calcular MRR baseado no billing cycle (mesma lógica do frontend)
      const calculatedMRR =
        dto.billingCycle === 'ANNUAL'
          ? Number(plan.priceMonthly) * 0.9 // 10% desconto para anual
          : Number(plan.priceMonthly);

      // ✅ v2.46.0: Usar nextBillingDate da Subscription (já calculado com billingAnchorDay correto)
      const nextDueDate = subscription.nextBillingDate || subscription.currentPeriodEnd;

      // Criar transação financeira vinculada ao cliente
      const financeTransaction = await tx.financeTransaction.create({
        data: {
          description: `Assinatura ${plan.name} - ${newClient.company}`,
          amount: calculatedMRR,
          type: 'INCOME',
          category: 'SUBSCRIPTION',
          date: new Date(),
          dueDate: nextDueDate, // Próximo vencimento
          status: 'PENDING',
          clientId: newClient.id,
          subscriptionId: subscription.id, // ✅ v2.47.0: Vincular à subscription
          productType: newClient.productType,
          isRecurring: true,
          createdBy: currentUserId,
        },
      });

      this.logger.log(
        `✅ FinanceTransaction criada: ${financeTransaction.id} | ` +
          `Cliente: ${newClient.company} | MRR: R$ ${calculatedMRR} | ` +
          `Vencimento: ${nextDueDate.toISOString().split('T')[0]}`,
      );

      // ═══════════════════════════════════════════════════════════════════

      // Se veio de lead, marcar como GANHO
      if (dto.leadId) {
        await tx.lead.update({
          where: { id: dto.leadId },
          data: {
            status: LeadStatus.GANHO,
            convertedAt: new Date(),
          },
        });
      }

      return newClient;
    });
    } catch (err: any) {
      // ✅ v2.63.2: P2002 = unique constraint violation (race condition double submit ou email duplicado)
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] || 'campo';
        if (field === 'cpfCnpj' || (err?.meta?.target as string[])?.includes('cpfCnpj')) {
          throw new ConflictException(`Cliente com CPF/CNPJ ${dto.cpfCnpj} já existe`);
        }
        if (field === 'email' || (err?.meta?.target as string[])?.includes('email')) {
          throw new ConflictException(`Cliente com email ${dto.email} já existe`);
        }
        throw new ConflictException(`Dados duplicados: ${field} já existe no sistema`);
      }
      throw err;
    }

    this.logger.log(
      `✅ Cliente criado: ${client.company} (${client.contactName}) - Vendedor: ${vendedor.name}${dto.leadId ? ' [Convertido de Lead]' : ''}`,
    );

    // Provisionar no One Nexus (apenas ONE_NEXUS, fora da tx para não bloquear rollback)
    if (client.productType === ProductType.ONE_NEXUS) {
      await this.tenantsService.provisionOnOneNexus(client.id);
    }

    return client;
  }

  /**
   * Atualizar cliente (com validação de acesso)
   */
  async update(
    id: string,
    dto: UpdateClientDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }

    // Validar acesso
    await this.validateAccess(client.vendedorId, currentUserId, currentUserRole);

    // ✅ v2.44.2: Cliente CANCELADO pode ter status alterado (reativação)
    // Bloquear edição de outros campos (apenas status permitido)
    if (client.status === ClientStatus.CANCELADO && !dto.status) {
      throw new BadRequestException(
        'Cliente cancelado só pode ter o status alterado. Use o endpoint de reativação ou edite o status.',
      );
    }

    // Validar permissão para reativação (CANCELADO → outro status)
    if (
      client.status === ClientStatus.CANCELADO &&
      dto.status &&
      dto.status !== ClientStatus.CANCELADO
    ) {
      if (
        currentUserRole !== UserRole.SUPERADMIN &&
        currentUserRole !== UserRole.ADMINISTRATIVO
      ) {
        throw new ForbiddenException(
          'Apenas SUPERADMIN ou ADMINISTRATIVO podem reativar clientes cancelados',
        );
      }
    }

    // VENDEDOR não pode alterar vendedorId
    if (dto.vendedorId && currentUserRole === UserRole.VENDEDOR) {
      throw new ForbiddenException('Você não pode transferir seus próprios clientes');
    }

    // GESTOR pode transferir apenas dentro da sua equipe
    if (dto.vendedorId && currentUserRole === UserRole.GESTOR) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: dto.vendedorId },
      });

      if (!vendedor) {
        throw new NotFoundException(`Vendedor ${dto.vendedorId} não encontrado`);
      }

      if (vendedor.gestorId !== currentUserId && dto.vendedorId !== currentUserId) {
        throw new ForbiddenException('Você só pode transferir clientes dentro da sua equipe');
      }
    }

    // Validar novo vendedor se fornecido
    if (dto.vendedorId) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: dto.vendedorId },
      });

      if (!vendedor || !vendedor.isActive) {
        throw new BadRequestException('Vendedor inválido ou inativo');
      }
    }

    // ✅ v2.45.0: planId não pode ser alterado via UPDATE (usar upgrade/downgrade)
    // Validação removida pois campo foi omitido do UpdateClientDto

    // ========== INÍCIO: Sync após update v2.44.0 ==========
    // ✅ v2.46.0: Remover billingAnchorDay do DTO antes de atualizar Client (campo não existe no schema)
    const { billingAnchorDay, ...clientData } = dto;

    const updated = await this.prisma.client.update({
      where: { id },
      data: clientData,
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
    });

    this.logger.log(`✅ Cliente atualizado: ${updated.company} (${updated.contactName})`);

    // ✅ v2.46.0: Se billingAnchorDay foi fornecido, atualizar Subscription ativa
    if (dto.billingAnchorDay !== undefined) {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          clientId: id,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (subscription) {
        // ✅ v2.46.1: Recalcular nextBillingDate com o novo anchor day
        const now = new Date();
        let nextDate = new Date(now.getFullYear(), now.getMonth(), dto.billingAnchorDay, 12, 0, 0, 0);

        // Se já passou o anchor day neste mês, avançar para o próximo mês
        if (nextDate < now) {
          nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dto.billingAnchorDay, 12, 0, 0, 0);
        }

        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            billingAnchorDay: dto.billingAnchorDay,
            nextBillingDate: nextDate,
          },
        });
        this.logger.log(`  ✅ Subscription.billingAnchorDay atualizado: ${dto.billingAnchorDay}`);
        this.logger.log(`  ✅ Subscription.nextBillingDate recalculado: ${nextDate.toISOString().split('T')[0]}`);

        // ✅ v2.46.1: Atualizar FinanceTransactions PENDING com novo dueDate
        const updatedTransactions = await this.prisma.financeTransaction.updateMany({
          where: {
            clientId: id,
            status: 'PENDING',
            isRecurring: true,
          },
          data: {
            dueDate: nextDate,
          },
        });
        this.logger.log(`  ✅ ${updatedTransactions.count} FinanceTransaction(s) PENDING atualizadas com novo dueDate`);
      } else {
        this.logger.warn(`  ⚠️  Nenhuma assinatura ativa encontrada para atualizar billingAnchorDay`);
      }
    }

    // Se mudou para CANCELADO, sincronizar transações
    if (dto.status === 'CANCELADO' && (client.status as string) !== 'CANCELADO') {
      await this.syncFinanceOnClientCancellation(id);
    }

    // Se mudou de CANCELADO para ATIVO/EM_TRIAL, reativar transações
    if ((dto.status === 'ATIVO' || dto.status === 'EM_TRIAL') && (client.status as string) === 'CANCELADO') {
      await this.syncFinanceOnClientReactivation(id);
    }
    // ========== FIM: Sync após update v2.44.0 ==========

    // ✅ v2.42.1: Recalcular nextDueDate após update (especialmente se billingCycle mudou)
    return {
      ...updated,
      nextDueDate: await this.calculateNextDueDate(updated),
    };
  }

  /**
   * Cancelar cliente (soft delete)
   */
  async cancel(id: string, currentUserId: string, currentUserRole: UserRole) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }

    // Apenas SUPERADMIN e ADMINISTRATIVO podem cancelar
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem cancelar clientes');
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.CANCELADO },
    });

    this.logger.warn(`⚠️ Cliente cancelado: ${client.company} (${client.contactName})`);

    // ✅ v2.44.2: Sincronizar transações financeiras após cancelamento
    await this.syncFinanceOnClientCancellation(id);

    // ✅ v2.65.3: Sincronizar cancelamento com One Nexus
    await this.tenantsService.syncStatusToOneNexus(id, 'canceled');

    return updated;
  }

  /**
   * Reativar cliente
   */
  async reactivate(id: string, currentUserId: string, currentUserRole: UserRole) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }

    // Apenas SUPERADMIN e ADMINISTRATIVO podem reativar
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem reativar clientes');
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.ATIVO },
    });

    this.logger.log(`✅ Cliente reativado: ${client.company} (${client.contactName})`);

    // ✅ v2.65.3: Sincronizar reativação com One Nexus
    await this.tenantsService.syncStatusToOneNexus(id, 'active');

    return updated;
  }

  /**
   * DELETE /clients/:id
   * Remove permanentemente um cliente e todos os dados relacionados
   *
   * REQUER: SUPERADMIN
   *
   * ATENÇÃO: Esta ação é IRREVERSÍVEL!
   * - Deleta cliente
   * - Deleta tenant (CASCADE)
   * - Deleta payments (CASCADE)
   * - Deleta finance transactions (CASCADE)
   * - Deleta impersonate logs (CASCADE)
   *
   * @version v2.39.2
   */
  async remove(id: string, currentUserId: string, currentUserRole: UserRole) {
    // 1. Buscar cliente
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        tenant: true,
        payments: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }

    // 2. Apenas SUPERADMIN pode deletar permanentemente
    if (currentUserRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Apenas SUPERADMIN pode excluir clientes permanentemente');
    }

    // 3. Log antes de deletar (para auditoria)
    this.logger.warn(
      `⚠️ HARD DELETE iniciado - Cliente: ${client.company} (${client.contactName}) | ` +
      `Tenant: ${client.tenant?.id || 'N/A'} | ` +
      `Payments: ${client.payments?.length || 0} | ` +
      `Solicitante: ${currentUserId}`,
    );

    // 4. Deletar tenant no One Nexus ANTES do cascade (para não perder o tenantUuid)
    if (client.tenant?.tenantUuid) {
      await this.tenantsService.deleteOnOneNexus(client.tenant.tenantUuid);
    }

    // 5. Deletar cliente (CASCADE deleta: tenant, payments, transactions, logs)
    await this.prisma.client.delete({
      where: { id },
    });

    this.logger.log(`✅ Cliente deletado permanentemente: ${client.company} (${id})`);

    return {
      success: true,
      message: 'Cliente excluído permanentemente',
      deletedClient: {
        id: client.id,
        company: client.company,
        contactName: client.contactName,
      },
    };
  }

  /**
   * Helper: Verificar permissão granular por módulo (OPCIONAL)
   * Se UserPermission não existir, segue com role-based access
   *
   * @returns true se tem permissão, false caso contrário
   */
  private async checkModulePermission(
    userId: string,
    productType: ProductType,
  ): Promise<boolean> {
    const module =
      productType === ProductType.ONE_NEXUS
        ? 'CLIENTS_ONE_NEXUS'
        : 'CLIENTS_LOCADORAS';

    const permission = await this.prisma.userPermission.findUnique({
      where: {
        userId_module: {
          userId,
          module: module as any,
        },
      },
    });

    // Se não tem permissão configurada, libera (compatibilidade retroativa)
    if (!permission) {
      return true;
    }

    // Se tem permissão configurada, verifica canView
    return permission.canView;
  }

  /**
   * Helper: Validar acesso a um cliente
   */
  private async validateAccess(
    clientVendedorId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // SUPERADMIN e ADMINISTRATIVO têm acesso total
    if (
      currentUserRole === UserRole.SUPERADMIN ||
      currentUserRole === UserRole.ADMINISTRATIVO
    ) {
      return;
    }

    // GESTOR pode acessar clientes da sua equipe
    if (currentUserRole === UserRole.GESTOR) {
      const vendedor = await this.prisma.user.findUnique({
        where: { id: clientVendedorId },
      });

      if (vendedor && (vendedor.gestorId === currentUserId || clientVendedorId === currentUserId)) {
        return;
      }
    }

    // VENDEDOR pode acessar apenas seus próprios clientes
    if (clientVendedorId === currentUserId) {
      return;
    }

    throw new ForbiddenException('Você não tem permissão para acessar este cliente');
  }

  /**
   * ✅ v2.39.0: Atualização automática de status baseado em payments
   * Roda diariamente via cron job (6h da manhã)
   *
   * LÓGICA:
   * - INADIMPLENTE: Se payment vencido (dueDate < hoje) e status PENDING
   * - ATIVO: Se último payment foi pago (status PAID)
   * - CANCELADO: Mantém status manual (não sobrescreve)
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, {
    name: 'update-client-status',
    timeZone: 'America/Sao_Paulo',
  })
  async updateClientStatusBasedOnPayments(): Promise<void> {
    this.logger.log('🔄 Iniciando atualização automática de status dos clientes...');

    try {
      // Buscar todos os clientes ATIVOS, EM_TRIAL ou INADIMPLENTES (não alterar CANCELADOS)
      const clients = await this.prisma.client.findMany({
        where: {
          status: {
            in: [ClientStatus.ATIVO, ClientStatus.EM_TRIAL, ClientStatus.INADIMPLENTE, ClientStatus.BLOQUEADO],
          },
        },
        include: {
          payments: {
            orderBy: { dueDate: 'desc' },
            take: 5, // Pegar os 5 últimos payments para análise
          },
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para comparação de data

      let countAtivo = 0;
      let countInadimplente = 0;
      let countBloqueado = 0;

      for (const client of clients) {
        let newStatus = client.status; // Manter status atual por padrão

        // 1. Verificar se há payment PENDENTE e VENCIDO (inadimplência)
        const overduePayments = client.payments.filter(
          (p) => p.status === 'PENDING' && p.dueDate && new Date(p.dueDate) < today,
        );

        if (overduePayments.length > 0) {
          // Calcular dias de atraso do payment mais antigo vencido
          const oldestOverdue = overduePayments[overduePayments.length - 1];
          const daysOverdue = Math.floor(
            (today.getTime() - new Date(oldestOverdue.dueDate!).getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysOverdue > 30) {
            newStatus = ClientStatus.BLOQUEADO; // Mais de 30 dias de atraso
            countBloqueado++;
          } else if (daysOverdue > 3) {
            // ✅ v2.44.2: Grace period de 3 dias (padrão Stripe/Pagar.me)
            // Dias 1-3: Sem mudança (aguarda pagamento)
            // Dia 4+: Marca como INADIMPLENTE
            newStatus = ClientStatus.INADIMPLENTE; // 4-30 dias de atraso (pós-grace)
            countInadimplente++;
          }
          // Else: daysOverdue 0-3 → Mantém status atual (grace period)
        } else {
          // 2. Verificar se último payment foi PAGO (cliente em dia)
          const lastPayment = client.payments[0]; // Mais recente
          if (lastPayment && lastPayment.status === 'PAID') {
            newStatus = ClientStatus.ATIVO;
            countAtivo++;
          }
        }

        // Atualizar status se mudou
        if (newStatus !== client.status) {
          await this.prisma.client.update({
            where: { id: client.id },
            data: { status: newStatus },
          });

          this.logger.log(
            `✅ Cliente ${client.company} (${client.id}): ${client.status} → ${newStatus}`,
          );
        }
      }

      this.logger.log(
        `✅ Atualização concluída: ${countAtivo} ATIVOS, ${countInadimplente} INADIMPLENTES, ${countBloqueado} BLOQUEADOS`,
      );
    } catch (error) {
      this.logger.error('❌ Erro na atualização de status dos clientes:', error);
    }
  }

  /**
   * 🔄 v2.39.1: Criar próximos payments automaticamente quando não existem
   * Executado pelo cron job diário após atualização de status
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM, {
    name: 'create-next-payments',
    timeZone: 'America/Sao_Paulo',
  })
  async createNextPaymentsForActiveClients(): Promise<void> {
    this.logger.log('🔄 Iniciando criação de próximos payments...');

    try {
      // Buscar todos os clientes ativos
      const clients = await this.prisma.client.findMany({
        where: {
          status: { in: ['ATIVO', 'EM_TRIAL'] },
          firstPaymentDate: { not: null },
        },
        include: {
          payments: {
            where: { status: 'PENDING', dueDate: { gte: new Date() } },
            orderBy: { dueDate: 'asc' },
            take: 1,
          },
          plan: true,
        },
      });

      let countCreated = 0;

      for (const client of clients) {
        // Pular se não tem billingCycle ou já tem payment futuro
        if (!client.billingCycle || (client as any).payments.length > 0) {
          continue;
        }

        // Calcular próxima dueDate baseado em firstPaymentDate + billingCycle
        const nextDueDate = new Date(client.firstPaymentDate!);

        switch (client.billingCycle) {
          case 'MONTHLY':
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
          case 'QUARTERLY':
            nextDueDate.setMonth(nextDueDate.getMonth() + 3);
            break;
          case 'SEMIANNUAL':
            nextDueDate.setMonth(nextDueDate.getMonth() + 6);
            break;
          case 'ANNUAL':
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            break;
        }

        // Criar próximo payment
        await this.prisma.payment.create({
          data: {
            clientId: client.id,
            amount: (client as any).plan.priceMonthly,
            dueDate: nextDueDate,
            status: 'PENDING',
            method: 'PIX', // ✅ v2.39.1: Campo obrigatório
            billingCycle: client.billingCycle,
            periodStart: client.firstPaymentDate,
            periodEnd: nextDueDate,
          },
        });

        countCreated++;
        this.logger.log(
          `✅ Payment criado para ${client.company}: dueDate ${nextDueDate.toISOString().split('T')[0]}`,
        );
      }

      this.logger.log(`✅ Criação concluída: ${countCreated} payments criados`);
    } catch (error) {
      this.logger.error('❌ Erro na criação de próximos payments:', error);
    }
  }

  /**
   * Helper: Calcular próximo vencimento baseado em payments pendentes
   * Retorna a data do próximo payment PENDING ou calcula baseado em billingCycle
   */
  // ════════════════════════════════════════════════════════════════
  // SYNC METHODS v2.44.0
  // ════════════════════════════════════════════════════════════════

  /**
   * Sincroniza transações pendentes quando o cliente é cancelado
   * @private
   */
  private async syncFinanceOnClientCancellation(clientId: string): Promise<void> {
    try {
      // ✅ v2.44.2: Cancelar apenas transações FUTURAS (PENDING, OVERDUE)
      // Transações PAID permanecem no histórico (padrão fintech: Stripe, Pagar.me, Stone)
      // Razão: Compliance fiscal e auditoria exigem manter registros de pagamentos recebidos
      const result = await this.prisma.financeTransaction.updateMany({
        where: {
          clientId,
          status: { in: ['PENDING', 'OVERDUE'] }, // Apenas cobranças futuras
        },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `[Sync v2.44.2] ${result.count} transações futuras canceladas para cliente ${clientId} (PAID preservado)`,
        );
      }
    } catch (error) {
      this.logger.error(`[Sync v2.44.2] Erro ao sincronizar transações do cliente ${clientId}:`, error);
    }
  }

  /**
   * Sincroniza transações pendentes quando o cliente é reativado
   * @private
   */
  private async syncFinanceOnClientReactivation(clientId: string): Promise<void> {
    try {
      // Reativar transações CANCELLED que foram canceladas automaticamente
      // (apenas as que não foram pagas)
      const result = await this.prisma.financeTransaction.updateMany({
        where: {
          clientId,
          status: 'CANCELLED',
          paidAt: null,
        },
        data: {
          status: 'PENDING',
          updatedAt: new Date(),
        },
      });

      if (result.count > 0) {
        this.logger.log(`[Sync v2.44.0] ${result.count} transações reativadas para cliente ${clientId}`);
      }
    } catch (error) {
      this.logger.error(`[Sync v2.44.0] Erro ao reativar transações do cliente ${clientId}:`, error);
    }
  }

  /**
   * Calcula a próxima data de vencimento (VENCIMENTO) para o cliente.
   *
   * Lógica:
   * 1. Busca os 2 primeiros payments PENDING futuros
   * 2. Se existem 2+, retorna o segundo (ignora o setup payment inicial)
   * 3. Se existe 1, retorna ele (primeira recorrência após setup ter passado)
   * 4. Se não há payments, calcula baseado em firstPaymentDate + billingCycle
   *
   * @param client - Cliente com id, company, firstPaymentDate, billingCycle
   * @returns ISO date string (YYYY-MM-DD) ou null
   */
  private async calculateNextDueDate(
    client: {
      id: string;
      company: string;
      firstPaymentDate?: Date | null;
      billingCycle?: string | null;
    },
  ): Promise<string | null> {
    this.logger.debug(`🔍 Calculando nextDueDate para ${client.company}`);

    // ✅ v2.46.0: Prioridade 1 - Subscription.nextBillingDate (fonte autoritativa)
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        clientId: client.id,
        status: { in: ['ACTIVE', 'TRIALING'] }, // Apenas assinaturas ativas
      },
      orderBy: { createdAt: 'desc' },
    });

    if (subscription?.nextBillingDate) {
      const result = subscription.nextBillingDate.toISOString().split('T')[0];
      this.logger.debug(`  ✅ Retornando Subscription.nextBillingDate: ${result}`);
      return result;
    }

    // ✅ v2.46.0: Prioridade 2 - FinanceTransaction.dueDate (recorrente, pendente)
    const nextTransaction = await this.prisma.financeTransaction.findFirst({
      where: {
        clientId: client.id,
        isRecurring: true,
        status: 'PENDING',
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (nextTransaction?.dueDate) {
      const result = nextTransaction.dueDate.toISOString().split('T')[0];
      this.logger.debug(`  ✅ Retornando FinanceTransaction.dueDate: ${result}`);
      return result;
    }

    // Prioridade 3: Cálculo manual baseado em firstPaymentDate + billingCycle (fallback)
    this.logger.debug(`  → firstPaymentDate: ${client.firstPaymentDate}`);
    this.logger.debug(`  → billingCycle: ${client.billingCycle}`);

    if (client.firstPaymentDate && client.billingCycle) {
      const nextDate = new Date(client.firstPaymentDate);
      this.logger.debug(`  → Data inicial: ${nextDate.toISOString()}`);

      switch (client.billingCycle) {
        case 'MONTHLY':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'SEMIANNUAL':
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case 'ANNUAL':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      const result = nextDate.toISOString().split('T')[0];
      this.logger.debug(`  ✅ Retornando cálculo baseado em firstPaymentDate: ${result}`);
      return result;
    }

    // Fallback final: NULL (sem dados)
    this.logger.debug(`  ❌ Retornando NULL (sem dados)`);
    return null;
  }

  // ════════════════════════════════════════════════════════════════
  // IMPERSONATE METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * Inicia sessão de impersonate para um cliente One Nexus.
   * Chama API do One Nexus, registra log de auditoria e retorna magicLink.
   *
   * REQUER: SUPERADMIN, DESENVOLVEDOR ou GESTOR
   */
  async startImpersonate(
    clientId: string,
    currentUser: AuthUser,
    reason: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ magicLink: string; sessionId: string; logId: string }> {
    // Verificar permissão
    const allowedRoles: UserRole[] = [UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR, UserRole.GESTOR];
    if (!allowedRoles.includes(currentUser.role)) {
      throw new ForbiddenException('Apenas SUPERADMIN, DESENVOLVEDOR ou GESTOR podem usar impersonate');
    }

    // Buscar cliente com tenant
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { tenant: true },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Validar escopo de acesso (GESTOR só pode impersonate clientes da sua equipe)
    await this.validateAccess(client.vendedorId, currentUser.id, currentUser.role);

    // Validar tenant e tenantUuid
    if (!client.tenant) {
      throw new BadRequestException('Este cliente não possui tenant provisionado no One Nexus');
    }

    if (!client.tenant.tenantUuid) {
      throw new BadRequestException('Tenant do cliente ainda não foi sincronizado com o One Nexus (tenantUuid ausente)');
    }

    // Chamar One Nexus API
    const result = await this.oneNexusService.startImpersonate(
      client.tenant.tenantUuid,
      reason,
    );

    if (!result) {
      throw new ServiceUnavailableException(
        'Não foi possível iniciar o impersonate. Verifique a integração com o One Nexus.',
      );
    }

    // Registrar log de auditoria
    const log = await this.prisma.impersonateLog.create({
      data: {
        userId: currentUser.id,
        clientId,
        tenantId: client.tenant.id,
        reason,
        ipAddress,
        userAgent,
        actions: { oneNexusSessionId: result.sessionId },
      },
    });

    this.logger.log(
      `[Impersonate] ✅ Sessão iniciada por ${currentUser.id} para cliente ${clientId} (sessionId=${result.sessionId}, logId=${log.id})`,
    );

    return {
      magicLink: result.magicLink,
      sessionId: result.sessionId,
      logId: log.id,
    };
  }

  /**
   * Encerra sessão de impersonate e registra endedAt no log.
   *
   * REQUER: Dono do log OU SUPERADMIN
   */
  async endImpersonate(
    logId: string,
    currentUser: AuthUser,
  ): Promise<{ success: boolean }> {
    const log = await this.prisma.impersonateLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new NotFoundException('Log de impersonate não encontrado');
    }

    // Validar acesso: dono do log ou SUPERADMIN
    if (log.userId !== currentUser.id && currentUser.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Apenas o usuário que iniciou o impersonate ou SUPERADMIN pode encerrá-lo');
    }

    // Encerrar no One Nexus
    const sessionId = (log.actions as any)?.oneNexusSessionId;
    if (sessionId) {
      const ended = await this.oneNexusService.endImpersonate(sessionId);
      if (!ended) {
        this.logger.warn(
          `[Impersonate] ⚠️ Falha ao encerrar sessão no One Nexus (sessionId=${sessionId}) — sessão local marcada como encerrada`,
        );
      }
    }

    // Registrar encerramento
    await this.prisma.impersonateLog.update({
      where: { id: logId },
      data: { endedAt: new Date() },
    });

    this.logger.log(`[Impersonate] ✅ Sessão encerrada: logId=${logId}, sessionId=${sessionId}`);

    return { success: true };
  }

  /**
   * Busca histórico de impersonate de um cliente.
   */
  async getClientImpersonateLogs(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return this.prisma.impersonateLog.findMany({
      where: { clientId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
}
