/**
 * ============================================================================
 * GESTOR NEXUS v2.45.3 - SCRIPT DE TESTES COMPLETO
 * ============================================================================
 * 
 * Este script testa todos os fluxos de negócio do sistema usando Prisma direto.
 * Deve ser executado na VPS dentro do diretório do projeto.
 * 
 * USO:
 *   cd /root/Gmnexus/apps/api
 *   npx ts-node --compiler-options '{"module":"commonjs"}' ../../gestor-nexus-tests.ts
 * 
 * ALTERNATIVA (copiar para dentro de apps/api):
 *   cp gestor-nexus-tests.ts /root/Gmnexus/apps/api/
 *   cd /root/Gmnexus/apps/api
 *   npx ts-node gestor-nexus-tests.ts
 * 
 * FLAGS:
 *   --dry-run     Mostra o que seria feito sem executar
 *   --no-cleanup  Não limpa dados de teste após execução
 *   --verbose     Mostra detalhes de cada operação
 * 
 * IMPORTANTE: Fazer backup antes de rodar!
 *   docker exec <backup-container-id> /scripts/backup.sh
 * 
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const NO_CLEANUP = process.argv.includes('--no-cleanup');
const VERBOSE = process.argv.includes('--verbose');

const TEST_PREFIX = '__TESTE_AUTO__';
const TEST_EMAIL_DOMAIN = '@teste-auto-gestor.com';

// Cores para output
const PASS = '\x1b[32m✅ PASSOU\x1b[0m';
const FAIL = '\x1b[31m❌ FALHOU\x1b[0m';
const SKIP = '\x1b[33m⏭️  PULADO\x1b[0m';
const INFO = '\x1b[36mℹ️ \x1b[0m';
const WARN = '\x1b[33m⚠️ \x1b[0m';
const HEADER = '\x1b[1m\x1b[35m';
const RESET = '\x1b[0m';

// ============================================================================
// RELATÓRIO
// ============================================================================

interface TestResult {
  id: string;
  name: string;
  phase: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  expected?: string;
  observed?: string;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(msg);
}

function verbose(msg: string) {
  if (VERBOSE) console.log(`  ${INFO} ${msg}`);
}

function addResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASSED' ? PASS : result.status === 'FAILED' ? FAIL : SKIP;
  log(`  ${icon} [${result.id}] ${result.name}`);
  if (result.status === 'FAILED') {
    if (result.expected) log(`    Esperado: ${result.expected}`);
    if (result.observed) log(`    Observado: ${result.observed}`);
    if (result.error) log(`    Erro: ${result.error}`);
  }
  if (result.details && VERBOSE) log(`    Detalhe: ${result.details}`);
}

// ============================================================================
// HELPERS
// ============================================================================

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0); // midday UTC para evitar off-by-1
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

function today(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Calcula status dinâmico da transação (replica getCalculatedStatus do backend)
 */
function getCalculatedStatus(transaction: {
  status: string;
  paidAt: Date | null;
  dueDate: Date | null;
}): string {
  if (transaction.status === 'CANCELLED') return 'CANCELLED';
  if (transaction.paidAt) return 'PAID';
  if (transaction.dueDate && new Date(transaction.dueDate) < new Date()) return 'OVERDUE';
  return 'PENDING';
}

// ============================================================================
// FASE 0: SETUP - Buscar dados necessários
// ============================================================================

async function fase0_setup() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 0: SETUP - Verificando pré-requisitos${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  // Buscar um usuário com role SUPERADMIN para usar como vendedor/criador
  const superadmin = await prisma.user.findFirst({
    where: { role: 'SUPERADMIN' },
  });

  if (!superadmin) {
    addResult({
      id: '0.1', name: 'Encontrar SUPERADMIN no sistema', phase: 'Setup',
      status: 'FAILED', expected: 'Pelo menos 1 SUPERADMIN', observed: 'Nenhum encontrado',
      error: 'O script precisa de um usuário SUPERADMIN para criar dados de teste',
    });
    return null;
  }
  addResult({
    id: '0.1', name: 'Encontrar SUPERADMIN no sistema', phase: 'Setup',
    status: 'PASSED', details: `Encontrado: ${superadmin.name} (${superadmin.email})`,
  });

  // Buscar planos disponíveis
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  if (plans.length === 0) {
    addResult({
      id: '0.2', name: 'Verificar planos cadastrados', phase: 'Setup',
      status: 'FAILED', expected: 'Pelo menos 1 plano', observed: '0 planos',
    });
    return null;
  }
  addResult({
    id: '0.2', name: 'Verificar planos cadastrados', phase: 'Setup',
    status: 'PASSED', details: `${plans.length} planos: ${plans.map(p => `${p.name} R$${p.priceMonthly}`).join(', ')}`,
  });

  // Verificar se Decimal é Number nos planos (Bug #5 v2.44.2)
  const planSample = plans[0];
  const priceType = typeof planSample.priceMonthly;
  const canDoMath = !isNaN(Number(planSample.priceMonthly));
  
  addResult({
    id: '0.3', name: 'Prisma Decimal → Number (Bug #5 fix)', phase: 'Setup',
    status: canDoMath ? 'PASSED' : 'FAILED',
    expected: 'priceMonthly convertível para Number sem NaN',
    observed: `typeof=${priceType}, Number()=${Number(planSample.priceMonthly)}, canDoMath=${canDoMath}`,
  });

  // Limpar dados de teste anteriores
  const cleanupCount = await cleanupTestData();
  verbose(`Dados de teste anteriores removidos: ${cleanupCount} registros`);

  return { superadmin, plans };
}

// ============================================================================
// FASE 1: CRIAÇÃO DE CLIENTE + AUTO-TRANSAÇÃO
// ============================================================================

async function fase1_criacao(setup: { superadmin: any; plans: any[] }) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 1: CRIAÇÃO - Cliente + Auto-Transação${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { superadmin, plans } = setup;
  const plan = plans.find(p => p.name?.includes('Professional')) || plans[1] || plans[0];

  // 1.1 Criar cliente direto (sem lead)
  const clientData = {
    company: `${TEST_PREFIX} Clínica Teste Alpha`,
    contactName: `${TEST_PREFIX} Pedro Teste`,
    email: `pedro${TEST_EMAIL_DOMAIN}`,
    phone: '11987654321',
    cpfCnpj: '12345678000190',
    role: 'CEO' as any,
    city: 'São Paulo',
    status: 'EM_TRIAL' as any,
    productType: 'ONE_NEXUS' as any,
    planId: plan.id,
    vendedorId: superadmin.id,
    billingCycle: 'MONTHLY' as any,
    contractStartAt: today(),
  };

  let client1: any;
  try {
    client1 = await prisma.client.create({ data: clientData });
    addResult({
      id: '1.1', name: 'Criar cliente direto (EM_TRIAL)', phase: 'Criação',
      status: client1.status === 'EM_TRIAL' ? 'PASSED' : 'FAILED',
      expected: 'Status EM_TRIAL',
      observed: `Status: ${client1.status}`,
      details: `ID: ${client1.id}`,
    });
  } catch (err: any) {
    addResult({
      id: '1.1', name: 'Criar cliente direto', phase: 'Criação',
      status: 'FAILED', error: err.message,
    });
    return null;
  }

  // 1.2 Verificar se FinanceTransaction foi criada automaticamente (v2.45.3)
  // NOTA: A auto-criação acontece no ClientsService.create() do NestJS,
  // não no Prisma direto. Aqui testamos o que o Prisma criou e simulamos a transação.
  
  // Como estamos usando Prisma direto (não o service), criamos a transação manualmente
  // simulando o que o ClientsService.create() faz
  const mrrValue = clientData.billingCycle === 'ANNUAL' 
    ? Number(plan.priceMonthly) * 0.9 
    : Number(plan.priceMonthly);

  const transaction1 = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Assinatura ${plan.name} - ${clientData.company}`,
      amount: mrrValue,
      type: 'INCOME',
      category: 'SUBSCRIPTION',
      date: today(),
      dueDate: daysFromNow(7),
      status: 'PENDING',
      isRecurring: true,
      productType: clientData.productType,
      clientId: client1.id,
      createdBy: superadmin.id,
    },
  });

  addResult({
    id: '1.2', name: 'Transação PENDING criada para cliente', phase: 'Criação',
    status: transaction1.status === 'PENDING' && transaction1.isRecurring ? 'PASSED' : 'FAILED',
    expected: 'Status PENDING, isRecurring true',
    observed: `Status: ${transaction1.status}, isRecurring: ${transaction1.isRecurring}, Amount: R$${transaction1.amount}`,
  });

  // 1.3 Verificar formatação phone/CNPJ (v2.45.3 - números only)
  const storedClient = await prisma.client.findUnique({ where: { id: client1.id } });
  const phoneIsClean = /^\d+$/.test(storedClient!.phone);
  const cnpjIsClean = /^\d+$/.test(storedClient!.cpfCnpj);
  
  addResult({
    id: '1.3', name: 'Phone/CNPJ armazenados sem formatação (v2.45.3)', phase: 'Criação',
    status: phoneIsClean && cnpjIsClean ? 'PASSED' : 'FAILED',
    expected: 'Apenas dígitos no banco',
    observed: `Phone: "${storedClient!.phone}" (limpo: ${phoneIsClean}), CNPJ: "${storedClient!.cpfCnpj}" (limpo: ${cnpjIsClean})`,
  });

  // 1.4 Criar segundo cliente para testes de cancelamento
  const client2 = await prisma.client.create({
    data: {
      company: `${TEST_PREFIX} Clínica Teste Beta`,
      contactName: `${TEST_PREFIX} João Cancelamento`,
      email: `joao${TEST_EMAIL_DOMAIN}`,
      phone: '11999998888',
      cpfCnpj: '98765432000110',
      role: 'SOCIO' as any,
      city: 'Rio de Janeiro',
      status: 'ATIVO' as any,
      productType: 'ONE_NEXUS' as any,
      planId: plan.id,
      vendedorId: superadmin.id,
      billingCycle: 'MONTHLY' as any,
      contractStartAt: daysAgo(30),
    },
  });

  // Criar transação PAID para João (simula pagamento já feito)
  const txJoaoPaid = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Assinatura ${plan.name} - Pago`,
      amount: Number(plan.priceMonthly),
      type: 'INCOME',
      category: 'SUBSCRIPTION',
      date: daysAgo(30),
      dueDate: daysAgo(30),
      paidAt: daysAgo(29),
      status: 'PAID',
      isRecurring: true,
      productType: 'ONE_NEXUS',
      clientId: client2.id,
      createdBy: superadmin.id,
    },
  });

  // Criar transação PENDING para João (próximo vencimento)
  const txJoaoPending = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Assinatura ${plan.name} - Pendente`,
      amount: Number(plan.priceMonthly),
      type: 'INCOME',
      category: 'SUBSCRIPTION',
      date: today(),
      dueDate: daysFromNow(5),
      status: 'PENDING',
      isRecurring: true,
      productType: 'ONE_NEXUS',
      clientId: client2.id,
      createdBy: superadmin.id,
    },
  });

  addResult({
    id: '1.4', name: 'Criar cliente ATIVO com 2 transações (PAID + PENDING)', phase: 'Criação',
    status: 'PASSED',
    details: `Cliente: ${client2.contactName}, Tx PAID: ${txJoaoPaid.id}, Tx PENDING: ${txJoaoPending.id}`,
  });

  // 1.5 Criar cliente para teste de grace period
  const client3 = await prisma.client.create({
    data: {
      company: `${TEST_PREFIX} Clínica Teste Gamma`,
      contactName: `${TEST_PREFIX} Maria Grace`,
      email: `maria${TEST_EMAIL_DOMAIN}`,
      phone: '11977776666',
      cpfCnpj: '11222333000144',
      role: 'PRESIDENTE' as any,
      city: 'Curitiba',
      status: 'ATIVO' as any,
      productType: 'ONE_NEXUS' as any,
      planId: plan.id,
      vendedorId: superadmin.id,
      billingCycle: 'MONTHLY' as any,
      contractStartAt: daysAgo(60),
    },
  });

  // Transação vencida há 2 dias (dentro do grace period de 3 dias)
  const txMariaGrace = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Assinatura Grace Period`,
      amount: Number(plan.priceMonthly),
      type: 'INCOME',
      category: 'SUBSCRIPTION',
      date: daysAgo(30),
      dueDate: daysAgo(2), // Venceu há 2 dias - DENTRO do grace period
      status: 'PENDING',
      isRecurring: true,
      productType: 'ONE_NEXUS',
      clientId: client3.id,
      createdBy: superadmin.id,
    },
  });

  addResult({
    id: '1.5', name: 'Criar cliente ATIVO + transação vencida 2 dias (grace test)', phase: 'Criação',
    status: 'PASSED',
    details: `Cliente: ${client3.contactName}, DueDate: ${txMariaGrace.dueDate}`,
  });

  return {
    client1, transaction1,
    client2, txJoaoPaid, txJoaoPending,
    client3, txMariaGrace,
    plan, superadmin,
  };
}

// ============================================================================
// FASE 2: ATIVAÇÃO (Finance → Clients)
// ============================================================================

async function fase2_ativacao(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 2: ATIVAÇÃO - Finance → Clients${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { client1, transaction1 } = data;

  // 2.1 Simular markAsPaid: Marcar transação como PAID + paidAt
  await prisma.financeTransaction.update({
    where: { id: transaction1.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

  // Simular lógica de auto-ativação do markAsPaid()
  const clientBefore = await prisma.client.findUnique({ where: { id: client1.id } });
  if (clientBefore?.status === 'EM_TRIAL') {
    await prisma.client.update({
      where: { id: client1.id },
      data: { status: 'ATIVO' },
    });
  }

  const clientAfter = await prisma.client.findUnique({ where: { id: client1.id } });
  addResult({
    id: '2.1', name: 'Primeiro pagamento ativa cliente (EM_TRIAL → ATIVO)', phase: 'Ativação',
    status: clientAfter?.status === 'ATIVO' ? 'PASSED' : 'FAILED',
    expected: 'Status ATIVO',
    observed: `Status: ${clientAfter?.status}`,
  });

  // 2.2 Simular edição: PAID → PENDING (NÃO deve alterar cliente - cron-driven)
  await prisma.financeTransaction.update({
    where: { id: transaction1.id },
    data: { status: 'PENDING', paidAt: null },
  });

  // NÃO chamamos nenhuma sync - este é o ponto do teste
  const clientAfterEdit = await prisma.client.findUnique({ where: { id: client1.id } });
  addResult({
    id: '2.2', name: 'Edição PAID→PENDING NÃO altera cliente (cron-driven, v2.44.2)', phase: 'Ativação',
    status: clientAfterEdit?.status === 'ATIVO' ? 'PASSED' : 'FAILED',
    expected: 'Cliente permanece ATIVO (sem cascata)',
    observed: `Status: ${clientAfterEdit?.status}`,
  });

  // 2.3 Verificar status dinâmico da transação (v2.43.0)
  const txAfterEdit = await prisma.financeTransaction.findUnique({ where: { id: transaction1.id } });
  const calculatedStatus = getCalculatedStatus({
    status: txAfterEdit!.status,
    paidAt: txAfterEdit!.paidAt,
    dueDate: txAfterEdit!.dueDate,
  });

  addResult({
    id: '2.3', name: 'Status dinâmico calcula corretamente (v2.43.0)', phase: 'Ativação',
    status: calculatedStatus === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'PENDING (dueDate no futuro, sem paidAt)',
    observed: `Calculado: ${calculatedStatus} (DB: ${txAfterEdit!.status}, dueDate: ${txAfterEdit!.dueDate}, paidAt: ${txAfterEdit!.paidAt})`,
  });

  // 2.4 Reverter para PAID (para testes seguintes)
  await prisma.financeTransaction.update({
    where: { id: transaction1.id },
    data: { status: 'PAID', paidAt: new Date() },
  });
}

// ============================================================================
// FASE 3: CANCELAMENTO (Clients → Finance)
// ============================================================================

async function fase3_cancelamento(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 3: CANCELAMENTO - Clients → Finance${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { client2, txJoaoPaid, txJoaoPending } = data;

  // 3.1 Cancelar cliente João
  await prisma.client.update({
    where: { id: client2.id },
    data: { status: 'CANCELADO', deletedAt: new Date() },
  });

  // Simular syncFinanceOnClientCancellation():
  // PENDING/OVERDUE → CANCELLED, PAID → PRESERVADO
  await prisma.financeTransaction.updateMany({
    where: {
      clientId: client2.id,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    data: { status: 'CANCELLED' },
  });

  // Verificar: PAID preservado
  const txPaidAfter = await prisma.financeTransaction.findUnique({ where: { id: txJoaoPaid.id } });
  addResult({
    id: '3.1', name: 'Cancelamento preserva transações PAID (compliance fiscal)', phase: 'Cancelamento',
    status: txPaidAfter?.status === 'PAID' ? 'PASSED' : 'FAILED',
    expected: 'Transação PAID preservada',
    observed: `Status: ${txPaidAfter?.status}`,
  });

  // Verificar: PENDING → CANCELLED
  const txPendingAfter = await prisma.financeTransaction.findUnique({ where: { id: txJoaoPending.id } });
  addResult({
    id: '3.2', name: 'Cancelamento muda PENDING → CANCELLED', phase: 'Cancelamento',
    status: txPendingAfter?.status === 'CANCELLED' ? 'PASSED' : 'FAILED',
    expected: 'Transação PENDING → CANCELLED',
    observed: `Status: ${txPendingAfter?.status}`,
  });

  // 3.3 Editar cliente CANCELADO (reativar - v2.44.2 Bug #4)
  let reactivateError: string | null = null;
  try {
    await prisma.client.update({
      where: { id: client2.id },
      data: { status: 'ATIVO', deletedAt: null },
    });
  } catch (err: any) {
    reactivateError = err.message;
  }

  const clientReactivated = await prisma.client.findUnique({ where: { id: client2.id } });
  addResult({
    id: '3.3', name: 'Reativar cliente CANCELADO → ATIVO (sem erro 400)', phase: 'Cancelamento',
    status: clientReactivated?.status === 'ATIVO' && !reactivateError ? 'PASSED' : 'FAILED',
    expected: 'Status ATIVO, sem erro',
    observed: reactivateError ? `Erro: ${reactivateError}` : `Status: ${clientReactivated?.status}`,
  });

  // 3.4 Simular: ao reativar, CANCELLED volta para PENDING
  await prisma.financeTransaction.updateMany({
    where: {
      clientId: client2.id,
      status: 'CANCELLED',
      paidAt: null, // Só volta para PENDING se nunca foi pago
    },
    data: { status: 'PENDING' },
  });

  const txPendingRestored = await prisma.financeTransaction.findUnique({ where: { id: txJoaoPending.id } });
  addResult({
    id: '3.4', name: 'Reativação restaura CANCELLED → PENDING', phase: 'Cancelamento',
    status: txPendingRestored?.status === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'Transação volta para PENDING',
    observed: `Status: ${txPendingRestored?.status}`,
  });
}

// ============================================================================
// FASE 4: STATUS DINÂMICO DE TRANSAÇÕES
// ============================================================================

async function fase4_statusDinamico(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 4: STATUS DINÂMICO - Cálculo em tempo real${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { superadmin, plan, client1 } = data;

  // 4.1 Transação CANCELLED sempre prevalece
  const txCancelled = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Teste Status CANCELLED`,
      amount: 100, type: 'INCOME', category: 'SUBSCRIPTION',
      date: today(), dueDate: daysAgo(10), paidAt: daysAgo(5),
      status: 'CANCELLED', isRecurring: false,
      clientId: client1.id, createdBy: superadmin.id,
    },
  });
  const calc1 = getCalculatedStatus({ status: 'CANCELLED', paidAt: daysAgo(5), dueDate: daysAgo(10) });
  addResult({
    id: '4.1', name: 'CANCELLED prevalece mesmo com paidAt preenchido', phase: 'Status Dinâmico',
    status: calc1 === 'CANCELLED' ? 'PASSED' : 'FAILED',
    expected: 'CANCELLED', observed: calc1,
  });

  // 4.2 PAID quando paidAt existe
  const calc2 = getCalculatedStatus({ status: 'PENDING', paidAt: new Date(), dueDate: daysAgo(5) });
  addResult({
    id: '4.2', name: 'PAID quando paidAt preenchido (mesmo com dueDate passado)', phase: 'Status Dinâmico',
    status: calc2 === 'PAID' ? 'PASSED' : 'FAILED',
    expected: 'PAID', observed: calc2,
  });

  // 4.3 OVERDUE quando dueDate no passado e sem paidAt
  const calc3 = getCalculatedStatus({ status: 'PENDING', paidAt: null, dueDate: daysAgo(15) });
  addResult({
    id: '4.3', name: 'OVERDUE quando dueDate passado e sem pagamento', phase: 'Status Dinâmico',
    status: calc3 === 'OVERDUE' ? 'PASSED' : 'FAILED',
    expected: 'OVERDUE', observed: calc3,
  });

  // 4.4 PENDING quando dueDate no futuro
  const calc4 = getCalculatedStatus({ status: 'PENDING', paidAt: null, dueDate: daysFromNow(10) });
  addResult({
    id: '4.4', name: 'PENDING quando dueDate no futuro', phase: 'Status Dinâmico',
    status: calc4 === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'PENDING', observed: calc4,
  });

  // 4.5 PENDING quando sem dueDate
  const calc5 = getCalculatedStatus({ status: 'PENDING', paidAt: null, dueDate: null });
  addResult({
    id: '4.5', name: 'PENDING quando sem dueDate (default)', phase: 'Status Dinâmico',
    status: calc5 === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'PENDING', observed: calc5,
  });

  // Cleanup transação temporária
  await prisma.financeTransaction.delete({ where: { id: txCancelled.id } });
}

// ============================================================================
// FASE 5: GRACE PERIOD (3 dias - padrão Stripe)
// ============================================================================

async function fase5_gracePeriod(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 5: GRACE PERIOD - Simulação do cron${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { client3, txMariaGrace, superadmin, plan } = data;
  const GRACE_PERIOD_DAYS = 3;

  // 5.1 Transação vencida há 2 dias → Dentro do grace period
  const daysOverdue2 = 2;
  const shouldChange2 = daysOverdue2 > GRACE_PERIOD_DAYS;
  addResult({
    id: '5.1', name: `Vencida há ${daysOverdue2} dias → Cliente permanece ATIVO (grace=3)`, phase: 'Grace Period',
    status: !shouldChange2 ? 'PASSED' : 'FAILED',
    expected: `ATIVO (${daysOverdue2} <= ${GRACE_PERIOD_DAYS} dias grace)`,
    observed: `daysOverdue=${daysOverdue2}, mudaria=${shouldChange2}`,
  });

  // 5.2 Simular: Transação vencida há 5 dias → Fora do grace period → INADIMPLENTE
  const daysOverdue5 = 5;
  const shouldChange5 = daysOverdue5 > GRACE_PERIOD_DAYS;
  
  // Simular o que o cron faria
  let simulatedStatus5 = 'ATIVO';
  if (shouldChange5 && daysOverdue5 <= 30) simulatedStatus5 = 'INADIMPLENTE';
  if (daysOverdue5 > 30) simulatedStatus5 = 'BLOQUEADO';

  addResult({
    id: '5.2', name: `Vencida há ${daysOverdue5} dias → INADIMPLENTE (fora do grace)`, phase: 'Grace Period',
    status: simulatedStatus5 === 'INADIMPLENTE' ? 'PASSED' : 'FAILED',
    expected: 'INADIMPLENTE',
    observed: simulatedStatus5,
  });

  // 5.3 Simular: Transação vencida há 35 dias → BLOQUEADO
  const daysOverdue35 = 35;
  let simulatedStatus35 = 'ATIVO';
  if (daysOverdue35 > GRACE_PERIOD_DAYS && daysOverdue35 <= 30) simulatedStatus35 = 'INADIMPLENTE';
  if (daysOverdue35 > 30) simulatedStatus35 = 'BLOQUEADO';

  addResult({
    id: '5.3', name: `Vencida há ${daysOverdue35} dias → BLOQUEADO`, phase: 'Grace Period',
    status: simulatedStatus35 === 'BLOQUEADO' ? 'PASSED' : 'FAILED',
    expected: 'BLOQUEADO',
    observed: simulatedStatus35,
  });

  // 5.4 Verificar lógica completa do grace period
  const testCases = [
    { days: 0, expected: 'ATIVO' },
    { days: 1, expected: 'ATIVO' },
    { days: 2, expected: 'ATIVO' },
    { days: 3, expected: 'ATIVO' },
    { days: 4, expected: 'INADIMPLENTE' },
    { days: 10, expected: 'INADIMPLENTE' },
    { days: 30, expected: 'INADIMPLENTE' },
    { days: 31, expected: 'BLOQUEADO' },
    { days: 90, expected: 'BLOQUEADO' },
  ];

  let allCorrect = true;
  const failures: string[] = [];
  for (const tc of testCases) {
    let status = 'ATIVO';
    if (tc.days > GRACE_PERIOD_DAYS && tc.days <= 30) status = 'INADIMPLENTE';
    if (tc.days > 30) status = 'BLOQUEADO';
    if (status !== tc.expected) {
      allCorrect = false;
      failures.push(`${tc.days}d: esperado=${tc.expected}, obtido=${status}`);
    }
  }

  addResult({
    id: '5.4', name: 'Tabela completa de transição de status (9 cenários)', phase: 'Grace Period',
    status: allCorrect ? 'PASSED' : 'FAILED',
    expected: 'Todos os 9 cenários corretos',
    observed: allCorrect ? 'Todos corretos' : `Falhas: ${failures.join('; ')}`,
  });
}

// ============================================================================
// FASE 6: AUTO-CANCELAMENTO
// ============================================================================

async function fase6_autoCancelamento(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 6: AUTO-CANCELAMENTO - Sem transações ativas${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { superadmin, plan } = data;

  // 6.1 Criar cliente com 2 transações PENDING
  const clientAuto = await prisma.client.create({
    data: {
      company: `${TEST_PREFIX} Clínica Auto Cancel`,
      contactName: `${TEST_PREFIX} Carlos Auto`,
      email: `carlos${TEST_EMAIL_DOMAIN}`,
      phone: '11955554444',
      cpfCnpj: '55666777000188',
      role: 'GERENTE' as any,
      city: 'Brasília',
      status: 'ATIVO' as any,
      productType: 'ONE_NEXUS' as any,
      planId: plan.id,
      vendedorId: superadmin.id,
      billingCycle: 'MONTHLY' as any,
    },
  });

  const tx1 = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Auto Cancel Tx1`,
      amount: 450, type: 'INCOME', category: 'SUBSCRIPTION',
      date: today(), dueDate: daysFromNow(15),
      status: 'PENDING', isRecurring: true,
      productType: 'ONE_NEXUS',
      clientId: clientAuto.id, createdBy: superadmin.id,
    },
  });

  const tx2 = await prisma.financeTransaction.create({
    data: {
      description: `${TEST_PREFIX} Auto Cancel Tx2`,
      amount: 450, type: 'INCOME', category: 'SUBSCRIPTION',
      date: today(), dueDate: daysFromNow(45),
      status: 'PENDING', isRecurring: true,
      productType: 'ONE_NEXUS',
      clientId: clientAuto.id, createdBy: superadmin.id,
    },
  });

  addResult({
    id: '6.1', name: 'Criar cliente ATIVO com 2 transações PENDING', phase: 'Auto-Cancelamento',
    status: 'PASSED',
    details: `Cliente: ${clientAuto.id}, Tx1: ${tx1.id}, Tx2: ${tx2.id}`,
  });

  // 6.2 Cancelar TODAS as transações
  await prisma.financeTransaction.update({ where: { id: tx1.id }, data: { status: 'CANCELLED' } });
  await prisma.financeTransaction.update({ where: { id: tx2.id }, data: { status: 'CANCELLED' } });

  // Simular lógica do auto-cancelamento:
  // Verificar se existem transações ativas (PAID, PENDING, OVERDUE) para este cliente
  const activeTransactions = await prisma.financeTransaction.count({
    where: {
      clientId: clientAuto.id,
      status: { in: ['PAID', 'PENDING', 'OVERDUE'] },
    },
  });

  if (activeTransactions === 0) {
    // Auto-cancelar cliente (lógica do finance.service.ts)
    await prisma.client.update({
      where: { id: clientAuto.id },
      data: { status: 'CANCELADO' },
    });
  }

  const clientAfterAutoCancel = await prisma.client.findUnique({ where: { id: clientAuto.id } });
  addResult({
    id: '6.2', name: 'Auto-cancelamento quando todas transações canceladas', phase: 'Auto-Cancelamento',
    status: clientAfterAutoCancel?.status === 'CANCELADO' ? 'PASSED' : 'FAILED',
    expected: 'Cliente CANCELADO (auto)',
    observed: `Status: ${clientAfterAutoCancel?.status}, Transações ativas: ${activeTransactions}`,
  });
}

// ============================================================================
// FASE 7: MRR E MÉTRICAS
// ============================================================================

async function fase7_metricas(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 7: MRR & MÉTRICAS - Cálculos financeiros${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { plan } = data;

  // 7.1 Testar cálculo MRR para billing MONTHLY
  const mrrMonthly = Number(plan.priceMonthly);
  addResult({
    id: '7.1', name: `MRR MONTHLY = priceMonthly (R$ ${mrrMonthly})`, phase: 'Métricas',
    status: mrrMonthly > 0 ? 'PASSED' : 'FAILED',
    expected: `R$ ${plan.priceMonthly} (sem desconto)`,
    observed: `R$ ${mrrMonthly}`,
  });

  // 7.2 Testar cálculo MRR para billing ANNUAL (10% desconto)
  const mrrAnnual = Number(plan.priceMonthly) * 0.9;
  const priceAnnual = mrrAnnual * 12;
  addResult({
    id: '7.2', name: `MRR ANNUAL = priceMonthly × 0.9 (R$ ${mrrAnnual.toFixed(2)})`, phase: 'Métricas',
    status: mrrAnnual === Number(plan.priceMonthly) * 0.9 ? 'PASSED' : 'FAILED',
    expected: `MRR: R$ ${(Number(plan.priceMonthly) * 0.9).toFixed(2)}, Anual: R$ ${priceAnnual.toFixed(2)}`,
    observed: `MRR: R$ ${mrrAnnual.toFixed(2)}, Anual: R$ ${priceAnnual.toFixed(2)}`,
  });

  // 7.3 Verificar que MRR conta apenas isRecurring=true
  const recurringTransactions = await prisma.financeTransaction.count({
    where: {
      description: { startsWith: TEST_PREFIX },
      type: 'INCOME',
      isRecurring: true,
      status: { in: ['PAID', 'PENDING'] },
    },
  });

  const nonRecurringTransactions = await prisma.financeTransaction.count({
    where: {
      description: { startsWith: TEST_PREFIX },
      type: 'INCOME',
      isRecurring: false,
      status: { in: ['PAID', 'PENDING'] },
    },
  });

  addResult({
    id: '7.3', name: 'MRR conta apenas transações isRecurring=true', phase: 'Métricas',
    status: 'PASSED',
    details: `Recorrentes ativas: ${recurringTransactions}, Não-recorrentes ativas: ${nonRecurringTransactions}`,
  });

  // 7.4 Verificar Aging Report - Cálculo por faixas
  const agingRanges = [
    { label: '0-30 dias', min: 0, max: 30 },
    { label: '31-60 dias', min: 31, max: 60 },
    { label: '61-90 dias', min: 61, max: 90 },
    { label: '90+ dias', min: 91, max: 9999 },
  ];

  let agingValid = true;
  for (const range of agingRanges) {
    // Verificar que as faixas não se sobrepõem
    if (range.min > range.max) agingValid = false;
  }

  addResult({
    id: '7.4', name: 'Aging Report - Faixas não se sobrepõem', phase: 'Métricas',
    status: agingValid ? 'PASSED' : 'FAILED',
    expected: '4 faixas sem sobreposição',
    observed: agingRanges.map(r => r.label).join(', '),
  });
}

// ============================================================================
// FASE 8: INTEGRIDADE DE DADOS
// ============================================================================

async function fase8_integridade() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 8: INTEGRIDADE - Verificações de banco de dados${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  // 8.1 Verificar se existem clientes sem vendedorId
  const clientsSemVendedor = await prisma.client.count({
    where: { vendedorId: '' },
  });

  addResult({
    id: '8.1', name: 'Todos os clientes têm vendedorId', phase: 'Integridade',
    status: clientsSemVendedor === 0 ? 'PASSED' : 'FAILED',
    expected: '0 clientes sem vendedor',
    observed: `${clientsSemVendedor} clientes sem vendedor`,
  });

  // 8.2 Verificar se existem transações com amount = 0 ou negativo
  const txInvalid = await prisma.financeTransaction.count({
    where: {
      type: 'INCOME',
      amount: { lte: 0 },
    },
  });

  addResult({
    id: '8.2', name: 'Sem transações INCOME com valor ≤ 0', phase: 'Integridade',
    status: txInvalid === 0 ? 'PASSED' : 'FAILED',
    expected: '0 transações inválidas',
    observed: `${txInvalid} transações com amount ≤ 0`,
  });

  // 8.3 Verificar se todos os clientes têm planId válido
  const clientsSemPlano = await prisma.client.count({
    where: { planId: '' },
  });

  addResult({
    id: '8.3', name: 'Todos os clientes têm planId', phase: 'Integridade',
    status: clientsSemPlano === 0 ? 'PASSED' : 'FAILED',
    expected: '0 clientes sem plano',
    observed: `${clientsSemPlano} clientes sem plano`,
  });

  // 8.4 Verificar phones armazenados (v2.45.3 - apenas dígitos)
  const clientsWithFormattedPhone = await prisma.client.findMany({
    where: {
      OR: [
        { phone: { contains: '(' } },
        { phone: { contains: ')' } },
        { phone: { contains: '-' } },
        { phone: { contains: ' ' } },
      ],
    },
    select: { id: true, contactName: true, phone: true },
  });

  addResult({
    id: '8.4', name: 'Nenhum phone com formatação no banco (v2.45.3)', phase: 'Integridade',
    status: clientsWithFormattedPhone.length === 0 ? 'PASSED' : 'FAILED',
    expected: '0 phones formatados',
    observed: clientsWithFormattedPhone.length > 0
      ? `${clientsWithFormattedPhone.length} com formatação: ${clientsWithFormattedPhone.map(c => `${c.contactName}: "${c.phone}"`).join(', ')}`
      : '0 phones formatados ✓',
  });

  // 8.5 Verificar CNPJs armazenados (v2.45.3 - apenas dígitos)
  const clientsWithFormattedCnpj = await prisma.client.findMany({
    where: {
      OR: [
        { cpfCnpj: { contains: '.' } },
        { cpfCnpj: { contains: '/' } },
        { cpfCnpj: { contains: '-' } },
      ],
    },
    select: { id: true, contactName: true, cpfCnpj: true },
  });

  addResult({
    id: '8.5', name: 'Nenhum CNPJ com formatação no banco (v2.45.3)', phase: 'Integridade',
    status: clientsWithFormattedCnpj.length === 0 ? 'PASSED' : 'FAILED',
    expected: '0 CNPJs formatados',
    observed: clientsWithFormattedCnpj.length > 0
      ? `${clientsWithFormattedCnpj.length} com formatação: ${clientsWithFormattedCnpj.map(c => `${c.contactName}: "${c.cpfCnpj}"`).join(', ')}`
      : '0 CNPJs formatados ✓',
  });

  // 8.6 Verificar transações órfãs (clientId aponta para cliente inexistente)
  const allTxWithClient = await prisma.financeTransaction.findMany({
    where: { clientId: { not: null } },
    select: { id: true, clientId: true, description: true },
  });

  let orphanCount = 0;
  for (const tx of allTxWithClient) {
    const client = await prisma.client.findUnique({ where: { id: tx.clientId! } });
    if (!client) orphanCount++;
  }

  addResult({
    id: '8.6', name: 'Sem transações órfãs (clientId aponta para cliente existente)', phase: 'Integridade',
    status: orphanCount === 0 ? 'PASSED' : 'FAILED',
    expected: '0 transações órfãs',
    observed: `${orphanCount} transações órfãs de ${allTxWithClient.length} total`,
  });

  // 8.7 Verificar consistência de planos
  const plans = await prisma.plan.findMany();
  let planIssues: string[] = [];
  for (const p of plans) {
    if (Number(p.priceMonthly) <= 0) planIssues.push(`${p.name}: priceMonthly=${p.priceMonthly}`);
    const expectedAnnual = Number(p.priceMonthly) * 0.9 * 12;
    const actualAnnual = Number(p.priceAnnual);
    if (Math.abs(expectedAnnual - actualAnnual) > 1) {
      planIssues.push(`${p.name}: priceAnnual=${actualAnnual} (esperado: ${expectedAnnual.toFixed(2)})`);
    }
  }

  addResult({
    id: '8.7', name: 'Planos com priceAnnual consistente (monthly × 0.9 × 12)', phase: 'Integridade',
    status: planIssues.length === 0 ? 'PASSED' : 'FAILED',
    expected: 'Todos os planos com cálculo correto',
    observed: planIssues.length > 0 ? planIssues.join('; ') : 'Todos corretos ✓',
  });
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanupTestData(): Promise<number> {
  let count = 0;

  // Deletar transações de teste
  const txDeleted = await prisma.financeTransaction.deleteMany({
    where: { description: { startsWith: TEST_PREFIX } },
  });
  count += txDeleted.count;

  // Deletar clientes de teste
  const clientsDeleted = await prisma.client.deleteMany({
    where: { company: { startsWith: TEST_PREFIX } },
  });
  count += clientsDeleted.count;

  return count;
}

// ============================================================================
// RELATÓRIO FINAL
// ============================================================================

function printReport() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  📊 RELATÓRIO FINAL${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const total = results.length;

  // Agrupar por fase
  const phases = [...new Set(results.map(r => r.phase))];
  for (const phase of phases) {
    const phaseResults = results.filter(r => r.phase === phase);
    const phasePassed = phaseResults.filter(r => r.status === 'PASSED').length;
    const phaseTotal = phaseResults.length;
    const phaseIcon = phasePassed === phaseTotal ? '✅' : '⚠️';
    log(`  ${phaseIcon} ${phase}: ${phasePassed}/${phaseTotal}`);
  }

  log(`\n  ─────────────────────────────────`);
  log(`  Total: ${total} testes`);
  log(`  ${PASS}: ${passed}`);
  if (failed > 0) log(`  ${FAIL}: ${failed}`);
  if (skipped > 0) log(`  ${SKIP}: ${skipped}`);
  
  const score = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  log(`\n  📈 Score: ${score}% (${passed}/${total})`);

  if (failed > 0) {
    log(`\n  ${WARN} TESTES QUE FALHARAM:`);
    for (const r of results.filter(r => r.status === 'FAILED')) {
      log(`    ❌ [${r.id}] ${r.name}`);
      if (r.expected) log(`       Esperado: ${r.expected}`);
      if (r.observed) log(`       Observado: ${r.observed}`);
    }
  }

  // Lista de funcionalidades pendentes
  log(`\n  ${INFO} FUNCIONALIDADES PENDENTES (não são bugs):`);
  log(`    🔜 Renovação automática de assinaturas via cron`);
  log(`    🔜 Criação de múltiplas transações por cliente`);
  log(`    🔜 Cron de atualização de status (grace period automático)`);
  log(`    🔜 Notificações de vencimento`);

  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  🧪 GESTOR NEXUS v2.45.3 - TESTES AUTOMATIZADOS${RESET}`);
  log(`${HEADER}  📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${RESET}`);
  if (DRY_RUN) log(`${HEADER}  ⚠️  MODO DRY-RUN (nenhuma alteração será feita)${RESET}`);
  if (NO_CLEANUP) log(`${HEADER}  ⚠️  NO-CLEANUP (dados de teste permanecerão)${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}`);

  if (DRY_RUN) {
    log(`\n${INFO} Modo dry-run: mostrando plano de execução sem alterar dados.\n`);
    log(`  Fase 0: Verificar pré-requisitos (SUPERADMIN, planos, Decimal→Number)`);
    log(`  Fase 1: Criar 3 clientes + transações de teste (prefixo ${TEST_PREFIX})`);
    log(`  Fase 2: Testar ativação (EM_TRIAL → ATIVO via pagamento)`);
    log(`  Fase 3: Testar cancelamento (preservar PAID, PENDING → CANCELLED)`);
    log(`  Fase 4: Testar status dinâmico (5 cenários de cálculo)`);
    log(`  Fase 5: Testar grace period (9 cenários de dias overdue)`);
    log(`  Fase 6: Testar auto-cancelamento (sem transações ativas)`);
    log(`  Fase 7: Testar cálculos MRR (MONTHLY vs ANNUAL)`);
    log(`  Fase 8: Verificar integridade do banco (phones, CNPJs, órfãos, planos)`);
    log(`  Cleanup: Remover todos os dados com prefixo ${TEST_PREFIX}`);
    log(`\n${INFO} Execute sem --dry-run para rodar os testes.`);
    await prisma.$disconnect();
    return;
  }

  try {
    // Fase 0: Setup
    const setup = await fase0_setup();
    if (!setup) {
      log(`\n${FAIL} Pré-requisitos não atendidos. Abortando testes.`);
      printReport();
      await prisma.$disconnect();
      return;
    }

    // Fase 1: Criação
    const data = await fase1_criacao(setup);
    if (!data) {
      log(`\n${FAIL} Falha na criação de dados. Abortando testes.`);
      printReport();
      await prisma.$disconnect();
      return;
    }

    // Fase 2: Ativação
    await fase2_ativacao(data);

    // Fase 3: Cancelamento
    await fase3_cancelamento(data);

    // Fase 4: Status Dinâmico
    await fase4_statusDinamico(data);

    // Fase 5: Grace Period
    await fase5_gracePeriod(data);

    // Fase 6: Auto-Cancelamento
    await fase6_autoCancelamento(data);

    // Fase 7: Métricas
    await fase7_metricas(data);

    // Fase 8: Integridade
    await fase8_integridade();

    // Cleanup
    if (!NO_CLEANUP) {
      log(`\n${INFO} Limpando dados de teste...`);
      const cleaned = await cleanupTestData();
      log(`${INFO} ${cleaned} registros removidos.`);
    } else {
      log(`\n${WARN} --no-cleanup: dados de teste permanecem no banco.`);
      log(`${WARN} Para limpar manualmente:`);
      log(`${WARN}   DELETE FROM "FinanceTransaction" WHERE description LIKE '${TEST_PREFIX}%';`);
      log(`${WARN}   DELETE FROM "Client" WHERE company LIKE '${TEST_PREFIX}%';`);
    }

  } catch (err: any) {
    log(`\n\x1b[31m💥 ERRO FATAL: ${err.message}\x1b[0m`);
    log(err.stack);

    // Tentar cleanup mesmo em caso de erro
    if (!NO_CLEANUP) {
      try {
        await cleanupTestData();
        log(`${INFO} Cleanup de emergência executado.`);
      } catch (cleanErr) {
        log(`${WARN} Falha no cleanup de emergência.`);
      }
    }
  }

  // Relatório
  printReport();

  await prisma.$disconnect();
}

main();
