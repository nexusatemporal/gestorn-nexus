import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UserRole, PaymentStatus, PaymentMethod } from '@prisma/client';

/**
 * Payments Service
 * Gerencia pagamentos dos clientes com controle de acesso baseado em roles
 *
 * REGRAS DE ACESSO:
 * - SUPERADMIN/ADMINISTRATIVO: Acesso total a todos os pagamentos
 * - GESTOR: Acesso aos pagamentos dos clientes da sua equipe
 * - VENDEDOR: Acesso aos pagamentos dos seus clientes
 *
 * AUTOMAÇÃO:
 * - Pagamentos são geralmente criados/atualizados por webhooks dos gateways
 * - Este service também permite criação/atualização manual por admins
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listar pagamentos (com scoping por role)
   */
  async findAll(params: {
    currentUserId: string;
    currentUserRole: UserRole;
    status?: PaymentStatus;
    method?: PaymentMethod;
    clientId?: string;
  }) {
    const { currentUserId, currentUserRole, status, method, clientId } = params;

    // Construir filtros baseado na role
    const where: any = {
      status,
      method,
      clientId,
    };

    // Para GESTOR e VENDEDOR, precisamos filtrar por clientes acessíveis
    if (
      currentUserRole === UserRole.GESTOR ||
      currentUserRole === UserRole.VENDEDOR
    ) {
      // Buscar clientes acessíveis
      const clientsWhere: any = {};

      if (currentUserRole === UserRole.GESTOR) {
        // Buscar vendedores do gestor
        const vendedores = await this.prisma.user.findMany({
          where: { gestorId: currentUserId },
          select: { id: true },
        });

        const vendedorIds = vendedores.map((v) => v.id);
        vendedorIds.push(currentUserId); // Incluir clientes do próprio gestor

        clientsWhere.vendedorId = { in: vendedorIds };
      } else if (currentUserRole === UserRole.VENDEDOR) {
        clientsWhere.vendedorId = currentUserId;
      }

      const accessibleClients = await this.prisma.client.findMany({
        where: clientsWhere,
        select: { id: true },
      });

      const clientIds = accessibleClients.map((c) => c.id);

      if (clientId && !clientIds.includes(clientId)) {
        throw new ForbiddenException('Você não tem acesso aos pagamentos deste cliente');
      }

      where.clientId = { in: clientIds };
    }

    // Se filtrou por clientId mas não tem acesso
    if (
      clientId &&
      (currentUserRole === UserRole.GESTOR || currentUserRole === UserRole.VENDEDOR)
    ) {
      // Verificar acesso ao cliente
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        throw new NotFoundException(`Cliente ${clientId} não encontrado`);
      }

      // Validar acesso
      await this.validateClientAccess(client.vendedorId, currentUserId, currentUserRole);
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            company: true,
            contactName: true,
            email: true,
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
      orderBy: { dueDate: 'desc' },
    });
  }

  /**
   * Buscar pagamento por ID (com validação de acesso)
   */
  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            vendedor: {
              select: {
                id: true,
                name: true,
                email: true,
                gestor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            plan: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Pagamento ${id} não encontrado`);
    }

    // Validar acesso
    await this.validateClientAccess(
      payment.client.vendedorId,
      currentUserId,
      currentUserRole,
    );

    return payment;
  }

  /**
   * Buscar pagamento por externalId (gateway)
   */
  async findByExternalId(externalId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { externalId },
      include: {
        client: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Pagamento com external ID ${externalId} não encontrado`);
    }

    return payment;
  }

  /**
   * Criar pagamento
   */
  async create(dto: CreatePaymentDto, currentUserId: string, currentUserRole: UserRole) {
    // Apenas admins podem criar pagamentos manualmente
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem criar pagamentos manualmente');
    }

    // Validar cliente
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      include: {
        plan: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${dto.clientId} não encontrado`);
    }

    // Verificar se cliente está ativo
    if (client.status === 'CANCELADO') {
      throw new BadRequestException('Não é possível criar pagamento para cliente cancelado');
    }

    const payment = await this.prisma.payment.create({
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
      `✅ Pagamento criado: R$ ${payment.amount} - Cliente: ${client.company}${payment.dueDate ? ` - Vencimento: ${payment.dueDate.toLocaleDateString('pt-BR')}` : ''}`,
    );

    return payment;
  }

  /**
   * Atualizar pagamento
   */
  async update(
    id: string,
    dto: UpdatePaymentDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Pagamento ${id} não encontrado`);
    }

    // Apenas admins podem atualizar pagamentos manualmente
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem atualizar pagamentos');
    }

    // Validar transição de status
    if (dto.status) {
      this.validateStatusTransition(payment.status, dto.status);
    }

    // Se status mudou para PAID, garantir que paidAt está definido
    if (dto.status === PaymentStatus.PAID && !dto.paidAt && !payment.paidAt) {
      dto.paidAt = new Date();
    }

    // Se status mudou para CANCELLED, garantir que cancelledAt está definido
    if (dto.status === PaymentStatus.CANCELLED && !dto.cancelledAt && !payment.cancelledAt) {
      dto.cancelledAt = new Date();
    }

    const updated = await this.prisma.payment.update({
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
      `✅ Pagamento atualizado: R$ ${updated.amount} - Cliente: ${payment.client.company}`,
    );

    return updated;
  }

  /**
   * Marcar pagamento como pago
   */
  async markAsPaid(id: string, currentUserId: string, currentUserRole: UserRole) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Pagamento ${id} não encontrado`);
    }

    // Apenas admins
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem marcar pagamentos como pagos');
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Pagamento já está marcado como pago');
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException('Não é possível marcar pagamento cancelado como pago');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    });

    this.logger.log(
      `✅ Pagamento marcado como pago: R$ ${updated.amount} - Cliente: ${payment.client.company}`,
    );

    return updated;
  }

  /**
   * Cancelar pagamento
   */
  async cancel(id: string, currentUserId: string, currentUserRole: UserRole) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Pagamento ${id} não encontrado`);
    }

    // Apenas admins
    if (
      currentUserRole !== UserRole.SUPERADMIN &&
      currentUserRole !== UserRole.ADMINISTRATIVO
    ) {
      throw new ForbiddenException('Apenas administradores podem cancelar pagamentos');
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Não é possível cancelar pagamento já pago');
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      throw new BadRequestException('Pagamento já está cancelado');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    this.logger.warn(
      `⚠️ Pagamento cancelado: R$ ${updated.amount} - Cliente: ${payment.client.company}`,
    );

    return updated;
  }

  /**
   * Estatísticas de pagamentos
   * (Útil para dashboards)
   */
  async getStats(currentUserId: string, currentUserRole: UserRole) {
    // Construir filtros baseado na role (similar ao findAll)
    let clientIds: string[] | undefined;

    if (
      currentUserRole === UserRole.GESTOR ||
      currentUserRole === UserRole.VENDEDOR
    ) {
      const clientsWhere: any = {};

      if (currentUserRole === UserRole.GESTOR) {
        const vendedores = await this.prisma.user.findMany({
          where: { gestorId: currentUserId },
          select: { id: true },
        });

        const vendedorIds = vendedores.map((v) => v.id);
        vendedorIds.push(currentUserId);

        clientsWhere.vendedorId = { in: vendedorIds };
      } else if (currentUserRole === UserRole.VENDEDOR) {
        clientsWhere.vendedorId = currentUserId;
      }

      const accessibleClients = await this.prisma.client.findMany({
        where: clientsWhere,
        select: { id: true },
      });

      clientIds = accessibleClients.map((c) => c.id);
    }

    const where: any = clientIds ? { clientId: { in: clientIds } } : {};

    const [total, paid, pending, overdue, cancelled] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.PAID } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.PENDING } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.OVERDUE } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.CANCELLED } }),
    ]);

    const [totalAmount, paidAmount, pendingAmount] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } },
        _sum: { amount: true },
      }),
    ]);

    return {
      counts: {
        total,
        paid,
        pending,
        overdue,
        cancelled,
      },
      amounts: {
        total: totalAmount._sum.amount || 0,
        paid: paidAmount._sum.amount || 0,
        pending: pendingAmount._sum.amount || 0,
      },
    };
  }

  /**
   * Helper: Validar transição de status
   */
  private validateStatusTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus) {
    const invalidTransitions = [
      [PaymentStatus.PAID, PaymentStatus.PENDING],
      [PaymentStatus.PAID, PaymentStatus.OVERDUE],
      [PaymentStatus.CANCELLED, PaymentStatus.PAID],
      [PaymentStatus.CANCELLED, PaymentStatus.PENDING],
      [PaymentStatus.CANCELLED, PaymentStatus.OVERDUE],
    ];

    for (const [from, to] of invalidTransitions) {
      if (currentStatus === from && newStatus === to) {
        throw new BadRequestException(
          `Transição inválida: não é possível mudar status de ${from} para ${to}`,
        );
      }
    }
  }

  /**
   * Helper: Validar acesso a cliente (para payments)
   */
  private async validateClientAccess(
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

    throw new ForbiddenException('Você não tem permissão para acessar pagamentos deste cliente');
  }
}
