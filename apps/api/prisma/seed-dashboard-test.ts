import { PrismaClient, ProductType, ClientStatus } from '@prisma/client';
import { subDays, subMonths } from 'date-fns';

const prisma = new PrismaClient();

/**
 * ✅ v2.50.1: Seed para testar filtros de período do Dashboard
 *
 * Cria:
 * - 3 clientes com datas variadas (7 dias, 30 dias, 90 dias atrás)
 * - FinanceTransactions PAID em diferentes meses
 * - Para testar se filtros de período funcionam corretamente
 */
async function main() {
  console.log('🌱 [Dashboard Test Seed] Iniciando...');

  // Buscar vendedor e planos
  const vendedor = await prisma.user.findFirst({
    where: { role: 'SUPERADMIN' },
  });

  if (!vendedor) {
    throw new Error('Nenhum vendedor encontrado! Execute seed principal primeiro.');
  }

  const plano = await prisma.plan.findFirst({
    where: { name: 'One Nexus Enterprise' },
  });

  if (!plano) {
    throw new Error('Plano não encontrado! Execute seed principal primeiro.');
  }

  console.log(`✅ Vendedor encontrado: ${vendedor.name} (${vendedor.id})`);
  console.log(`✅ Plano encontrado: ${plano.name} (${plano.id})`);

  // Datas de teste
  const now = new Date();
  const dates = [
    { label: '7 dias atrás', date: subDays(now, 7) },
    { label: '30 dias atrás', date: subDays(now, 30) },
    { label: '60 dias atrás', date: subDays(now, 60) },
    { label: '90 dias atrás', date: subDays(now, 90) },
    { label: '6 meses atrás', date: subMonths(now, 6) },
  ];

  // Criar clientes e transações para cada data
  for (let i = 0; i < dates.length; i++) {
    const { label, date } = dates[i];
    const companyName = `Teste Dashboard ${label}`;

    console.log(`\n📅 Criando cliente: ${companyName}`);

    // Verificar se já existe
    const existing = await prisma.client.findFirst({
      where: { company: companyName },
    });

    if (existing) {
      console.log(`⏭️  Cliente já existe, pulando...`);
      continue;
    }

    // Criar cliente com data personalizada
    const client = await prisma.client.create({
      data: {
        company: companyName,
        contactName: `Contato ${label}`,
        email: `teste-${i}@dashboard.test`,
        phone: `1199999999${i}`,
        cpfCnpj: `99999999999${i}`,
        role: 'CEO_PRESIDENTE',
        city: 'São Paulo',
        status: ClientStatus.ATIVO,
        productType: ProductType.ONE_NEXUS,
        planId: plano.id,
        vendedorId: vendedor.id,
        createdAt: date, // ✅ Data personalizada
        updatedAt: date,
      },
    });

    console.log(`✅ Cliente criado: ${client.id}`);

    // Criar FinanceTransaction PAID para aparecer no gráfico MRR
    const transaction = await prisma.financeTransaction.create({
      data: {
        description: `MRR - ${companyName}`,
        amount: plano.priceMonthly,
        type: 'INCOME',
        category: 'SUBSCRIPTION',
        date: date,
        dueDate: date,
        paidAt: date, // ✅ Marcar como PAID
        status: 'PAID',
        clientId: client.id,
        productType: ProductType.ONE_NEXUS,
        isRecurring: true, // ✅ MRR
        createdBy: vendedor.id,
        createdAt: date,
        updatedAt: date,
      },
    });

    console.log(`✅ FinanceTransaction criada: ${transaction.id} (R$ ${plano.priceMonthly})`);
  }

  console.log('\n🎉 [Dashboard Test Seed] Concluído!');
  console.log('\n📊 Resumo:');
  console.log(`   - ${dates.length} clientes criados em datas variadas`);
  console.log(`   - ${dates.length} transações PAID para gráfico MRR`);
  console.log(`   - Total MRR: R$ ${Number(plano.priceMonthly) * dates.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
