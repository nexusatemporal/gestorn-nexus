import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionFiltersDto,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from './dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════
  // TRANSAÇÕES CRUD
  // ════════════════════════════════════════════════════════════════

  async create(data: CreateTransactionDto, userId: string) {
    const transaction = await this.prisma.financeTransaction.create({
      data: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: data.category,
        date: new Date(data.date),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status,
        clientId: data.clientId,
        productType: data.productType,
        isRecurring: data.isRecurring,
        createdBy: userId,
      },
      include: this.getInclude(),
    });

    return this.format(transaction);
  }

  async findAll(filters: TransactionFiltersDto) {
    const where: Prisma.FinanceTransactionWhereInput = {};

    if (filters.startDate) {
      where.date = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.date = { ...where.date as any, lte: new Date(filters.endDate) };
    }
    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.productType) {
      where.OR = [
        { productType: filters.productType as any },
        { client: { productType: filters.productType as any } },
      ];
    }

    // ✅ Ordenação dinâmica
    const orderBy: any = [];
    if (filters.sortByDate) {
      orderBy.push({ date: filters.sortByDate });
    }
    if (filters.sortByAmount) {
      orderBy.push({ amount: filters.sortByAmount });
    }
    // Fallback: se nenhuma ordenação especificada, usar data desc
    if (orderBy.length === 0) {
      orderBy.push({ date: 'desc' });
    }

    const transactions = await this.prisma.financeTransaction.findMany({
      where,
      include: this.getInclude(),
      orderBy,
    });

    return transactions.map(t => this.format(t));
  }

  async findById(id: string) {
    const t = await this.prisma.financeTransaction.findUnique({
      where: { id },
      include: this.getInclude(),
    });
    if (!t) throw new NotFoundException('Transação não encontrada');
    return this.format(t);
  }

  async update(id: string, data: UpdateTransactionDto) {
    // v2.44.1: Buscar transação com status para detectar mudanças
    const exists = await this.prisma.financeTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        paidAt: true,
        status: true, // v2.44.1: Incluir status para detectar transições
        clientId: true // v2.44.1: Incluir clientId para sync
      }
    });
    if (!exists) throw new NotFoundException('Transação não encontrada');

    const oldStatus = exists.status; // v2.44.1: Armazenar status anterior

    // ========== INÍCIO: Lógica de Status v2.44.0 ==========
    // Se o status está sendo alterado para PAID, definir paidAt automaticamente
    if (data.status === 'PAID' && !data.paidAt) {
      (data as any).paidAt = new Date();
    }

    // Se o status está sendo alterado DE PAID para outro, limpar paidAt
    if (data.status && data.status !== 'PAID' && exists.paidAt) {
      (data as any).paidAt = null;
    }
    // ========== FIM: Lógica de Status v2.44.0 ==========

    const updatedTransaction = await this.prisma.financeTransaction.update({
      where: { id },
      data: {
        ...(data.description && { description: data.description }),
        ...(data.amount && { amount: data.amount }),
        ...(data.type && { type: data.type }),
        ...(data.category && { category: data.category }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.status && { status: data.status }),
        ...((data as any).paidAt !== undefined && { paidAt: (data as any).paidAt }),
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.productType !== undefined && { productType: data.productType }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      },
      include: this.getInclude(),
    });

    // ========== INÍCIO: Sync após update v2.47.0 ==========
    if (exists.clientId) {
      // Sincronizar cliente se status mudou PARA PAID
      if (data.status === 'PAID' && oldStatus !== 'PAID') {
        await this.syncClientOnPayment(exists.clientId, id);
      }

      // ✅ v2.44.2: REMOVIDO syncClientOnUnpayment() - Status gerenciado apenas por cron
      // Edições manuais não disparam cascatas (padrão Stripe/Pagar.me)

      // Sincronizar cliente se status mudou para CANCELLED
      if (data.status === 'CANCELLED' && oldStatus !== 'CANCELLED') {
        await this.syncClientOnCancellation(exists.clientId);
      }
    }
    // ========== FIM: Sync após update v2.44.2 ==========

    return this.format(updatedTransaction);
  }

  async markAsPaid(id: string) {
    this.logger.log(`[markAsPaid] Iniciando marcação como pago - ID: ${id}`);

    const t = await this.prisma.financeTransaction.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: this.getInclude(),
    });

    this.logger.log(`[markAsPaid] Transação atualizada - paidAt: ${t.paidAt}, status DB: ${t.status}`);

    // ✅ v2.47.0: Sincronizar cliente e subscription após marcar como PAID
    if (t.clientId) {
      await this.syncClientOnPayment(t.clientId, id);
    }

    const formatted = this.format(t);
    this.logger.log(`[markAsPaid] Status calculado retornado: ${formatted.status}`);

    return formatted;
  }

  async delete(id: string) {
    const exists = await this.prisma.financeTransaction.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Transação não encontrada');
    await this.prisma.financeTransaction.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════════
  // SYNC METHODS v2.44.0
  // ════════════════════════════════════════════════════════════════

  /**
   * Sincroniza o status do cliente quando uma transação é marcada como PAID
   * Padrão Stripe: Primeiro pagamento ativa o cliente
   * @private
   */
  private async syncClientOnPayment(clientId: string, transactionId?: string): Promise<void> {
    if (!clientId) return;

    try {
      // Buscar cliente atual
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, status: true },
      });

      if (!client) return;

      // Se cliente está EM_TRIAL ou INADIMPLENTE, ativar ao receber pagamento
      if (client.status === 'EM_TRIAL' || client.status === 'INADIMPLENTE') {
        await this.prisma.client.update({
          where: { id: clientId },
          data: { status: 'ATIVO' },
        });

        this.logger.log(`[Sync v2.47.0] Cliente ${clientId} ativado após pagamento`);
      }

      // v2.47.0: Reativar Subscription quando pagamento é confirmado
      if (transactionId) {
        const transaction = await this.prisma.financeTransaction.findUnique({
          where: { id: transactionId },
          select: { subscriptionId: true },
        });

        if (transaction?.subscriptionId) {
          const subscription = await this.prisma.subscription.findUnique({
            where: { id: transaction.subscriptionId },
            select: { id: true, status: true },
          });

          if (subscription && subscription.status === 'PAST_DUE') {
            await this.prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'ACTIVE' },
            });
            this.logger.log(`[Sync v2.47.0] Subscription ${subscription.id} reativada: PAST_DUE → ACTIVE`);
          }
        }
      }
    } catch (error) {
      // Log do erro mas não quebrar o fluxo principal
      this.logger.error(`[Sync v2.47.0] Erro ao sincronizar cliente/subscription ${clientId}:`, error);
    }
  }

  /**
   * ✅ v2.44.2: REMOVIDO syncClientOnUnpayment()
   *
   * Razão: Status do cliente deve ser gerenciado APENAS por cron job (updateClientStatusBasedOnPayments)
   * Padrão fintech (Stripe, Pagar.me, Stone): Edições manuais não disparam cascatas de status
   *
   * Benefícios:
   * - Evita notificações falsas para clientes
   * - Suporte tem tempo para corrigir erros
   * - Status muda apenas em horários definidos (previsibilidade)
   * - Eventual consistency (cron-driven)
   */

  /**
   * Sincroniza o status do cliente quando uma transação é cancelada
   * @private
   */
  private async syncClientOnCancellation(clientId: string): Promise<void> {
    if (!clientId) return;

    try {
      // Verificar se cliente tem outras transações ativas
      const activeTransactions = await this.prisma.financeTransaction.count({
        where: {
          clientId,
          status: { notIn: ['CANCELLED'] },
          paidAt: null,
        },
      });

      // ✅ v2.44.2: Se não tem mais transações ativas, cancelar cliente automaticamente
      if (activeTransactions === 0) {
        await this.prisma.client.update({
          where: { id: clientId },
          data: { status: 'CANCELADO' },
        });

        this.logger.log(
          `[Sync v2.44.2] Cliente ${clientId} cancelado automaticamente (sem assinaturas ativas)`,
        );
      }
    } catch (error) {
      this.logger.error(`[Sync v2.44.0] Erro ao verificar cliente ${clientId}:`, error);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // INTEGRAÇÃO COM CLIENTES
  // ════════════════════════════════════════════════════════════════

  async getClientTransactions(clientId: string) {
    const transactions = await this.prisma.financeTransaction.findMany({
      where: { clientId },
      include: {
        ...this.getInclude(),
        client: {
          select: {
            id: true,
            company: true,
            productType: true,
            vendedor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calcular totais usando status calculado dinamicamente (v2.43.0)
    const totalPaid = transactions
      .filter(t => this.getCalculatedStatus(t) === 'PAID')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalPending = transactions
      .filter(t => this.getCalculatedStatus(t) === 'PENDING')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalOverdue = transactions
      .filter(t => this.getCalculatedStatus(t) === 'OVERDUE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Próximos vencimentos (7 dias)
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const upcoming = transactions
      .filter(t => this.getCalculatedStatus(t) === 'PENDING' && t.dueDate && t.dueDate >= now && t.dueDate <= sevenDaysLater)
      .map(t => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        amountFormatted: this.formatCurrency(Number(t.amount)),
        dueDate: t.dueDate!.toISOString().split('T')[0],
        dueDateFormatted: t.dueDate!.toLocaleDateString('pt-BR'),
        daysRemaining: Math.ceil((t.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));

    return {
      client: transactions[0]?.client || null,
      totals: {
        paid: totalPaid,
        paidFormatted: this.formatCurrency(totalPaid),
        pending: totalPending,
        pendingFormatted: this.formatCurrency(totalPending),
        overdue: totalOverdue,
        overdueFormatted: this.formatCurrency(totalOverdue),
      },
      upcoming,
      transactions: transactions.map(t => this.format(t)),
    };
  }

  async getOverdueClients() {
    // v2.43.0: Buscar transações com dueDate vencido (status calculado dinamicamente)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        clientId: { not: null },
        dueDate: { lt: today }, // ✅ Venceu
        paidAt: null, // ✅ Ainda não pago
        status: { not: 'CANCELLED' }, // ✅ Não cancelado
      },
      include: {
        client: {
          select: {
            id: true,
            company: true,
            productType: true,
            vendedor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Filtrar apenas as que realmente estão OVERDUE (usando status calculado)
    const overdueTransactions = transactions.filter(t => this.getCalculatedStatus(t) === 'OVERDUE');

    // Agrupar por cliente
    const clientsMap = new Map<string, any>();

    overdueTransactions.forEach(t => {
      if (!t.client) return;

      const existing = clientsMap.get(t.clientId!);
      const amount = Number(t.amount);
      const daysOverdue = t.dueDate
        ? Math.floor((new Date().getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (existing) {
        existing.overdueAmount += amount;
        existing.transactionCount += 1;
        existing.maxDaysOverdue = Math.max(existing.maxDaysOverdue, daysOverdue);
      } else {
        clientsMap.set(t.clientId!, {
          clientId: t.clientId,
          clientName: t.client.company,
          productType: t.client.productType,
          vendedor: t.client.vendedor?.name || 'N/A',
          overdueAmount: amount,
          overdueAmountFormatted: '',
          transactionCount: 1,
          maxDaysOverdue: daysOverdue,
        });
      }
    });

    const clients = Array.from(clientsMap.values())
      .map(c => ({
        ...c,
        overdueAmountFormatted: this.formatCurrency(c.overdueAmount),
      }))
      .sort((a, b) => b.overdueAmount - a.overdueAmount);

    return clients;
  }

  async getUpcomingDueDates() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // v2.43.0: Buscar transações com dueDate próximo (status calculado dinamicamente)
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        paidAt: null, // ✅ Ainda não pago
        status: { not: 'CANCELLED' }, // ✅ Não cancelado
        dueDate: {
          gte: now,
          lte: sevenDaysLater,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            company: true,
            productType: true,
            vendedor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Filtrar apenas transações PENDING (usando status calculado)
    const upcoming = transactions.filter(t => this.getCalculatedStatus(t) === 'PENDING');

    return upcoming.map(t => ({
      id: t.id,
      description: t.description,
      clientId: t.clientId,
      clientName: t.client?.company || 'Avulso',
      productType: t.client?.productType || null,
      vendedor: t.client?.vendedor?.name || 'N/A',
      amount: Number(t.amount),
      amountFormatted: this.formatCurrency(Number(t.amount)),
      dueDate: t.dueDate!.toISOString().split('T')[0],
      dueDateFormatted: t.dueDate!.toLocaleDateString('pt-BR'),
      daysRemaining: Math.ceil((t.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      category: t.category,
      categoryLabel: CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS],
    }));
  }

  // ════════════════════════════════════════════════════════════════
  // MÉTRICAS (igual protótipo linha 58-66)
  // ════════════════════════════════════════════════════════════════

  async getMetrics(productType?: string) {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // ═══════════════════════════════════════════════════════════════
    // FILTRO DE PRODUTO (se especificado)
    // ═══════════════════════════════════════════════════════════════
    const productFilter = productType && productType !== 'ALL'
      ? {
          OR: [
            { productType: productType as any }, // Transação tem produto direto
            { client: { productType: productType as any } }, // OU cliente tem produto
          ],
        }
      : {};

    // ═══════════════════════════════════════════════════════════════
    // MRR ATUAL: Todas assinaturas recorrentes ativas
    // ✅ Usa findMany() + include para permitir filtro por client.productType
    // NÃO filtra por data - conta tudo que está ativo
    // ═══════════════════════════════════════════════════════════════
    const mrrAtualTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: { in: ['PAID', 'PENDING'] },
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    // Filtrar manualmente se necessário e somar
    const mrrAtualFiltered = productType && productType !== 'ALL'
      ? mrrAtualTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : mrrAtualTransactions;

    // ═══════════════════════════════════════════════════════════════
    // MRR MÊS ANTERIOR: Para calcular tendência
    // ✅ Usa findMany() + include para permitir filtro por client.productType
    // Considera o que estava ativo no final do mês anterior (dezembro)
    // ═══════════════════════════════════════════════════════════════
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const mrrAnteriorTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        date: { lte: previousMonthEnd }, // Data da transação até o final do mês anterior
        ...productFilter,
        OR: [
          // Ainda está ativo hoje
          { status: { in: ['PAID', 'PENDING', 'OVERDUE'] } },
          // OU foi cancelado DEPOIS do mês anterior (estava ativo em dezembro)
          {
            status: 'CANCELLED',
            updatedAt: { gt: previousMonthEnd },
          },
        ],
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    // Filtrar manualmente se necessário e somar
    const mrrAnteriorFiltered = productType && productType !== 'ALL'
      ? mrrAnteriorTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : mrrAnteriorTransactions;

    // ═══════════════════════════════════════════════════════════════
    // NEW MRR: Transações recorrentes com DATA DE TRANSAÇÃO este mês
    // ✅ Usa findMany() + include para permitir filtro por client.productType
    // ✅ Usa 'date' ao invés de 'createdAt' para refletir competência contábil
    // ═══════════════════════════════════════════════════════════════
    const newMrrTransactionsMetrics = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: { in: ['PAID', 'PENDING'] },
        date: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    // Filtrar manualmente se necessário e somar
    const newMrrFilteredMetrics = productType && productType !== 'ALL'
      ? newMrrTransactionsMetrics.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : newMrrTransactionsMetrics;

    // ═══════════════════════════════════════════════════════════════
    // CHURN MRR: Recorrentes canceladas este mês
    // ✅ Usa findMany() + include para permitir filtro por client.productType
    // ═══════════════════════════════════════════════════════════════
    const churnMrrTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: 'CANCELLED',
        updatedAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    // Filtrar manualmente se necessário e somar
    const churnMrrFiltered = productType && productType !== 'ALL'
      ? churnMrrTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : churnMrrTransactions;

    // ═══════════════════════════════════════════════════════════════
    // MÉTRICAS DO MÊS ANTERIOR (para cálculo de tendências)
    // previousMonthStart e previousMonthEnd já definidos acima
    // ═══════════════════════════════════════════════════════════════

    // NEW MRR mês anterior
    const newMrrPreviousTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: { in: ['PAID', 'PENDING'] },
        date: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    const newMrrPreviousFiltered = productType && productType !== 'ALL'
      ? newMrrPreviousTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : newMrrPreviousTransactions;

    const newMrrPreviousValue = newMrrPreviousFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // CHURN MRR mês anterior
    const churnMrrPreviousTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: 'CANCELLED',
        updatedAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    const churnMrrPreviousFiltered = productType && productType !== 'ALL'
      ? churnMrrPreviousTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : churnMrrPreviousTransactions;

    const churnMrrPreviousValue = churnMrrPreviousFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // ═══════════════════════════════════════════════════════════════
    // INADIMPLÊNCIA (baseada em VALOR MONETÁRIO de assinaturas vencidas)
    // ═══════════════════════════════════════════════════════════════
    const overdueTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: 'OVERDUE',
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    const overdueFiltered = productType && productType !== 'ALL'
      ? overdueTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : overdueTransactions;

    const inadimplenciaValue = overdueFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // Inadimplência mês anterior (para tendência)
    const overduePreviousTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: 'OVERDUE',
        updatedAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    const overduePreviousFiltered = productType && productType !== 'ALL'
      ? overduePreviousTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : overduePreviousTransactions;

    const inadimplenciaPreviousValue = overduePreviousFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // ═══════════════════════════════════════════════════════════════
    // MRR 2 MESES ATRÁS (para calcular Churn Rate Previous corretamente)
    // ═══════════════════════════════════════════════════════════════
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);

    const mrrTwoMonthsAgoTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        date: { lte: twoMonthsAgoEnd },
        ...productFilter,
        OR: [
          { status: { in: ['PAID', 'PENDING', 'OVERDUE'] } },
          {
            status: 'CANCELLED',
            updatedAt: { gt: twoMonthsAgoEnd },
          },
        ],
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    const mrrTwoMonthsAgoFiltered = productType && productType !== 'ALL'
      ? mrrTwoMonthsAgoTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : mrrTwoMonthsAgoTransactions;

    const totalMrrsTwoMonthsAgo = mrrTwoMonthsAgoFiltered.length;

    // ═══════════════════════════════════════════════════════════════
    // ARR DE DEZEMBRO DO ANO PASSADO (para cálculo de tendência anual)
    // Sempre compara com dezembro do ano anterior, não com o mesmo mês
    // ═══════════════════════════════════════════════════════════════
    const lastDecemberStart = new Date(now.getFullYear() - 1, 11, 1); // Dezembro do ano passado
    const lastDecemberEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    const arrLastYearTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        date: { lte: lastDecemberEnd }, // Data da transação até o final de dezembro do ano passado
        ...productFilter,
        OR: [
          // Ainda está ativo hoje
          { status: { in: ['PAID', 'PENDING', 'OVERDUE'] } },
          // OU foi cancelado DEPOIS de dezembro do ano passado (estava ativo em dez)
          {
            status: 'CANCELLED',
            updatedAt: { gt: lastDecemberEnd },
          },
        ],
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    const arrLastYearFiltered = productType && productType !== 'ALL'
      ? arrLastYearTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : arrLastYearTransactions;

    const mrrLastDecember = arrLastYearFiltered.reduce((sum, t) => sum + Number(t.amount), 0);
    const arrLastYear = mrrLastDecember * 12;

    // ═══════════════════════════════════════════════════════════════
    // CÁLCULOS - VALORES MONETÁRIOS
    // ═══════════════════════════════════════════════════════════════
    const mrr = mrrAtualFiltered.reduce((sum, t) => sum + Number(t.amount), 0);
    const mrrPrevious = mrrAnteriorFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // ═══════════════════════════════════════════════════════════════
    // YTD REVENUE (Receita Acumulada do Ano) - v2.13.0
    // Soma de MRRs mensais desde janeiro do ano atual até o mês corrente
    // ═══════════════════════════════════════════════════════════════
    const currentYearStart = new Date(now.getFullYear(), 0, 1); // 1º de Janeiro do ano atual

    // MRR inicial: assinaturas ativas antes do ano começar
    const mrrBeforeYearTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: { in: ['PAID', 'PENDING'] },
        date: { lt: currentYearStart }, // Criadas antes de 1º de janeiro
        ...productFilter,
      },
      select: {
        amount: true,
        productType: true,
        client: { select: { productType: true } },
      },
    });

    // Filtrar manualmente se productType especificado
    const mrrBeforeYearFiltered = productType && productType !== 'ALL'
      ? mrrBeforeYearTransactions.filter(t =>
          t.productType === productType || t.client?.productType === productType
        )
      : mrrBeforeYearTransactions;

    // Inicializar YTD com MRR base
    let ytd = mrrBeforeYearFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // Acumular mudanças mês a mês desde janeiro até o mês atual
    for (let month = 0; month <= now.getMonth(); month++) {
      const monthStart = new Date(now.getFullYear(), month, 1);
      const monthEnd = new Date(now.getFullYear(), month + 1, 0, 23, 59, 59);

      // New MRR: transações recorrentes criadas neste mês
      const newMrrMonth = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          date: { gte: monthStart, lte: monthEnd },
          ...productFilter,
        },
        _sum: { amount: true },
      });

      // Churn: assinaturas canceladas neste mês
      const churnMonth = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: 'CANCELLED',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...productFilter,
        },
        _sum: { amount: true },
      });

      // Overdue: transações que viraram OVERDUE neste mês
      const overdueMonth = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: 'OVERDUE',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...productFilter,
        },
        _sum: { amount: true },
      });

      const newMrrMonthValue = Number(newMrrMonth._sum.amount || 0);
      const churnMonthValue = Number(churnMonth._sum.amount || 0);
      const overdueMonthValue = Number(overdueMonth._sum.amount || 0);

      // Acumular: adiciona new, subtrai churn e overdue
      ytd += newMrrMonthValue - churnMonthValue - overdueMonthValue;
    }

    // ARR: Projeção anualizada (MRR × 12) - v2.13.0
    const arr = mrr * 12;

    const newMrrValue = newMrrFilteredMetrics.reduce((sum, t) => sum + Number(t.amount), 0);
    const churnMrrValue = churnMrrFiltered.reduce((sum, t) => sum + Number(t.amount), 0);

    // ═══════════════════════════════════════════════════════════════
    // CÁLCULOS - QUANTIDADES (para CHURN RATE e INADIMPLÊNCIA)
    // ═══════════════════════════════════════════════════════════════
    const totalMrrsAtual = mrrAtualFiltered.length;
    const totalMrrsAnterior = mrrAnteriorFiltered.length;
    const totalMrrsCancelados = churnMrrFiltered.length;

    // ═══════════════════════════════════════════════════════════════
    // CHURN RATE: % de assinaturas canceladas em relação à BASE ATUAL
    // Fórmula: cancelados / (ativos_atuais + cancelados)
    // Exemplo: 1 cancelado / (4 ativos + 1 cancelado) = 20%
    // Lógica: "Perdi X% dos clientes que tenho/tinha AGORA"
    // ═══════════════════════════════════════════════════════════════
    const totalBaseAtual = totalMrrsAtual + totalMrrsCancelados;
    const churnRate = totalBaseAtual > 0
      ? (totalMrrsCancelados / totalBaseAtual) * 100
      : 0;

    // Tendências (% de variação em relação ao mês anterior)
    const mrrTrend = mrrPrevious > 0
      ? ((mrr - mrrPrevious) / mrrPrevious) * 100
      : (mrr > 0 ? 100 : 0);

    // ARR Trend: comparação com o ano passado (YoY)
    const arrTrend = arrLastYear > 0
      ? ((arr - arrLastYear) / arrLastYear) * 100
      : (arr > 0 ? 100 : 0);

    // Calcular tendências (variação % em relação ao mês anterior)
    const newMrrTrend = newMrrPreviousValue > 0
      ? ((newMrrValue - newMrrPreviousValue) / newMrrPreviousValue) * 100
      : (newMrrValue > 0 ? 100 : 0);

    // ═══════════════════════════════════════════════════════════════
    // CHURN MRR %: Mostra quanto % do MRR ATUAL o churn representa
    // Fórmula: churn / MRR_atual
    // Exemplo: R$ 10k churn / R$ 75k MRR atual = 13.3%
    // Lógica: "O churn representa X% da minha receita ATUAL"
    // ═══════════════════════════════════════════════════════════════
    const churnMrrPercentage = mrr > 0
      ? (churnMrrValue / mrr) * 100
      : 0;

    // ═══════════════════════════════════════════════════════════════
    // CHURN RATE PREVIOUS: Usa total de 2 meses atrás como denominador (FIX)
    // ✅ CORRIGIDO: totalMrrsTwoMonthsAgo (não totalMrrsAnterior)
    // ═══════════════════════════════════════════════════════════════
    const churnRatePrevious = totalMrrsTwoMonthsAgo > 0
      ? (churnMrrPreviousFiltered.length / totalMrrsTwoMonthsAgo) * 100
      : 0;

    const churnRateTrend = churnRatePrevious > 0
      ? ((churnRate - churnRatePrevious) / churnRatePrevious) * 100
      : (churnRate > 0 ? 100 : 0);

    // ═══════════════════════════════════════════════════════════════
    // INADIMPLÊNCIA %: Mostra quanto % do MRR está vencido (INDUSTRY STANDARD)
    // Compara % atual vs % mês anterior (não valores absolutos)
    // Exemplo: R$ 10k overdue de R$ 100k MRR = 10%
    // ═══════════════════════════════════════════════════════════════
    const inadimplenciaPercentage = mrr > 0
      ? (inadimplenciaValue / mrr) * 100
      : 0;

    const inadimplenciaPercentagePrevious = mrrPrevious > 0
      ? (inadimplenciaPreviousValue / mrrPrevious) * 100
      : 0;

    const inadimplenciaTrend = inadimplenciaPercentagePrevious > 0
      ? ((inadimplenciaPercentage - inadimplenciaPercentagePrevious) / inadimplenciaPercentagePrevious) * 100
      : (inadimplenciaPercentage > 0 ? 100 : 0);

    return {
      mrr: {
        value: mrr,
        formatted: this.formatCurrency(mrr),
        trend: `${mrrTrend >= 0 ? '+' : ''}${Math.round(mrrTrend * 10) / 10}%`,
        up: mrrTrend >= 0
      },
      ytd: {
        value: ytd,
        formatted: this.formatCurrency(ytd),
        trend: '', // YTD não tem trend (é acumulado do ano)
        up: true   // Sempre true (sem indicador de cor)
      },
      newMrr: {
        value: newMrrValue,
        formatted: this.formatCurrency(newMrrValue),
        trend: `${newMrrTrend >= 0 ? '+' : ''}${Math.round(newMrrTrend * 10) / 10}%`,
        up: newMrrTrend >= 0
      },
      churnMrr: {
        value: churnMrrValue,
        formatted: this.formatCurrency(churnMrrValue),
        trend: `-${Math.round(churnMrrPercentage * 10) / 10}%`, // Sempre negativo (perda)
        up: false // Sempre false (é perda de receita)
      },
      churnRate: {
        value: churnRate,
        formatted: `${Math.round(churnRate * 10) / 10}%`,
        trend: `${churnRateTrend >= 0 ? '+' : ''}${Math.round(churnRateTrend * 10) / 10}%`,
        up: churnRateTrend < 0 // Churn Rate menor é melhor
      },
      inadimplencia: {
        value: inadimplenciaValue,
        formatted: this.formatCurrency(inadimplenciaValue), // Mostra R$ valor (não %)
        trend: `${inadimplenciaTrend >= 0 ? '+' : ''}${Math.round(inadimplenciaTrend * 10) / 10}%`,
        up: inadimplenciaTrend < 0 // Inadimplência menor é melhor
      },
      arr: {
        value: arr,
        formatted: this.formatCurrency(arr),
        trend: `${arrTrend >= 0 ? '+' : ''}${Math.round(arrTrend * 10) / 10}%`,
        up: arrTrend >= 0
      },
    };
  }

  // ════════════════════════════════════════════════════════════════
  // MRR HISTORY (igual protótipo linha 16-23)
  // ════════════════════════════════════════════════════════════════

  async getMrrHistory(months: number = 6, productType?: string) {
    console.log(`[getMrrHistory] INÍCIO - months: ${months}, productType: ${productType}`);
    const result: Array<{ name: string; expansion: number; mrr: number; churn: number }> = [];
    const now = new Date();

    // ═══════════════════════════════════════════════════════════════
    // FILTRO DE PRODUTO (se especificado)
    // ═══════════════════════════════════════════════════════════════
    const productFilter = productType && productType !== 'ALL'
      ? {
          OR: [
            { productType: productType as any },
            { client: { productType: productType as any } },
          ],
        }
      : {};

    // Se months >= 999, calcular desde a primeira transação
    let finalMonths = months;
    if (months >= 999) {
      const firstTransaction = await this.prisma.financeTransaction.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      if (firstTransaction) {
        const firstDate = new Date(firstTransaction.createdAt);
        const monthsDiff = (now.getFullYear() - firstDate.getFullYear()) * 12 +
                          (now.getMonth() - firstDate.getMonth()) + 1;
        finalMonths = Math.max(monthsDiff, 1);
      } else {
        finalMonths = 6;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MRR INICIAL
    // ═══════════════════════════════════════════════════════════════
    const firstMonthStart = new Date(now.getFullYear(), now.getMonth() - finalMonths + 1, 1);

    const mrrInicial = await this.prisma.financeTransaction.aggregate({
      where: {
        type: 'INCOME',
        isRecurring: true,
        status: { in: ['PAID', 'PENDING'] },
        date: { lt: firstMonthStart },
        ...productFilter,
      },
      _sum: { amount: true },
    });

    let mrrAcumulado = Number(mrrInicial._sum.amount || 0);

    for (let i = finalMonths - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleString('pt-BR', { month: 'short' });

      // New MRR - Transações recorrentes criadas no mês (independente do status atual)
      const newMrr = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          // ✅ SEM filtro de status - conta quando foi criada/registrada
          date: { gte: monthStart, lte: monthEnd }, // ✅ Filtrar por data da transação financeira
          ...productFilter,
        },
        _sum: { amount: true },
      });

      // Expansion - Transações não-recorrentes pagas no mês
      const expansion = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: false,
          status: 'PAID',
          date: { gte: monthStart, lte: monthEnd },
          ...productFilter,
        },
        _sum: { amount: true },
      });

      // Churn - Transações recorrentes canceladas no mês
      const churn = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: 'CANCELLED',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...productFilter,
        },
        _sum: { amount: true },
      });

      // Overdue - Transações que viraram OVERDUE no mês (descontam do MRR mas não são churn)
      const overdue = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: 'OVERDUE',
          updatedAt: { gte: monthStart, lte: monthEnd }, // Virou OVERDUE neste mês
          ...productFilter,
        },
        _sum: { amount: true },
      });

      const newMrrValue = Number(newMrr._sum.amount || 0);
      const churnValue = Number(churn._sum.amount || 0);
      const overdueValue = Number(overdue._sum.amount || 0);
      const expansionValue = Number(expansion._sum.amount || 0);

      const label = finalMonths > 12
        ? `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${monthStart.getFullYear().toString().slice(-2)}`
        : monthName.charAt(0).toUpperCase() + monthName.slice(1);

      console.log(`[getMrrHistory] Mês ${label} (${monthStart.toISOString().split('T')[0]}):`);
      console.log(`  - newMrrValue: R$ ${newMrrValue}`);
      console.log(`  - expansionValue: R$ ${expansionValue}`);
      console.log(`  - churnValue: R$ ${churnValue}`);
      console.log(`  - overdueValue: R$ ${overdueValue}`);
      console.log(`  - mrrAcumulado ANTES: R$ ${mrrAcumulado}`);

      mrrAcumulado += newMrrValue - churnValue - overdueValue; // ✅ Subtrai churn e overdue do MRR

      console.log(`  - mrrAcumulado DEPOIS: R$ ${mrrAcumulado}`);

      result.push({
        name: label,
        mrr: mrrAcumulado, // ✅ Renomeado de "new" para "mrr"
        expansion: expansionValue,
        churn: Math.abs(churnValue), // ✅ Positivo (não empilha negativamente)
      });
    }

    console.log(`[getMrrHistory] RESULTADO FINAL (${result.length} meses):`, JSON.stringify(result, null, 2));
    return result;
  }

  // ════════════════════════════════════════════════════════════════
  // AGING REPORT (igual protótipo linha 25-30)
  // ════════════════════════════════════════════════════════════════

  async getAgingReport(productType?: string) {
    // ═══════════════════════════════════════════════════════════════
    // FILTRO DE PRODUTO (se especificado)
    // ═══════════════════════════════════════════════════════════════
    const productFilter = productType && productType !== 'ALL'
      ? {
          OR: [
            { productType: productType as any }, // Transação tem produto direto
            { client: { productType: productType as any } }, // OU cliente tem produto
          ],
        }
      : {};

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalizar para comparação de data

    const ranges = [
      { range: '0-30 dias', min: 0, max: 30 },
      { range: '31-60 dias', min: 31, max: 60 },
      { range: '61-90 dias', min: 61, max: 90 },
      { range: '90+ dias', min: 91, max: 9999 },
    ];

    const data = [];
    let total = 0;

    for (const r of ranges) {
      const minDate = new Date(now); minDate.setDate(minDate.getDate() - r.max);
      const maxDate = new Date(now); maxDate.setDate(maxDate.getDate() - r.min);

      // ✅ v2.43.0: Buscar transações não pagas com dueDate na faixa (status calculado dinamicamente)
      const transactions = await this.prisma.financeTransaction.findMany({
        where: {
          type: 'INCOME',
          dueDate: { gte: minDate, lt: maxDate },
          paidAt: null, // ✅ Ainda não pago
          status: { not: 'CANCELLED' }, // ✅ Não cancelado
          ...productFilter,
        },
        include: this.getInclude(),
      });

      // Filtrar apenas transações OVERDUE (usando status calculado)
      const overdueTransactions = transactions.filter(t => this.getCalculatedStatus(t) === 'OVERDUE');
      const value = overdueTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

      total += value;
      data.push({ range: r.range, value });
    }

    return { data, total, totalFormatted: this.formatCurrency(total) };
  }

  // ════════════════════════════════════════════════════════════════
  // ARR HISTORY (ANUAL) - Para filtro "Tudo"
  // ════════════════════════════════════════════════════════════════
  async getArrHistory(productType?: string) {
    // ═══════════════════════════════════════════════════════════════
    // FILTRO DE PRODUTO (se especificado)
    // ═══════════════════════════════════════════════════════════════
    const productFilter = productType && productType !== 'ALL'
      ? {
          OR: [
            { productType: productType as any }, // Transação tem produto direto
            { client: { productType: productType as any } }, // OU cliente tem produto
          ],
        }
      : {};

    // 1. Buscar primeira e última transação para definir intervalo de anos
    const firstTransaction = await this.prisma.financeTransaction.findFirst({
      where: { type: 'INCOME' },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    if (!firstTransaction) {
      return []; // Sem dados
    }

    const firstYear = firstTransaction.date.getFullYear();
    const currentYear = new Date().getFullYear();

    const result = [];

    // 2. Para cada ano, calcular ARR médio
    for (let year = firstYear; year <= currentYear; year++) {
      const yearStart = new Date(year, 0, 1); // 1º Jan
      const yearEnd = new Date(year, 11, 31, 23, 59, 59); // 31 Dez

      // ARR = Soma de todas as assinaturas recorrentes ativas no ano * 12
      // Consideramos "ativas no ano" = criadas antes/durante o ano E não canceladas ou canceladas depois
      const activeSubscriptions = await this.prisma.financeTransaction.aggregate({
        where: {
          type: 'INCOME',
          isRecurring: true,
          status: { in: ['PAID', 'PENDING', 'CANCELLED'] },
          date: { lte: yearEnd }, // Iniciadas até o fim do ano
          ...productFilter,
          OR: [
            { status: { in: ['PAID', 'PENDING'] } }, // Ainda ativas
            {
              status: 'CANCELLED',
              updatedAt: { gt: yearEnd }, // Ou canceladas DEPOIS do ano
            },
          ],
        },
        _sum: { amount: true },
      });

      const mrr = Number(activeSubscriptions._sum.amount || 0);
      const arr = mrr * 12;

      result.push({
        name: year.toString(),
        arr,
      });
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  private getInclude() {
    return {
      client: {
        select: {
          id: true,
          company: true,
          contactName: true, // v2.43.0: Adicionar nome do contato para exibição
          productType: true,
          vendedor: { select: { id: true, name: true } },
        },
      },
      creator: { select: { id: true, name: true } },
    };
  }

  /**
   * Calcula status dinamicamente baseado em regras de negócio
   * Alinhado com padrão de mercado (Stripe, Pagar.me, Stone)
   *
   * @param transaction - Transação financeira
   * @returns Status calculado (PAID, PENDING, OVERDUE, CANCELLED)
   */
  private getCalculatedStatus(transaction: any): string {
    // 1. CANCELLED sempre tem precedência
    if (transaction.status === 'CANCELLED') {
      return 'CANCELLED';
    }

    // 2. Se pagou (paidAt preenchido), status é PAID
    if (transaction.paidAt) {
      return 'PAID';
    }

    // 3. Se não pagou e venceu, status é OVERDUE
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar para comparação de data (ignorar horas)

    if (transaction.dueDate) {
      const dueDate = new Date(transaction.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        return 'OVERDUE';
      }
    }

    // 4. Default: PENDING (aguardando pagamento ou sem vencimento)
    return 'PENDING';
  }

  private format(t: any) {
    const productType = t.productType || t.client?.productType || null;
    const calculatedStatus = this.getCalculatedStatus(t); // ✅ v2.43.0: Status calculado dinamicamente

    return {
      id: t.id,
      description: t.description,
      client: t.client?.company || 'Avulso',
      clientContactName: t.client?.contactName || null, // v2.43.0: Nome do contato
      clientId: t.clientId,
      productType,
      productTypeLabel: productType === 'ONE_NEXUS' ? 'One Nexus' : productType === 'LOCADORAS' ? 'Locadoras' : null,
      vendedor: t.client?.vendedor?.name || null,
      vendedorId: t.client?.vendedor?.id || null,
      amount: Number(t.amount),
      amountFormatted: `R$ ${Number(t.amount).toLocaleString('pt-BR')}`,
      date: t.date.toISOString().split('T')[0],
      dateFormatted: t.date.toLocaleDateString('pt-BR'),
      dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
      dueDateFormatted: t.dueDate ? t.dueDate.toLocaleDateString('pt-BR') : null,
      status: calculatedStatus, // ✅ v2.43.0: Usar status calculado (não DB)
      statusLabel: STATUS_LABELS[calculatedStatus as keyof typeof STATUS_LABELS],
      statusColor: STATUS_COLORS[calculatedStatus as keyof typeof STATUS_COLORS],
      type: t.type,
      category: t.category,
      categoryLabel: CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS],
      isRecurring: t.isRecurring,
    };
  }

  private formatCurrency(value: number): string {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
    return `R$ ${value.toLocaleString('pt-BR')}`;
  }

  // ════════════════════════════════════════════════════════════════
  // IMPORTAÇÃO DE PDF
  // ════════════════════════════════════════════════════════════════

  async importPdf(buffer: Buffer, userId: string) {
    try {
      // Parse do PDF
      const data = await pdfParse(buffer);
      const text = data.text;

      if (!text || text.trim().length === 0) {
        throw new BadRequestException('PDF não contém texto extraível');
      }

      // Extrair transações usando regex (formato básico)
      // Padrão: Data | Descrição | Valor
      // Exemplo: 15/01/2024 | Assinatura One Nexus | R$ 299,00

      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const transactions: any[] = [];

      // Regex para encontrar padrões de data e valor
      const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
      const valueRegex = /R\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const dateMatch = line.match(dateRegex);
        const valueMatch = line.match(valueRegex);

        if (dateMatch && valueMatch) {
          // Extrair data
          const [, day, month, year] = dateMatch;
          const fullYear = year.length === 2 ? `20${year}` : year;
          const date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          // Extrair valor
          const valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
          const amount = parseFloat(valueStr);

          // Extrair descrição (texto entre data e valor)
          let description = line
            .replace(dateMatch[0], '')
            .replace(valueMatch[0], '')
            .trim()
            .replace(/\|/g, '')
            .trim();

          if (!description) {
            description = `Transação ${i + 1}`;
          }

          // Limitar descrição a 300 caracteres
          if (description.length > 300) {
            description = description.substring(0, 297) + '...';
          }

          transactions.push({
            description,
            amount,
            date,
            type: 'INCOME',
            category: 'SUBSCRIPTION',
            status: 'PENDING',
            isRecurring: false,
          });
        }
      }

      if (transactions.length === 0) {
        throw new BadRequestException(
          'Não foi possível extrair transações do PDF. ' +
          'O PDF deve conter linhas com Data | Descrição | Valor (ex: 15/01/2024 | Assinatura | R$ 299,00)'
        );
      }

      return {
        extracted: transactions.length,
        transactions,
        message: `${transactions.length} transação(ões) extraída(s). Revise os dados antes de salvar.`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Erro ao processar PDF: ${error.message}`);
    }
  }
}
