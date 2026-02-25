import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import {
  nowBrasilia,
  parseDateBrasilia,
  getDayInBrasilia,
  getNextBillingDate,
  calculatePeriodEnd,
  isPastDue,
  daysBetween,
} from '../../common/utils/date.utils';
import { BillingCycle, ClientStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('═══════════════════════════════════════════════');
    this.logger.log('🔄 SubscriptionsService INICIALIZADO');
    this.logger.log('📅 Cron billing-renewal: 09:00 UTC (06:00 BRT)');
    this.logger.log('📅 Cron overdue-detection: 12:00 UTC (09:00 BRT)');
    this.logger.log('═══════════════════════════════════════════════');
  }

  // ══════════════════════════════════════════════════════════════
  // CRIAR SUBSCRIPTION (chamado na conversão Lead → Cliente)
  // ══════════════════════════════════════════════════════════════

  async createFromConversion(
    data: {
      clientId: string;
      planId: string;
      billingCycle: BillingCycle;
      firstPaymentDate: string; // "YYYY-MM-DD"
      amount: number;
    },
    tx?: any, // Optional transaction context
  ) {
    const prisma = tx || this.prisma; // Use transaction if provided, otherwise use global Prisma

    const paymentDate = parseDateBrasilia(data.firstPaymentDate);
    const anchorDay = Math.min(getDayInBrasilia(paymentDate), 28);

    const periodEnd = calculatePeriodEnd(paymentDate, data.billingCycle);
    const nextBillingDate = getNextBillingDate(paymentDate, anchorDay, data.billingCycle);

    const subscription = await prisma.subscription.create({
      data: {
        clientId: data.clientId,
        planId: data.planId,
        billingCycle: data.billingCycle,
        billingAnchorDay: anchorDay,
        currentPeriodStart: paymentDate,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBillingDate,
        status: 'ACTIVE',
        gracePeriodDays: 7,
        amount: data.amount,
      },
    });

    // Atualizar referência no client
    await prisma.client.update({
      where: { id: data.clientId },
      data: { activeSubscriptionId: subscription.id },
    });

    this.logger.log(
      `✅ Subscription criada: ${subscription.id} | Client: ${data.clientId} | Anchor: dia ${anchorDay} | Próximo billing: ${nextBillingDate.toISOString()}`,
    );

    return subscription;
  }

  // ══════════════════════════════════════════════════════════════
  // REATIVAR CLIENTE (CANCELADO/INADIMPLENTE → ATIVO)
  // ══════════════════════════════════════════════════════════════

  async reactivate(data: {
    clientId: string;
    planId: string;
    billingCycle: BillingCycle;
    newPaymentDate: string; // "YYYY-MM-DD"
    amount: number;
    userId: string; // quem está reativando
  }) {
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId },
      include: { plan: true },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Verificar se o cliente está em status que permite reativação
    const reactivableStatuses: ClientStatus[] = ['CANCELADO', 'INADIMPLENTE', 'BLOQUEADO'];
    if (!reactivableStatuses.includes(client.status)) {
      throw new BadRequestException(
        `Cliente com status "${client.status}" não pode ser reativado. Status permitidos: ${reactivableStatuses.join(', ')}`,
      );
    }

    const paymentDate = parseDateBrasilia(data.newPaymentDate);
    const anchorDay = Math.min(getDayInBrasilia(paymentDate), 28);
    const periodEnd = calculatePeriodEnd(paymentDate, data.billingCycle);
    const nextBillingDate = getNextBillingDate(paymentDate, anchorDay, data.billingCycle);

    // Transação atômica
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cancelar subscription antiga (se existir e estiver ativa por algum motivo)
      if (client.activeSubscriptionId) {
        await tx.subscription.update({
          where: { id: client.activeSubscriptionId },
          data: {
            status: 'CANCELED',
            canceledAt: nowBrasilia(),
            cancellationReason: 'PLAN_CHANGE',
          },
        });
      }

      // 2. Criar NOVA subscription
      const newSubscription = await tx.subscription.create({
        data: {
          clientId: data.clientId,
          planId: data.planId,
          billingCycle: data.billingCycle,
          billingAnchorDay: anchorDay,
          currentPeriodStart: paymentDate,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextBillingDate,
          status: 'ACTIVE',
          gracePeriodDays: 7,
          amount: data.amount,
          metadata: {
            reactivatedAt: nowBrasilia().toISOString(),
            reactivatedBy: data.userId,
            previousSubscriptionId: client.activeSubscriptionId || null,
          },
        },
      });

      // 3. Criar FinanceTransaction PENDING (v2.47.0: integração Finance ↔ Billing)
      const financeTransaction = await tx.financeTransaction.create({
        data: {
          description: `Reativação - ${client.plan?.name || 'Plano'} - ${client.company}`,
          amount: data.amount,
          type: 'INCOME',
          category: 'SUBSCRIPTION',
          date: new Date(),
          dueDate: paymentDate,
          status: 'PENDING',
          clientId: data.clientId,
          subscriptionId: newSubscription.id,
          productType: client.productType,
          isRecurring: true,
          createdBy: data.userId,
        },
      });

      // 4. Atualizar Client → ATIVO
      const updatedClient = await tx.client.update({
        where: { id: data.clientId },
        data: {
          status: 'ATIVO',
          planId: data.planId,
          billingCycle: data.billingCycle,
          activeSubscriptionId: newSubscription.id,
        },
        include: { plan: true },
      });

      return { client: updatedClient, subscription: newSubscription, financeTransaction };
    });

    this.logger.log(
      `🔄 Cliente REATIVADO: ${client.company} | Nova subscription: ${result.subscription.id} | Próximo billing: ${nextBillingDate.toISOString()}`,
    );

    return result;
  }

  // ══════════════════════════════════════════════════════════════
  // CRON: RENOVAÇÃO AUTOMÁTICA (todo dia às 06:00 BRT = 09:00 UTC)
  // ══════════════════════════════════════════════════════════════

  @Cron('0 9 * * *', { name: 'billing-renewal' }) // 09:00 UTC = 06:00 BRT
  async handleBillingRenewal() {
    this.logger.log('🔄 [CRON] Iniciando renovação de billing...');

    const today = nowBrasilia();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar subscriptions ativas com nextBillingDate = hoje
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        client: true,
        plan: true,
      },
    });

    this.logger.log(`📋 ${subscriptions.length} subscriptions para renovar hoje`);

    for (const sub of subscriptions) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // ✅ v2.47.0: Verificar débitos pendentes antes de renovar (trava de segurança)
          const hasOverdue = await tx.financeTransaction.findFirst({
            where: {
              subscriptionId: sub.id,
              status: { in: ['PENDING', 'OVERDUE'] },
            },
          });

          if (hasOverdue) {
            this.logger.warn(
              `⚠️ Renovação bloqueada: ${sub.client.company} tem débito pendente (${hasOverdue.status})`,
            );
            return; // Não cria nova cobrança
          }

          // Calcular novo período
          const newPeriodStart = sub.currentPeriodEnd;
          const newPeriodEnd = calculatePeriodEnd(newPeriodStart, sub.billingCycle);
          const newNextBilling = getNextBillingDate(
            newPeriodStart,
            sub.billingAnchorDay,
            sub.billingCycle,
          );

          // Atualizar subscription
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              currentPeriodStart: newPeriodStart,
              currentPeriodEnd: newPeriodEnd,
              nextBillingDate: newNextBilling,
            },
          });

          // Criar novo FinanceTransaction (v2.47.0: integração Finance ↔ Billing)
          await tx.financeTransaction.create({
            data: {
              description: `Cobrança ${sub.plan?.name || 'Plano'} - ${sub.client.company}`,
              amount: sub.amount,
              type: 'INCOME',
              category: 'SUBSCRIPTION',
              date: new Date(),
              dueDate: newPeriodStart,
              status: 'PENDING',
              clientId: sub.clientId,
              subscriptionId: sub.id,
              productType: sub.client.productType,
              isRecurring: true,
              createdBy: 'SYSTEM',
            },
          });

          this.logger.log(`✅ Renovado: ${sub.client.company} | Próximo: ${newNextBilling.toISOString()}`);
        });
      } catch (error) {
        this.logger.error(`❌ Erro ao renovar subscription ${sub.id}: ${error.message}`);
      }
    }

    this.logger.log('🔄 [CRON] Renovação concluída');
  }

  // ══════════════════════════════════════════════════════════════
  // CRON: DETECÇÃO DE ATRASO (todo dia às 09:00 BRT = 12:00 UTC)
  // ══════════════════════════════════════════════════════════════

  @Cron('0 12 * * *', { name: 'overdue-detection' }) // 12:00 UTC = 09:00 BRT
  async handleOverdueDetection() {
    this.logger.log('⏰ [CRON] Iniciando detecção de atrasos...');

    const today = nowBrasilia();
    today.setHours(0, 0, 0, 0);

    // v2.47.0: Buscar FinanceTransactions vencidas (não Payments)
    const overdueTransactions = await this.prisma.financeTransaction.findMany({
      where: {
        status: 'PENDING',
        isRecurring: true,
        dueDate: { lt: today },
        subscriptionId: { not: null },
      },
      include: {
        client: true,
      },
    });

    this.logger.log(`📋 [CRON overdue] ${overdueTransactions.length} transações em atraso`);

    for (const ft of overdueTransactions) {
      try {
        // Buscar subscription vinculada
        const subscription = await this.prisma.subscription.findUnique({
          where: { id: ft.subscriptionId! },
        });

        if (!subscription) {
          this.logger.warn(`⚠️ [CRON overdue] FinanceTransaction ${ft.id} sem subscription válida`);
          continue;
        }

        // Calcular dias de atraso
        const dueDate = new Date(ft.dueDate!);
        dueDate.setHours(0, 0, 0, 0);
        const diffMs = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const gracePeriod = subscription.gracePeriodDays || 7;

        if (daysOverdue > gracePeriod) {
          // ════════════════════════════════════════════
          // ALÉM DO GRACE PERIOD → CANCELAR TUDO
          // ════════════════════════════════════════════
          await this.prisma.$transaction(async (tx) => {
            // 1. Subscription → CANCELED
            await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                status: 'CANCELED',
                canceledAt: new Date(),
                cancellationReason: 'PAYMENT_FAILURE',
              },
            });

            // 2. Client → CANCELADO
            await tx.client.update({
              where: { id: ft.clientId! },
              data: { status: 'CANCELADO' },
            });

            // 3. FinanceTransaction → CANCELLED
            await tx.financeTransaction.update({
              where: { id: ft.id },
              data: { status: 'CANCELLED' },
            });

            this.logger.warn(
              `🔴 [CRON overdue] CANCELADO: ${ft.client?.company || ft.client?.contactName || ft.clientId} | ` +
                `${daysOverdue} dias em atraso (grace: ${gracePeriod} dias)`,
            );
          });
        } else if (daysOverdue > 0) {
          // ════════════════════════════════════════════
          // DENTRO DO GRACE PERIOD → INADIMPLENTE
          // ════════════════════════════════════════════
          await this.prisma.$transaction(async (tx) => {
            // 1. Subscription → PAST_DUE
            if (subscription.status === 'ACTIVE') {
              await tx.subscription.update({
                where: { id: subscription.id },
                data: { status: 'PAST_DUE' },
              });
            }

            // 2. Client → INADIMPLENTE
            const client = await tx.client.findUnique({
              where: { id: ft.clientId! },
              select: { status: true },
            });

            if (client && client.status !== 'INADIMPLENTE' && client.status !== 'CANCELADO') {
              await tx.client.update({
                where: { id: ft.clientId! },
                data: { status: 'INADIMPLENTE' },
              });
            }

            this.logger.log(
              `🟡 [CRON overdue] INADIMPLENTE: ${ft.client?.company || ft.client?.contactName || ft.clientId} | ` +
                `${daysOverdue}/${gracePeriod} dias`,
            );
          });
        }
      } catch (error) {
        this.logger.error(`❌ [CRON overdue] Erro processando ${ft.id}: ${error.message}`);
      }
    }

    this.logger.log('⏰ [CRON] Detecção de atrasos concluída');
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  async getByClientId(clientId: string) {
    return this.prisma.subscription.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true, payments: { orderBy: { dueDate: 'desc' }, take: 5 } },
    });
  }

  async getActive(clientId: string) {
    return this.prisma.subscription.findFirst({
      where: { clientId, status: 'ACTIVE' },
      include: { plan: true },
    });
  }
}
