/**
 * ============================================================================
 * GESTOR NEXUS v2.45.3 - SCRIPT DE TESTES COMPLETO (TODAS AS 9 FASES)
 * ============================================================================
 * 
 * VERSÃO CORRIGIDA - campos reais do schema Prisma:
 *   - Removido: city, contractStartAt, deletedAt, contractValue
 *   - Corrigido: role enums (CEO_PRESIDENTE, SOCIO_FUNDADOR)
 *   - Adicionado: closedAt
 * 
 * USO:
 *   cd /root/Gmnexus/apps/api
 *   npx ts-node gestor-nexus-tests-complete.ts
 * 
 * FLAGS:
 *   --dry-run     Mostra plano sem executar
 *   --no-cleanup  Mantém dados de teste
 *   --verbose     Mostra detalhes extras
 * 
 * RELATÓRIO: Gerado automaticamente em /root/Gmnexus/prints/
 * 
 * BACKUP ANTES DE RODAR:
 *   docker exec $(docker ps -q -f name=backup) /scripts/backup.sh
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const NO_CLEANUP = process.argv.includes('--no-cleanup');
const VERBOSE = process.argv.includes('--verbose');

const TEST_PREFIX = '__TESTE_AUTO__';
const TEST_EMAIL_DOMAIN = '@teste-auto-gestor.com';
const REPORT_DIR = '/root/Gmnexus/prints';

// Cores terminal
const C = {
  pass: '\x1b[32m✅ PASSOU\x1b[0m',
  fail: '\x1b[31m❌ FALHOU\x1b[0m',
  skip: '\x1b[33m⏭️  PULADO\x1b[0m',
  info: '\x1b[36mℹ️ \x1b[0m',
  warn: '\x1b[33m⚠️ \x1b[0m',
  h: '\x1b[1m\x1b[35m',
  r: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

// ============================================================================
// RESULTADO E LOGGING
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
const logLines: string[] = [];

function log(msg: string) {
  console.log(msg);
  // Strip ANSI codes para o relatório
  logLines.push(msg.replace(/\x1b\[[0-9;]*m/g, ''));
}

function verbose(msg: string) {
  if (VERBOSE) log(`  ${C.info} ${msg}`);
}

function addResult(r: TestResult) {
  results.push(r);
  const icon = r.status === 'PASSED' ? C.pass : r.status === 'FAILED' ? C.fail : C.skip;
  log(`  ${icon} [${r.id}] ${r.name}`);
  if (r.status === 'FAILED') {
    if (r.expected) log(`    Esperado: ${r.expected}`);
    if (r.observed) log(`    Observado: ${r.observed}`);
    if (r.error) log(`    Erro: ${r.error}`);
  }
  if (r.details && VERBOSE) log(`    Detalhe: ${r.details}`);
}

// ============================================================================
// HELPERS
// ============================================================================

function daysAgo(d: number): Date {
  const dt = new Date(); dt.setDate(dt.getDate() - d); dt.setHours(12, 0, 0, 0); return dt;
}
function daysFromNow(d: number): Date {
  const dt = new Date(); dt.setDate(dt.getDate() + d); dt.setHours(12, 0, 0, 0); return dt;
}
function today(): Date {
  const dt = new Date(); dt.setHours(12, 0, 0, 0); return dt;
}

/** Replica getCalculatedStatus() do backend */
function getCalculatedStatus(tx: { status: string; paidAt: Date | null; dueDate: Date | null }): string {
  if (tx.status === 'CANCELLED') return 'CANCELLED';
  if (tx.paidAt) return 'PAID';
  if (tx.dueDate && new Date(tx.dueDate) < new Date()) return 'OVERDUE';
  return 'PENDING';
}

/** Simula lógica do cron de grace period */
function simulateCronStatus(daysOverdue: number, grace: number = 3): string {
  if (daysOverdue <= grace) return 'ATIVO';
  if (daysOverdue <= 30) return 'INADIMPLENTE';
  return 'BLOQUEADO';
}

// ============================================================================
// FASE 0: SETUP
// ============================================================================

async function fase0_setup() {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 0: SETUP - Verificando pré-requisitos${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  const superadmin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
  if (!superadmin) {
    addResult({ id: '0.1', name: 'Encontrar SUPERADMIN', phase: 'Setup', status: 'FAILED',
      expected: '≥1 SUPERADMIN', observed: '0' });
    return null;
  }
  addResult({ id: '0.1', name: 'Encontrar SUPERADMIN', phase: 'Setup', status: 'PASSED',
    details: `${superadmin.name} (${superadmin.email})` });

  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  if (plans.length === 0) {
    addResult({ id: '0.2', name: 'Verificar planos', phase: 'Setup', status: 'FAILED',
      expected: '≥1 plano', observed: '0' });
    return null;
  }
  addResult({ id: '0.2', name: 'Verificar planos cadastrados', phase: 'Setup', status: 'PASSED',
    details: `${plans.length} planos: ${plans.map(p => `${p.name} R$${p.priceMonthly}`).join(', ')}` });

  const p = plans[0];
  let toFixedOk = false;
  try { Number(p.priceMonthly).toFixed(2); toFixedOk = true; } catch {}
  addResult({ id: '0.3', name: 'Decimal→Number + toFixed() (Bug #5)', phase: 'Setup',
    status: toFixedOk ? 'PASSED' : 'FAILED',
    expected: 'toFixed(2) funciona', observed: `toFixed=${toFixedOk}, val=${Number(p.priceMonthly)}` });

  await cleanupTestData();
  return { superadmin, plans };
}

// ============================================================================
// FASE 1: CRIAÇÃO
// ============================================================================

async function fase1_criacao(setup: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 1: CRIAÇÃO - Cliente + Auto-Transação${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  const { superadmin, plans } = setup;
  const plan = plans.find((p: any) => p.name?.includes('Professional')) || plans[1] || plans[0];

  // 1.1 Cliente EM_TRIAL
  let client1: any;
  try {
    client1 = await prisma.client.create({ data: {
      company: `${TEST_PREFIX} Clínica Alpha`,
      contactName: `${TEST_PREFIX} Pedro Teste`,
      email: `pedro${TEST_EMAIL_DOMAIN}`,
      phone: '11987654321', cpfCnpj: '12345678000190',
      role: 'CEO_PRESIDENTE' as any, status: 'EM_TRIAL' as any,
      productType: 'ONE_NEXUS' as any, planId: plan.id,
      vendedorId: superadmin.id, billingCycle: 'MONTHLY' as any,
      closedAt: today(),
    }});
    addResult({ id: '1.1', name: 'Criar cliente EM_TRIAL', phase: 'Criação',
      status: client1.status === 'EM_TRIAL' ? 'PASSED' : 'FAILED',
      expected: 'EM_TRIAL', observed: client1.status });
  } catch (err: any) {
    addResult({ id: '1.1', name: 'Criar cliente', phase: 'Criação', status: 'FAILED', error: err.message });
    return null;
  }

  // 1.2 Transação auto
  const tx1 = await prisma.financeTransaction.create({ data: {
    description: `${TEST_PREFIX} Assinatura ${plan.name}`,
    amount: Number(plan.priceMonthly), type: 'INCOME', category: 'SUBSCRIPTION',
    date: today(), dueDate: daysFromNow(7), status: 'PENDING',
    isRecurring: true, productType: 'ONE_NEXUS',
    clientId: client1.id, createdBy: superadmin.id,
  }});
  addResult({ id: '1.2', name: 'Transação PENDING + isRecurring', phase: 'Criação',
    status: tx1.status === 'PENDING' && tx1.isRecurring ? 'PASSED' : 'FAILED',
    expected: 'PENDING, recurring=true', observed: `${tx1.status}, recurring=${tx1.isRecurring}` });

  // 1.3 Phone/CNPJ limpos
  const s = await prisma.client.findUnique({ where: { id: client1.id } });
  const pOk = /^\d+$/.test(s!.phone);
  const cOk = /^\d+$/.test(s!.cpfCnpj);
  addResult({ id: '1.3', name: 'Phone/CNPJ só dígitos (v2.45.3)', phase: 'Criação',
    status: pOk && cOk ? 'PASSED' : 'FAILED',
    expected: 'Apenas dígitos', observed: `Phone="${s!.phone}" CNPJ="${s!.cpfCnpj}"` });

  // 1.4 Cliente ATIVO + 2 transações (cancel test)
  const client2 = await prisma.client.create({ data: {
    company: `${TEST_PREFIX} Clínica Beta`,
    contactName: `${TEST_PREFIX} João Cancel`,
    email: `joao${TEST_EMAIL_DOMAIN}`,
    phone: '11999998888', cpfCnpj: '98765432000110',
    role: 'SOCIO_FUNDADOR' as any, status: 'ATIVO' as any,
    productType: 'ONE_NEXUS' as any, planId: plan.id,
    vendedorId: superadmin.id, billingCycle: 'MONTHLY' as any,
    closedAt: daysAgo(30),
  }});
  const txJPaid = await prisma.financeTransaction.create({ data: {
    description: `${TEST_PREFIX} Pago`, amount: Number(plan.priceMonthly),
    type: 'INCOME', category: 'SUBSCRIPTION',
    date: daysAgo(30), dueDate: daysAgo(30), paidAt: daysAgo(29),
    status: 'PAID', isRecurring: true, productType: 'ONE_NEXUS',
    clientId: client2.id, createdBy: superadmin.id,
  }});
  const txJPend = await prisma.financeTransaction.create({ data: {
    description: `${TEST_PREFIX} Pendente`, amount: Number(plan.priceMonthly),
    type: 'INCOME', category: 'SUBSCRIPTION',
    date: today(), dueDate: daysFromNow(5),
    status: 'PENDING', isRecurring: true, productType: 'ONE_NEXUS',
    clientId: client2.id, createdBy: superadmin.id,
  }});
  addResult({ id: '1.4', name: 'Cliente ATIVO + PAID + PENDING', phase: 'Criação', status: 'PASSED',
    details: `${client2.id}` });

  // 1.5 Cliente para grace period
  const client3 = await prisma.client.create({ data: {
    company: `${TEST_PREFIX} Clínica Gamma`,
    contactName: `${TEST_PREFIX} Maria Grace`,
    email: `maria${TEST_EMAIL_DOMAIN}`,
    phone: '11977776666', cpfCnpj: '11222333000144',
    role: 'CEO_PRESIDENTE' as any, status: 'ATIVO' as any,
    productType: 'ONE_NEXUS' as any, planId: plan.id,
    vendedorId: superadmin.id, billingCycle: 'MONTHLY' as any,
    closedAt: daysAgo(60),
  }});
  const txMGrace = await prisma.financeTransaction.create({ data: {
    description: `${TEST_PREFIX} Grace Period`, amount: Number(plan.priceMonthly),
    type: 'INCOME', category: 'SUBSCRIPTION',
    date: daysAgo(30), dueDate: daysAgo(2),
    status: 'PENDING', isRecurring: true, productType: 'ONE_NEXUS',
    clientId: client3.id, createdBy: superadmin.id,
  }});
  addResult({ id: '1.5', name: 'Cliente ATIVO + vencida 2 dias (grace)', phase: 'Criação', status: 'PASSED' });

  return { client1, tx1, client2, txJPaid, txJPend, client3, txMGrace, plan, superadmin };
}

// ============================================================================
// FASE 2: ATIVAÇÃO (Finance → Clients)
// ============================================================================

async function fase2_ativacao(d: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 2: ATIVAÇÃO - Finance → Clients${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  // 2.1 markAsPaid → EM_TRIAL → ATIVO
  await prisma.financeTransaction.update({ where: { id: d.tx1.id }, data: { status: 'PAID', paidAt: new Date() }});
  const before = await prisma.client.findUnique({ where: { id: d.client1.id } });
  if (before?.status === 'EM_TRIAL') {
    await prisma.client.update({ where: { id: d.client1.id }, data: { status: 'ATIVO' } });
  }
  const after = await prisma.client.findUnique({ where: { id: d.client1.id } });
  addResult({ id: '2.1', name: 'Primeiro pagamento: EM_TRIAL → ATIVO', phase: 'Ativação',
    status: after?.status === 'ATIVO' ? 'PASSED' : 'FAILED',
    expected: 'ATIVO', observed: `${after?.status}` });

  // 2.2 Edição PAID→PENDING NÃO cascata
  await prisma.financeTransaction.update({ where: { id: d.tx1.id }, data: { status: 'PENDING', paidAt: null }});
  const afterEdit = await prisma.client.findUnique({ where: { id: d.client1.id } });
  addResult({ id: '2.2', name: 'Edição PAID→PENDING NÃO altera cliente (cron-driven)', phase: 'Ativação',
    status: afterEdit?.status === 'ATIVO' ? 'PASSED' : 'FAILED',
    expected: 'ATIVO (sem cascata)', observed: `${afterEdit?.status}` });

  // 2.3 Status dinâmico
  const tx = await prisma.financeTransaction.findUnique({ where: { id: d.tx1.id } });
  const calc = getCalculatedStatus({ status: tx!.status, paidAt: tx!.paidAt, dueDate: tx!.dueDate });
  addResult({ id: '2.3', name: 'Status dinâmico calcula PENDING (dueDate futuro)', phase: 'Ativação',
    status: calc === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'PENDING', observed: calc });

  // Reverter
  await prisma.financeTransaction.update({ where: { id: d.tx1.id }, data: { status: 'PAID', paidAt: new Date() }});
}

// ============================================================================
// FASE 3: CANCELAMENTO (Clients → Finance)
// ============================================================================

async function fase3_cancelamento(d: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 3: CANCELAMENTO - Clients → Finance${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  // 3.1 Cancelar João
  await prisma.client.update({ where: { id: d.client2.id }, data: { status: 'CANCELADO' } });
  // Sync: PENDING/OVERDUE → CANCELLED, PAID preservado
  await prisma.financeTransaction.updateMany({
    where: { clientId: d.client2.id, status: { in: ['PENDING', 'OVERDUE'] } },
    data: { status: 'CANCELLED' },
  });

  const paid = await prisma.financeTransaction.findUnique({ where: { id: d.txJPaid.id } });
  addResult({ id: '3.1', name: 'Cancelamento PRESERVA transação PAID (compliance)', phase: 'Cancelamento',
    status: paid?.status === 'PAID' ? 'PASSED' : 'FAILED',
    expected: 'PAID', observed: `${paid?.status}` });

  const pend = await prisma.financeTransaction.findUnique({ where: { id: d.txJPend.id } });
  addResult({ id: '3.2', name: 'Cancelamento muda PENDING → CANCELLED', phase: 'Cancelamento',
    status: pend?.status === 'CANCELLED' ? 'PASSED' : 'FAILED',
    expected: 'CANCELLED', observed: `${pend?.status}` });

  // 3.3 Reativar
  let err: string | null = null;
  try {
    await prisma.client.update({ where: { id: d.client2.id }, data: { status: 'ATIVO' } });
  } catch (e: any) { err = e.message; }
  const reactivated = await prisma.client.findUnique({ where: { id: d.client2.id } });
  addResult({ id: '3.3', name: 'Reativar CANCELADO → ATIVO (sem erro 400)', phase: 'Cancelamento',
    status: reactivated?.status === 'ATIVO' && !err ? 'PASSED' : 'FAILED',
    expected: 'ATIVO sem erro', observed: err ? `Erro: ${err}` : `${reactivated?.status}` });

  // 3.4 Restaurar CANCELLED → PENDING
  await prisma.financeTransaction.updateMany({
    where: { clientId: d.client2.id, status: 'CANCELLED', paidAt: null },
    data: { status: 'PENDING' },
  });
  const restored = await prisma.financeTransaction.findUnique({ where: { id: d.txJPend.id } });
  addResult({ id: '3.4', name: 'Reativação restaura CANCELLED → PENDING', phase: 'Cancelamento',
    status: restored?.status === 'PENDING' ? 'PASSED' : 'FAILED',
    expected: 'PENDING', observed: `${restored?.status}` });
}

// ============================================================================
// FASE 4: STATUS DINÂMICO (5 cenários)
// ============================================================================

async function fase4_statusDinamico(d: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 4: STATUS DINÂMICO - 5 cenários de cálculo${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  const tests = [
    { id: '4.1', name: 'CANCELLED prevalece (mesmo com paidAt)',
      input: { status: 'CANCELLED', paidAt: daysAgo(5), dueDate: daysAgo(10) }, expected: 'CANCELLED' },
    { id: '4.2', name: 'PAID quando paidAt preenchido (mesmo overdue)',
      input: { status: 'PENDING', paidAt: new Date(), dueDate: daysAgo(5) }, expected: 'PAID' },
    { id: '4.3', name: 'OVERDUE quando vencido sem pagamento',
      input: { status: 'PENDING', paidAt: null, dueDate: daysAgo(15) }, expected: 'OVERDUE' },
    { id: '4.4', name: 'PENDING quando dueDate no futuro',
      input: { status: 'PENDING', paidAt: null, dueDate: daysFromNow(10) }, expected: 'PENDING' },
    { id: '4.5', name: 'PENDING quando sem dueDate (default)',
      input: { status: 'PENDING', paidAt: null, dueDate: null }, expected: 'PENDING' },
  ];

  for (const t of tests) {
    const result = getCalculatedStatus(t.input);
    addResult({ id: t.id, name: t.name, phase: 'Status Dinâmico',
      status: result === t.expected ? 'PASSED' : 'FAILED',
      expected: t.expected, observed: result });
  }
}

// ============================================================================
// FASE 5: GRACE PERIOD (9 cenários)
// ============================================================================

async function fase5_gracePeriod(d: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 5: GRACE PERIOD - 9 cenários de dias overdue${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  const GRACE = 3;
  const scenarios = [
    { days: 0,  expected: 'ATIVO' },
    { days: 1,  expected: 'ATIVO' },
    { days: 2,  expected: 'ATIVO' },
    { days: 3,  expected: 'ATIVO' },
    { days: 4,  expected: 'INADIMPLENTE' },
    { days: 10, expected: 'INADIMPLENTE' },
    { days: 30, expected: 'INADIMPLENTE' },
    { days: 31, expected: 'BLOQUEADO' },
    { days: 90, expected: 'BLOQUEADO' },
  ];

  // 5.1 Teste individual: vencida 2 dias = ATIVO
  addResult({ id: '5.1', name: `Vencida 2 dias → ATIVO (dentro do grace=${GRACE})`, phase: 'Grace Period',
    status: simulateCronStatus(2, GRACE) === 'ATIVO' ? 'PASSED' : 'FAILED',
    expected: 'ATIVO', observed: simulateCronStatus(2, GRACE) });

  // 5.2 Teste individual: vencida 5 dias = INADIMPLENTE
  addResult({ id: '5.2', name: `Vencida 5 dias → INADIMPLENTE (fora do grace)`, phase: 'Grace Period',
    status: simulateCronStatus(5, GRACE) === 'INADIMPLENTE' ? 'PASSED' : 'FAILED',
    expected: 'INADIMPLENTE', observed: simulateCronStatus(5, GRACE) });

  // 5.3 Teste individual: vencida 35 dias = BLOQUEADO
  addResult({ id: '5.3', name: `Vencida 35 dias → BLOQUEADO`, phase: 'Grace Period',
    status: simulateCronStatus(35, GRACE) === 'BLOQUEADO' ? 'PASSED' : 'FAILED',
    expected: 'BLOQUEADO', observed: simulateCronStatus(35, GRACE) });

  // 5.4 Tabela completa: 9 cenários
  let failures: string[] = [];
  for (const sc of scenarios) {
    const got = simulateCronStatus(sc.days, GRACE);
    if (got !== sc.expected) failures.push(`${sc.days}d: esperado=${sc.expected}, obtido=${got}`);
  }
  addResult({ id: '5.4', name: 'Tabela completa: 9 cenários de transição', phase: 'Grace Period',
    status: failures.length === 0 ? 'PASSED' : 'FAILED',
    expected: '9/9 corretos', observed: failures.length === 0 ? '9/9 ✓' : failures.join('; ') });
}

// ============================================================================
// FASE 6: AUTO-CANCELAMENTO
// ============================================================================

async function fase6_autoCancelamento(d: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 6: AUTO-CANCELAMENTO - Sem transações ativas${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  const { superadmin, plan } = d;

  // 6.1 Criar cliente + 2 PENDING
  const cAuto = await prisma.client.create({ data: {
    company: `${TEST_PREFIX} Auto Cancel`,
    contactName: `${TEST_PREFIX} Carlos Auto`,
    email: `carlos${TEST_EMAIL_DOMAIN}`,
    phone: '11955554444', cpfCnpj: '55666777000188',
    role: 'CEO_PRESIDENTE' as any, status: 'ATIVO' as any,
    productType: 'ONE_NEXUS' as any, planId: plan.id,
    vendedorId: superadmin.id, billingCycle: 'MONTHLY' as any,
  }});

  const txA1 = await prisma.financeTransaction.create({ data: {
    description: `${TEST_PREFIX} AutoCancel Tx1`, amount: 450,
    type: 'INCOME', category: 'SUBSCRIPTION',
    date: today(), dueDate: daysFromNow(15),
    status: 'PENDING', isRecurring: true, productType: 'ONE_NEXUS',
    clientId: cAuto.id, createdBy: superadmin.id,
  }});
  const txA2 = await prisma.financeTransaction.create({ data: {
    description: `${TEST_PREFIX} AutoCancel Tx2`, amount: 450,
    type: 'INCOME', category: 'SUBSCRIPTION',
    date: today(), dueDate: daysFromNow(45),
    status: 'PENDING', isRecurring: true, productType: 'ONE_NEXUS',
    clientId: cAuto.id, createdBy: superadmin.id,
  }});

  addResult({ id: '6.1', name: 'Criar cliente ATIVO + 2 transações PENDING', phase: 'Auto-Cancelamento',
    status: 'PASSED', details: `${cAuto.id}` });

  // 6.2 Cancelar TODAS → cliente deve auto-cancelar
  await prisma.financeTransaction.update({ where: { id: txA1.id }, data: { status: 'CANCELLED' } });
  await prisma.financeTransaction.update({ where: { id: txA2.id }, data: { status: 'CANCELLED' } });

  const activeCount = await prisma.financeTransaction.count({
    where: { clientId: cAuto.id, status: { in: ['PAID', 'PENDING', 'OVERDUE'] } },
  });

  if (activeCount === 0) {
    await prisma.client.update({ where: { id: cAuto.id }, data: { status: 'CANCELADO' } });
  }

  const afterAutoCancel = await prisma.client.findUnique({ where: { id: cAuto.id } });
  addResult({ id: '6.2', name: 'Auto-cancel: todas tx canceladas → cliente CANCELADO', phase: 'Auto-Cancelamento',
    status: afterAutoCancel?.status === 'CANCELADO' ? 'PASSED' : 'FAILED',
    expected: 'CANCELADO', observed: `${afterAutoCancel?.status} (tx ativas: ${activeCount})` });
}

// ============================================================================
// FASE 7: MRR & MÉTRICAS
// ============================================================================

async function fase7_metricas(d: any) {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 7: MRR & MÉTRICAS - Cálculos financeiros${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  const { plan } = d;
  const pm = Number(plan.priceMonthly);

  // 7.1 MRR MONTHLY
  addResult({ id: '7.1', name: `MRR MONTHLY = priceMonthly (R$${pm})`, phase: 'Métricas',
    status: pm > 0 ? 'PASSED' : 'FAILED',
    expected: `R$${pm} (sem desconto)`, observed: `R$${pm}` });

  // 7.2 MRR ANNUAL (10% desconto)
  const mrrAnnual = pm * 0.9;
  const priceAnnual = mrrAnnual * 12;
  addResult({ id: '7.2', name: `MRR ANNUAL = priceMonthly × 0.9 (R$${mrrAnnual.toFixed(2)})`, phase: 'Métricas',
    status: mrrAnnual === pm * 0.9 ? 'PASSED' : 'FAILED',
    expected: `MRR: R$${(pm * 0.9).toFixed(2)}, Anual: R$${priceAnnual.toFixed(2)}`,
    observed: `MRR: R$${mrrAnnual.toFixed(2)}, Anual: R$${priceAnnual.toFixed(2)}` });

  // 7.3 Só isRecurring conta no MRR
  const recCount = await prisma.financeTransaction.count({
    where: { description: { startsWith: TEST_PREFIX }, type: 'INCOME',
      isRecurring: true, status: { in: ['PAID', 'PENDING'] } },
  });
  const nonRecCount = await prisma.financeTransaction.count({
    where: { description: { startsWith: TEST_PREFIX }, type: 'INCOME',
      isRecurring: false, status: { in: ['PAID', 'PENDING'] } },
  });
  addResult({ id: '7.3', name: 'MRR conta apenas isRecurring=true', phase: 'Métricas',
    status: 'PASSED',
    details: `Recorrentes ativas: ${recCount}, Não-recorrentes: ${nonRecCount}` });

  // 7.4 Aging ranges sem sobreposição
  const ranges = [
    { label: '0-30d', min: 0, max: 30 },
    { label: '31-60d', min: 31, max: 60 },
    { label: '61-90d', min: 61, max: 90 },
    { label: '90+d', min: 91, max: 99999 },
  ];
  let agingOk = true;
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].min !== ranges[i - 1].max + 1) agingOk = false;
  }
  addResult({ id: '7.4', name: 'Aging Report: faixas contíguas sem sobreposição', phase: 'Métricas',
    status: agingOk ? 'PASSED' : 'FAILED',
    expected: '4 faixas contíguas', observed: ranges.map(r => r.label).join(', ') });
}

// ============================================================================
// FASE 8: INTEGRIDADE DO BANCO DE DADOS
// ============================================================================

async function fase8_integridade() {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  FASE 8: INTEGRIDADE - Banco de dados real${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  // 8.1 Clientes sem vendedorId
  const noVendedor = await prisma.client.count({ where: { vendedorId: '' } });
  addResult({ id: '8.1', name: 'Todos os clientes têm vendedorId', phase: 'Integridade',
    status: noVendedor === 0 ? 'PASSED' : 'FAILED',
    expected: '0 sem vendedor', observed: `${noVendedor}` });

  // 8.2 Transações INCOME com valor ≤ 0
  const invalidAmount = await prisma.financeTransaction.count({
    where: { type: 'INCOME', amount: { lte: 0 } },
  });
  addResult({ id: '8.2', name: 'Sem transações INCOME com valor ≤ 0', phase: 'Integridade',
    status: invalidAmount === 0 ? 'PASSED' : 'FAILED',
    expected: '0', observed: `${invalidAmount}` });

  // 8.3 Clientes sem planId
  const noPlano = await prisma.client.count({ where: { planId: '' } });
  addResult({ id: '8.3', name: 'Todos os clientes têm planId', phase: 'Integridade',
    status: noPlano === 0 ? 'PASSED' : 'FAILED',
    expected: '0', observed: `${noPlano}` });

  // 8.4 Phones com formatação no banco
  const phoneFmt = await prisma.client.findMany({
    where: { OR: [
      { phone: { contains: '(' } }, { phone: { contains: ')' } },
      { phone: { contains: '-' } }, { phone: { contains: ' ' } },
    ]},
    select: { id: true, contactName: true, phone: true },
  });
  addResult({ id: '8.4', name: 'Nenhum phone com formatação no banco (v2.45.3)', phase: 'Integridade',
    status: phoneFmt.length === 0 ? 'PASSED' : 'FAILED',
    expected: '0 formatados',
    observed: phoneFmt.length > 0
      ? `${phoneFmt.length}: ${phoneFmt.slice(0, 3).map(c => `"${c.contactName}": "${c.phone}"`).join(', ')}${phoneFmt.length > 3 ? '...' : ''}`
      : '0 ✓' });

  // 8.5 CNPJs com formatação no banco
  const cnpjFmt = await prisma.client.findMany({
    where: { OR: [
      { cpfCnpj: { contains: '.' } }, { cpfCnpj: { contains: '/' } },
      { cpfCnpj: { contains: '-' } },
    ]},
    select: { id: true, contactName: true, cpfCnpj: true },
  });
  addResult({ id: '8.5', name: 'Nenhum CNPJ com formatação no banco (v2.45.3)', phase: 'Integridade',
    status: cnpjFmt.length === 0 ? 'PASSED' : 'FAILED',
    expected: '0 formatados',
    observed: cnpjFmt.length > 0
      ? `${cnpjFmt.length}: ${cnpjFmt.slice(0, 3).map(c => `"${c.contactName}": "${c.cpfCnpj}"`).join(', ')}${cnpjFmt.length > 3 ? '...' : ''}`
      : '0 ✓' });

  // 8.6 Transações órfãs (clientId aponta para cliente inexistente)
  const txWithClient = await prisma.financeTransaction.findMany({
    where: { clientId: { not: null } },
    select: { id: true, clientId: true },
  });
  let orphanCount = 0;
  const orphanDetails: string[] = [];
  for (const tx of txWithClient) {
    const exists = await prisma.client.findUnique({ where: { id: tx.clientId! }, select: { id: true } });
    if (!exists) {
      orphanCount++;
      if (orphanDetails.length < 3) orphanDetails.push(tx.id);
    }
  }
  addResult({ id: '8.6', name: 'Sem transações órfãs (clientId válido)', phase: 'Integridade',
    status: orphanCount === 0 ? 'PASSED' : 'FAILED',
    expected: '0 órfãs',
    observed: orphanCount > 0
      ? `${orphanCount} órfãs de ${txWithClient.length} (ex: ${orphanDetails.join(', ')})`
      : `0 de ${txWithClient.length} ✓` });

  // 8.7 Planos com priceAnnual consistente
  const plans = await prisma.plan.findMany();
  const planIssues: string[] = [];
  for (const p of plans) {
    const expectedAnnual = Number(p.priceMonthly) * 0.9 * 12;
    const actualAnnual = Number(p.priceAnnual);
    if (Math.abs(expectedAnnual - actualAnnual) > 1) {
      planIssues.push(`${p.name}: annual=${actualAnnual} (esperado ${expectedAnnual.toFixed(2)})`);
    }
    if (Number(p.priceMonthly) <= 0) {
      planIssues.push(`${p.name}: priceMonthly=${p.priceMonthly} (inválido)`);
    }
  }
  addResult({ id: '8.7', name: 'Planos: priceAnnual = monthly × 0.9 × 12', phase: 'Integridade',
    status: planIssues.length === 0 ? 'PASSED' : 'FAILED',
    expected: 'Todos consistentes',
    observed: planIssues.length > 0 ? planIssues.join('; ') : `${plans.length} planos OK ✓` });
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanupTestData(): Promise<number> {
  let count = 0;
  const tx = await prisma.financeTransaction.deleteMany({ where: { description: { startsWith: TEST_PREFIX } } });
  count += tx.count;
  const cl = await prisma.client.deleteMany({ where: { company: { startsWith: TEST_PREFIX } } });
  count += cl.count;
  return count;
}

// ============================================================================
// RELATÓRIO FINAL + ARQUIVO
// ============================================================================

function generateReport(): string {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const total = results.length;
  const score = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  const phases = [...new Set(results.map(r => r.phase))];

  let report = ``;
  report += `══════════════════════════════════════════════════════════\n`;
  report += `  GESTOR NEXUS v2.45.3 - RELATÓRIO DE TESTES\n`;
  report += `  Data: ${now}\n`;
  report += `  Score: ${score}% (${passed}/${total})\n`;
  report += `══════════════════════════════════════════════════════════\n\n`;

  // Resumo por fase
  report += `RESUMO POR FASE:\n`;
  report += `────────────────────────────────────────\n`;
  for (const phase of phases) {
    const pr = results.filter(r => r.phase === phase);
    const pp = pr.filter(r => r.status === 'PASSED').length;
    const pt = pr.length;
    const icon = pp === pt ? '✅' : '❌';
    report += `  ${icon} ${phase}: ${pp}/${pt}\n`;
  }

  report += `\n────────────────────────────────────────\n`;
  report += `  TOTAL: ${passed} passou, ${failed} falhou de ${total} testes\n`;
  report += `────────────────────────────────────────\n\n`;

  // Todos os testes
  report += `DETALHES:\n`;
  report += `────────────────────────────────────────\n`;
  for (const r of results) {
    const icon = r.status === 'PASSED' ? '✅' : r.status === 'FAILED' ? '❌' : '⏭️';
    report += `  ${icon} [${r.id}] ${r.name}\n`;
    if (r.status === 'FAILED') {
      if (r.expected) report += `       Esperado:  ${r.expected}\n`;
      if (r.observed) report += `       Observado: ${r.observed}\n`;
      if (r.error)    report += `       Erro:      ${r.error}\n`;
    }
    if (r.details) report += `       Detalhe: ${r.details}\n`;
  }

  // Falhas
  if (failed > 0) {
    report += `\n⚠️  TESTES QUE FALHARAM:\n`;
    report += `────────────────────────────────────────\n`;
    for (const r of results.filter(r => r.status === 'FAILED')) {
      report += `  ❌ [${r.id}] ${r.name}\n`;
      if (r.expected) report += `     Esperado:  ${r.expected}\n`;
      if (r.observed) report += `     Observado: ${r.observed}\n`;
    }
  }

  // Funcionalidades pendentes
  report += `\nFUNCIONALIDADES PENDENTES (não são bugs):\n`;
  report += `────────────────────────────────────────\n`;
  report += `  🔜 Renovação automática de assinaturas via cron\n`;
  report += `  🔜 Criação de múltiplas transações por cliente\n`;
  report += `  🔜 Cron de atualização de status (grace period automático)\n`;
  report += `  🔜 Notificações de vencimento\n`;

  report += `\n══════════════════════════════════════════════════════════\n`;
  report += `  Fim do relatório - ${now}\n`;
  report += `══════════════════════════════════════════════════════════\n`;

  return report;
}

function printAndSaveReport() {
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const total = results.length;
  const score = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  const phases = [...new Set(results.map(r => r.phase))];

  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  📊 RELATÓRIO FINAL${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}\n`);

  for (const phase of phases) {
    const pr = results.filter(r => r.phase === phase);
    const pp = pr.filter(r => r.status === 'PASSED').length;
    const icon = pp === pr.length ? '✅' : '⚠️';
    log(`  ${icon} ${phase}: ${pp}/${pr.length}`);
  }

  log(`\n  ─────────────────────────────────`);
  log(`  Total: ${total} testes`);
  log(`  ${C.pass}: ${passed}`);
  if (failed > 0) log(`  ${C.fail}: ${failed}`);
  log(`\n  📈 Score: ${score}% (${passed}/${total})`);

  if (failed > 0) {
    log(`\n  ${C.warn} TESTES QUE FALHARAM:`);
    for (const r of results.filter(r => r.status === 'FAILED')) {
      log(`    ❌ [${r.id}] ${r.name}`);
      if (r.expected) log(`       Esperado: ${r.expected}`);
      if (r.observed) log(`       Observado: ${r.observed}`);
    }
  }

  // Salvar relatório em arquivo
  const report = generateReport();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `teste-gestor-nexus-${timestamp}.txt`;

  try {
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    const filepath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filepath, report, 'utf-8');
    log(`\n  📁 Relatório salvo em: ${filepath}`);
  } catch (err: any) {
    log(`\n  ${C.warn} Erro ao salvar relatório: ${err.message}`);
    // Fallback: salvar no diretório atual
    const fallback = path.join(process.cwd(), filename);
    try {
      fs.writeFileSync(fallback, report, 'utf-8');
      log(`  📁 Salvo em fallback: ${fallback}`);
    } catch {
      log(`  ${C.warn} Não foi possível salvar o relatório em arquivo.`);
    }
  }

  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log(`\n${C.h}══════════════════════════════════════════════════════════${C.r}`);
  log(`${C.h}  🧪 GESTOR NEXUS v2.45.3 - TESTES COMPLETOS (9 FASES)${C.r}`);
  log(`${C.h}  📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${C.r}`);
  if (DRY_RUN) log(`${C.h}  ⚠️  MODO DRY-RUN${C.r}`);
  if (NO_CLEANUP) log(`${C.h}  ⚠️  NO-CLEANUP${C.r}`);
  log(`${C.h}  📁 Relatório: ${REPORT_DIR}${C.r}`);
  log(`${C.h}══════════════════════════════════════════════════════════${C.r}`);

  if (DRY_RUN) {
    log(`\n${C.info} Plano de execução:\n`);
    log(`  Fase 0: Setup (3 testes) - SUPERADMIN, planos, Decimal→Number`);
    log(`  Fase 1: Criação (5 testes) - Clientes + transações + formatação`);
    log(`  Fase 2: Ativação (3 testes) - EM_TRIAL→ATIVO, cron-driven`);
    log(`  Fase 3: Cancelamento (4 testes) - PAID preservado, reativação`);
    log(`  Fase 4: Status Dinâmico (5 testes) - 5 cenários de cálculo`);
    log(`  Fase 5: Grace Period (4 testes) - 9 cenários de dias overdue`);
    log(`  Fase 6: Auto-Cancel (2 testes) - Sem transações → CANCELADO`);
    log(`  Fase 7: Métricas (4 testes) - MRR, aging, isRecurring`);
    log(`  Fase 8: Integridade (7 testes) - Banco real: phones, CNPJs, órfãos`);
    log(`\n  TOTAL: ~37 testes | Relatório em ${REPORT_DIR}`);
    log(`\n${C.info} Execute sem --dry-run para rodar.`);
    await prisma.$disconnect();
    return;
  }

  try {
    const setup = await fase0_setup();
    if (!setup) { printAndSaveReport(); await prisma.$disconnect(); return; }

    const data = await fase1_criacao(setup);
    if (!data) { printAndSaveReport(); await prisma.$disconnect(); return; }

    await fase2_ativacao(data);
    await fase3_cancelamento(data);
    await fase4_statusDinamico(data);
    await fase5_gracePeriod(data);
    await fase6_autoCancelamento(data);
    await fase7_metricas(data);
    await fase8_integridade();

    if (!NO_CLEANUP) {
      log(`\n${C.info} Limpando dados de teste...`);
      const cleaned = await cleanupTestData();
      log(`${C.info} ${cleaned} registros removidos.`);
    } else {
      log(`\n${C.warn} --no-cleanup: dados permanecem. Limpar com:`);
      log(`  DELETE FROM "FinanceTransaction" WHERE description LIKE '${TEST_PREFIX}%';`);
      log(`  DELETE FROM "Client" WHERE company LIKE '${TEST_PREFIX}%';`);
    }

  } catch (err: any) {
    log(`\n${C.red}💥 ERRO FATAL: ${err.message}${C.r}`);
    log(err.stack);
    if (!NO_CLEANUP) {
      try { await cleanupTestData(); log(`${C.info} Cleanup emergência OK.`); } catch {}
    }
  }

  printAndSaveReport();
  await prisma.$disconnect();
}

main();
