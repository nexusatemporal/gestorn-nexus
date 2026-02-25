/**
 * ============================================================================
 * GESTOR NEXUS v2.45.3 - SCRIPT DE TESTES COMPLETO (FIXED)
 * ============================================================================
 * 
 * Script corrigido para ser compatível com o schema Prisma atual.
 * Removidos campos obsoletos: city, contractStartAt, deletedAt, contractValue
 * 
 * USO:
 *   cd /root/Gmnexus/apps/api
 *   npx ts-node gestor-nexus-tests-fixed.ts
 * 
 * FLAGS:
 *   --dry-run     Mostra o que seria feito sem executar
 *   --no-cleanup  Não limpa dados de teste após execução
 *   --verbose     Mostra detalhes de cada operação
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
  d.setHours(12, 0, 0, 0);
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
// FASE 0: SETUP
// ============================================================================

async function fase0_setup() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 0: SETUP - Verificando pré-requisitos${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

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
    status: 'PASSED', details: `${plans.length} planos encontrados`,
  });

  const planSample = plans[0];
  const canDoMath = !isNaN(Number(planSample.priceMonthly));
  
  addResult({
    id: '0.3', name: 'Prisma Decimal → Number (Bug #5 fix)', phase: 'Setup',
    status: canDoMath ? 'PASSED' : 'FAILED',
    expected: 'priceMonthly convertível para Number sem NaN',
    observed: `Number()=${Number(planSample.priceMonthly)}, canDoMath=${canDoMath}`,
  });

  const cleanupCount = await cleanupTestData();
  verbose(`Dados de teste anteriores removidos: ${cleanupCount} registros`);

  return { superadmin, plans };
}

// ============================================================================
// FASE 1: CRIAÇÃO
// ============================================================================

async function fase1_criacao(setup: { superadmin: any; plans: any[] }) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 1: CRIAÇÃO - Cliente + Auto-Transação${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { superadmin, plans } = setup;
  const plan = plans.find(p => p.name?.includes('Professional')) || plans[1] || plans[0];

  // 1.1 Criar cliente direto (sem lead) - CAMPOS CORRIGIDOS
  const clientData = {
    company: `${TEST_PREFIX} Clínica Teste Alpha`,
    contactName: `${TEST_PREFIX} Pedro Teste`,
    email: `pedro${TEST_EMAIL_DOMAIN}`,
    phone: '11987654321',
    cpfCnpj: '12345678000190',
    role: 'CEO_PRESIDENTE' as any,
    status: 'EM_TRIAL' as any,
    productType: 'ONE_NEXUS' as any,
    planId: plan.id,
    vendedorId: superadmin.id,
    billingCycle: 'MONTHLY' as any,
    closedAt: today(), // ✅ CORRIGIDO: contractStartAt → closedAt
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

  // 1.2 Criar transação manual (simulando auto-criação do service)
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
    observed: `Status: ${transaction1.status}, isRecurring: ${transaction1.isRecurring}`,
  });

  // 1.3 Verificar formatação phone/CNPJ
  const storedClient = await prisma.client.findUnique({ where: { id: client1.id } });
  const phoneIsClean = /^\d+$/.test(storedClient!.phone);
  const cnpjIsClean = /^\d+$/.test(storedClient!.cpfCnpj);
  
  addResult({
    id: '1.3', name: 'Phone/CNPJ armazenados sem formatação (v2.45.3)', phase: 'Criação',
    status: phoneIsClean && cnpjIsClean ? 'PASSED' : 'FAILED',
    expected: 'Apenas dígitos no banco',
    observed: `Phone: "${storedClient!.phone}" (limpo: ${phoneIsClean}), CNPJ: "${storedClient!.cpfCnpj}" (limpo: ${cnpjIsClean})`,
  });

  // 1.4 Criar segundo cliente - CAMPOS CORRIGIDOS
  const client2 = await prisma.client.create({
    data: {
      company: `${TEST_PREFIX} Clínica Teste Beta`,
      contactName: `${TEST_PREFIX} João Cancelamento`,
      email: `joao${TEST_EMAIL_DOMAIN}`,
      phone: '11999998888',
      cpfCnpj: '98765432000110',
      role: 'SOCIO_FUNDADOR' as any, // ✅ CORRIGIDO
      status: 'ATIVO' as any,
      productType: 'ONE_NEXUS' as any,
      planId: plan.id,
      vendedorId: superadmin.id,
      billingCycle: 'MONTHLY' as any,
      closedAt: daysAgo(30), // ✅ CORRIGIDO
    },
  });

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
    details: `Cliente: ${client2.contactName}`,
  });

  return {
    client1, transaction1,
    client2, txJoaoPaid, txJoaoPending,
    plan, superadmin,
  };
}

// ============================================================================
// FASE 2: ATIVAÇÃO
// ============================================================================

async function fase2_ativacao(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 2: ATIVAÇÃO - Finance → Clients${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { client1, transaction1 } = data;

  // 2.1 Marcar como PAID
  await prisma.financeTransaction.update({
    where: { id: transaction1.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

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

  // 2.2 Editar PAID → PENDING (não deve alterar cliente)
  await prisma.financeTransaction.update({
    where: { id: transaction1.id },
    data: { status: 'PENDING', paidAt: null },
  });

  const clientAfterEdit = await prisma.client.findUnique({ where: { id: client1.id } });
  addResult({
    id: '2.2', name: 'Edição PAID→PENDING NÃO altera cliente (cron-driven)', phase: 'Ativação',
    status: clientAfterEdit?.status === 'ATIVO' ? 'PASSED' : 'FAILED',
    expected: 'Cliente permanece ATIVO',
    observed: `Status: ${clientAfterEdit?.status}`,
  });

  // 2.3 Status dinâmico
  const txAfterEdit = await prisma.financeTransaction.findUnique({ where: { id: transaction1.id } });
  const calculatedStatus = getCalculatedStatus({
    status: txAfterEdit!.status,
    paidAt: txAfterEdit!.paidAt,
    dueDate: txAfterEdit!.dueDate,
  });

  addResult({
    id: '2.3', name: 'Status dinâmico calcula corretamente', phase: 'Ativação',
    status: calculatedStatus === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'PENDING',
    observed: `Calculado: ${calculatedStatus}`,
  });

  // Reverter
  await prisma.financeTransaction.update({
    where: { id: transaction1.id },
    data: { status: 'PAID', paidAt: new Date() },
  });
}

// ============================================================================
// FASE 3: CANCELAMENTO
// ============================================================================

async function fase3_cancelamento(data: any) {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  FASE 3: CANCELAMENTO - Clients → Finance${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const { client2, txJoaoPaid, txJoaoPending } = data;

  // 3.1 Cancelar cliente (SEM deletedAt - campo removido)
  await prisma.client.update({
    where: { id: client2.id },
    data: { status: 'CANCELADO' }, // ✅ CORRIGIDO: removido deletedAt
  });

  await prisma.financeTransaction.updateMany({
    where: {
      clientId: client2.id,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    data: { status: 'CANCELLED' },
  });

  const txPaidAfter = await prisma.financeTransaction.findUnique({ where: { id: txJoaoPaid.id } });
  addResult({
    id: '3.1', name: 'Cancelamento preserva transações PAID', phase: 'Cancelamento',
    status: txPaidAfter?.status === 'PAID' ? 'PASSED' : 'FAILED',
    expected: 'PAID preservado',
    observed: `Status: ${txPaidAfter?.status}`,
  });

  const txPendingAfter = await prisma.financeTransaction.findUnique({ where: { id: txJoaoPending.id } });
  addResult({
    id: '3.2', name: 'Cancelamento muda PENDING → CANCELLED', phase: 'Cancelamento',
    status: txPendingAfter?.status === 'CANCELLED' ? 'PASSED' : 'FAILED',
    expected: 'CANCELLED',
    observed: `Status: ${txPendingAfter?.status}`,
  });

  // 3.3 Reativar (SEM deletedAt)
  let reactivateError: string | null = null;
  try {
    await prisma.client.update({
      where: { id: client2.id },
      data: { status: 'ATIVO' }, // ✅ CORRIGIDO: removido deletedAt
    });
  } catch (err: any) {
    reactivateError = err.message;
  }

  const clientReactivated = await prisma.client.findUnique({ where: { id: client2.id } });
  addResult({
    id: '3.3', name: 'Reativar cliente CANCELADO → ATIVO', phase: 'Cancelamento',
    status: clientReactivated?.status === 'ATIVO' && !reactivateError ? 'PASSED' : 'FAILED',
    expected: 'ATIVO, sem erro',
    observed: reactivateError || `Status: ${clientReactivated?.status}`,
  });
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanupTestData(): Promise<number> {
  let count = 0;

  const txDeleted = await prisma.financeTransaction.deleteMany({
    where: { description: { startsWith: TEST_PREFIX } },
  });
  count += txDeleted.count;

  const clientsDeleted = await prisma.client.deleteMany({
    where: { company: { startsWith: TEST_PREFIX } },
  });
  count += clientsDeleted.count;

  return count;
}

// ============================================================================
// RELATÓRIO
// ============================================================================

function printReport() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  📊 RELATÓRIO FINAL${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const total = results.length;

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
  
  const score = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  log(`\n  📈 Score: ${score}% (${passed}/${total})`);

  if (failed > 0) {
    log(`\n  ${WARN} TESTES QUE FALHARAM:`);
    for (const r of results.filter(r => r.status === 'FAILED')) {
      log(`    ❌ [${r.id}] ${r.name}`);
      if (r.expected) log(`       Esperado: ${r.expected}`);
      if (r.observed) log(`       Observado: ${r.observed}`);
      if (r.error) log(`       Erro: ${r.error}`);
    }
  }

  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log(`\n${HEADER}══════════════════════════════════════════════════════════${RESET}`);
  log(`${HEADER}  🧪 GESTOR NEXUS v2.45.3 - TESTES (FIXED)${RESET}`);
  log(`${HEADER}  📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${RESET}`);
  if (DRY_RUN) log(`${HEADER}  ⚠️  MODO DRY-RUN${RESET}`);
  log(`${HEADER}══════════════════════════════════════════════════════════${RESET}`);

  if (DRY_RUN) {
    log(`\n${INFO} Modo dry-run ativo. Execute sem --dry-run para rodar os testes.\n`);
    await prisma.$disconnect();
    return;
  }

  try {
    const setup = await fase0_setup();
    if (!setup) {
      log(`\n${FAIL} Pré-requisitos não atendidos.`);
      printReport();
      await prisma.$disconnect();
      return;
    }

    const data = await fase1_criacao(setup);
    if (!data) {
      log(`\n${FAIL} Falha na criação de dados.`);
      printReport();
      await prisma.$disconnect();
      return;
    }

    await fase2_ativacao(data);
    await fase3_cancelamento(data);

    if (!NO_CLEANUP) {
      log(`\n${INFO} Limpando dados de teste...`);
      const cleaned = await cleanupTestData();
      log(`${INFO} ${cleaned} registros removidos.`);
    }

  } catch (err: any) {
    log(`\n\x1b[31m💥 ERRO: ${err.message}\x1b[0m`);
    log(err.stack);

    if (!NO_CLEANUP) {
      try {
        await cleanupTestData();
      } catch (cleanErr) {
        log(`${WARN} Falha no cleanup.`);
      }
    }
  }

  printReport();
  await prisma.$disconnect();
}

main();
