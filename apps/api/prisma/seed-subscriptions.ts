/**
 * Seed de Subscriptions para Clientes Existentes
 * Executar UMA VEZ após migration add-subscription-billing-lifecycle
 *
 * @version 2.40.0
 * @description Cria subscriptions para todos os clientes ATIVO que não têm subscription
 */

import { PrismaClient, ClientStatus, BillingCycle } from '@prisma/client';

const prisma = new PrismaClient();

// Helper timezone Brasília
function getBrasiliaDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function parseDateBrasilia(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 15, 0, 0, 0));
}

function getDayInBrasilia(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
    }).format(date),
  );
}

function calculatePeriodEnd(periodStart: Date, cycle: BillingCycle): Date {
  const end = new Date(periodStart);
  switch (cycle) {
    case 'ANNUAL':
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
    case 'SEMIANNUAL':
      end.setUTCMonth(end.getUTCMonth() + 6);
      break;
    case 'QUARTERLY':
      end.setUTCMonth(end.getUTCMonth() + 3);
      break;
    case 'MONTHLY':
    default:
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
  }
  return end;
}

function getNextBillingDate(fromDate: Date, anchorDay: number, cycle: BillingCycle): Date {
  const from = new Date(fromDate);
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();

  switch (cycle) {
    case 'ANNUAL':
      year += 1;
      break;
    case 'SEMIANNUAL':
      month += 6;
      break;
    case 'QUARTERLY':
      month += 3;
      break;
    case 'MONTHLY':
    default:
      month += 1;
      break;
  }

  if (month > 11) {
    year += Math.floor(month / 12);
    month = month % 12;
  }

  const safeAnchor = Math.min(anchorDay, 28);
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(safeAnchor, lastDayOfMonth);

  return new Date(Date.UTC(year, month, day, 15, 0, 0, 0));
}

async function seedSubscriptions() {
  console.log('🔄 Iniciando seed de subscriptions...\n');

  // Buscar todos os clientes ATIVO que não têm subscription
  const clients = await prisma.client.findMany({
    where: {
      status: ClientStatus.ATIVO,
      subscriptions: { none: {} },
    },
    include: { plan: true },
  });

  console.log(`📋 Encontrados ${clients.length} clientes sem subscription\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    try {
      // Determinar anchor day
      let anchorDay: number;
      if (client.firstPaymentDate) {
        anchorDay = Math.min(getDayInBrasilia(client.firstPaymentDate), 28);
      } else {
        // Fallback: usar data de criação ou dia 1
        anchorDay = Math.min(getDayInBrasilia(client.createdAt), 28) || 1;
      }

      // Calcular período atual baseado na data de hoje
      const now = getBrasiliaDate();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), anchorDay);
      if (periodStart > now) {
        periodStart.setMonth(periodStart.getMonth() - 1);
      }

      const periodEnd = calculatePeriodEnd(periodStart, client.billingCycle);
      const nextBillingDate = getNextBillingDate(periodStart, anchorDay, client.billingCycle);

      // Determinar valor baseado no plano
      const amount = client.plan?.priceMonthly || 0;

      const subscription = await prisma.subscription.create({
        data: {
          clientId: client.id,
          planId: client.planId,
          billingCycle: client.billingCycle || 'MONTHLY',
          billingAnchorDay: anchorDay,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextBillingDate,
          status: 'ACTIVE',
          gracePeriodDays: 7,
          amount: amount,
        },
      });

      // Atualizar referência no client
      await prisma.client.update({
        where: { id: client.id },
        data: { activeSubscriptionId: subscription.id },
      });

      console.log(
        `✅ ${client.company}: anchor day ${anchorDay}, próximo billing ${nextBillingDate.toISOString().split('T')[0]}`,
      );
      successCount++;
    } catch (error: any) {
      console.error(`❌ Erro ao criar subscription para ${client.company}:`, error.message || error);
      errorCount++;
    }
  }

  console.log(`\n🎉 Seed concluído!`);
  console.log(`✅ Sucesso: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
}

seedSubscriptions()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
