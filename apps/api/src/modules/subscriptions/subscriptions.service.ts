import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.logger.log('═══════════════════════════════════════════════');
    this.logger.log('🔄 SubscriptionsService INICIALIZADO');
    this.logger.log('📅 Cron upcoming-billing: 08:00 UTC (05:00 BRT)');
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

        // ✅ v2.60.0: Notificar admins sobre falha crítica
        const empresa = sub.client?.company || sub.id;
        this.prisma.user.findMany({
          where: { role: { in: ['SUPERADMIN', 'ADMINISTRATIVO'] } },
          select: { id: true },
        }).then((admins) => {
          if (admins.length > 0) {
            this.notificationsService.createBulk({
              userIds: admins.map((u) => u.id),
              type: NotificationType.SYSTEM_ALERT,
              title: 'Erro na renovação automática',
              message: `Falha ao renovar ${empresa}: ${error.message}`,
              link: '/clients',
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    this.logger.log('🔄 [CRON] Renovação concluída');
  }

  // ══════════════════════════════════════════════════════════════
  // CRON: ALERTA DE COBRANÇA PRÓXIMA (todo dia às 08:00 UTC = 05:00 BRT)
  // ══════════════════════════════════════════════════════════════

  @Cron('0 8 * * *', { name: 'upcoming-billing-notification' }) // 08:00 UTC = 05:00 BRT
  async handleUpcomingBillingNotification() {
    this.logger.log('🔔 [CRON] Verificando cobranças próximas...');

    const today = nowBrasilia();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Subscriptions ativas com cobrança nos próximos 7 dias (excluindo hoje)
    const upcomingSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: {
          gte: tomorrow,
          lte: sevenDaysLater,
        },
      },
      include: {
        client: true,
        plan: true,
      },
    });

    this.logger.log(`📋 ${upcomingSubs.length} assinaturas com cobrança próxima (7 dias)`);

    for (const sub of upcomingSubs) {
      if (!sub.client?.vendedorId) continue;

      const daysUntil = daysBetween(today, new Date(sub.nextBillingDate!));
      const empresa = sub.client.company || sub.client.contactName || sub.clientId;
      const valor = Number(sub.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const planName = sub.plan?.name || 'Plano';

      this.notificationsService.create({
        userId: sub.client.vendedorId,
        type: NotificationType.SUBSCRIPTION_EXPIRING,
        title: `Cobrança em ${daysUntil} dia(s)`,
        message: `${empresa} tem cobrança de ${valor} (${planName}) em ${daysUntil} dia(s).`,
        link: '/clients',
        metadata: {
          clientId: sub.clientId,
          subscriptionId: sub.id,
          daysUntil,
          amount: Number(sub.amount),
        },
        dedupeKey: sub.id,    // throttle: 1 alerta por assinatura por 24h
        throttleHours: 24,
      }).catch(() => {});
    }

    this.logger.log('🔔 [CRON] Alertas de cobrança próxima concluídos');
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

          // Cancelar tenant no One Nexus (fora da tx, graceful degradation)
          if (ft.clientId) {
            await this.tenantsService.syncStatusToOneNexus(ft.clientId, 'canceled');
          }

          // ✅ v2.58.0: Notificar vendedor sobre cancelamento por inadimplência
          if (ft.client?.vendedorId) {
            const empresa = ft.client?.company || ft.client?.contactName || ft.clientId;
            this.notificationsService.create({
              userId: ft.client.vendedorId,
              type: NotificationType.PAYMENT_OVERDUE,
              title: 'Assinatura cancelada por inadimplência',
              message: `${empresa} foi cancelado após ${daysOverdue} dias sem pagamento.`,
              link: '/clients',
              metadata: { clientId: ft.clientId, daysOverdue, subscriptionId: ft.subscriptionId },
              dedupeKey: `cancel-${ft.clientId}`,  // 1 alerta de cancelamento por cliente
              throttleHours: 48,
            }).catch(() => {});
          }
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

          // Suspender tenant no One Nexus (fora da tx, graceful degradation)
          if (ft.clientId) {
            await this.tenantsService.syncStatusToOneNexus(ft.clientId, 'suspended');
          }

          // ✅ v2.58.0: Notificar vendedor sobre inadimplência
          if (ft.client?.vendedorId) {
            const empresa = ft.client?.company || ft.client?.contactName || ft.clientId;
            this.notificationsService.create({
              userId: ft.client.vendedorId,
              type: NotificationType.PAYMENT_OVERDUE,
              title: 'Cliente inadimplente',
              message: `${empresa} está ${daysOverdue} dia(s) sem pagamento. Prazo: ${gracePeriod} dias.`,
              link: '/clients',
              metadata: { clientId: ft.clientId, daysOverdue, gracePeriod },
              dedupeKey: `overdue-${ft.clientId}`,  // 1 alerta por cliente por 24h
              throttleHours: 24,
            }).catch(() => {});

            // ✅ v2.58.0: AI_CHURN_ALERT no primeiro dia — alerta proativo de risco de churn
            if (daysOverdue === 1) {
              this.notificationsService.create({
                userId: ft.client.vendedorId,
                type: NotificationType.AI_CHURN_ALERT,
                title: 'Risco de churn detectado',
                message: `${empresa} iniciou período de inadimplência. Contato preventivo pode evitar cancelamento.`,
                link: '/clients',
                metadata: { clientId: ft.clientId, gracePeriod, daysUntilCancel: gracePeriod },
                dedupeKey: ft.clientId ?? undefined,  // 1 churn alert por cliente por 7 dias
                throttleHours: 168,
              }).catch(() => {});
            }
          }
        }
      } catch (error) {
        this.logger.error(`❌ [CRON overdue] Erro processando ${ft.id}: ${error.message}`);

        // ✅ v2.60.0: Notificar admins sobre falha no overdue detection
        const empresa = ft.client?.company || ft.id;
        this.prisma.user.findMany({
          where: { role: { in: ['SUPERADMIN', 'ADMINISTRATIVO'] } },
          select: { id: true },
        }).then((admins) => {
          if (admins.length > 0) {
            this.notificationsService.createBulk({
              userIds: admins.map((u) => u.id),
              type: NotificationType.SYSTEM_ALERT,
              title: 'Erro na detecção de atrasos',
              message: `Falha ao processar inadimplência de ${empresa}: ${error.message}`,
              link: '/finance',
            }).catch(() => {});
          }
        }).catch(() => {});
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
