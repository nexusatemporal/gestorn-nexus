/**
 * ══════════════════════════════════════════════════════════════════════════
 * TYPES - Gestor Nexus
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Types compartilhados em toda a aplicação.
 * Mantém sincronia com backend (apps/api/src).
 */

// ──────────────────────────────────────────────────────────────────────────
// User & Auth
// ──────────────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  GESTOR = 'GESTOR',
  VENDEDOR = 'VENDEDOR',
  DESENVOLVEDOR = 'DESENVOLVEDOR',
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Client
// ──────────────────────────────────────────────────────────────────────────

export enum ProductType {
  ONE_NEXUS = 'ONE_NEXUS',
  LOCADORAS = 'LOCADORAS',
}

export enum ClientStatus {
  EM_TRIAL = 'EM_TRIAL',
  ATIVO = 'ATIVO',
  CANCELADO = 'CANCELADO',
  INADIMPLENTE = 'INADIMPLENTE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  ANNUAL = 'ANNUAL',
}

export enum TenantStatus {
  ATIVO = 'ATIVO',
  SUSPENSO = 'SUSPENSO',
  BLOQUEADO = 'BLOQUEADO',
  DELETADO = 'DELETADO',
}

export interface TenantInfo {
  id: string;
  system: ProductType;
  vps: string;
  url: string;
  createdAt: string;
  status: TenantStatus;
  lastAccess: string;
  activeUsers: number;
  storageUsage: string;
  version: string;
}

export interface Client {
  id: string;
  contactName: string;        // ← Updated to match Prisma schema
  company: string;             // ← Updated to match Prisma schema
  cpfCnpj: string;             // ← Updated to match Prisma schema (combined field)
  email: string;
  phone: string;
  productType: ProductType;    // ← Updated to match Prisma schema
  status: ClientStatus;
  planId: string;
  billingCycle?: BillingCycle; // ← v2.42.0: Billing cycle (MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL)
  vendedorId: string;          // ← Updated to match Prisma schema
  leadId: string | null;       // ← Updated to match Prisma schema
  role?: string | null;        // ← Added from Prisma schema (ClientRole)
  trialEndsAt?: string | null; // ← Added from Prisma schema
  tenantId?: string | null;    // ← Added from Prisma schema
  notes?: string | null;       // ← Added from Prisma schema
  paymentMethod?: string | null; // ← Added from Prisma schema
  paymentGateway?: string | null; // ← Added from Prisma schema
  nextDueDate?: string | null;    // ← v2.39.0: Próximo vencimento calculado pelo backend
  billingAnchorDay?: number | null; // ← v2.46.0: Dia fixo de vencimento (1-28)
  createdAt: string;
  updatedAt: string;

  // Optional populated relations from backend
  plan?: any;
  vendedor?: any;
  tenant?: any;
  subscriptions?: Array<{
    id: string;
    billingAnchorDay: number | null;
    nextBillingDate: string | null;
    status: string;
  }>; // ← v2.46.0: Subscriptions ativas para obter billingAnchorDay
}

// Client with extended info for management views
export interface ClientExtended extends Client {
  plan?: string;
  mrr?: number;
  lastPayment?: string;
  subscriptionExpiry?: string;
  healthScore?: number;
  numberOfUsers?: number; // ✅ v2.45.0: Número de unidades
  billingAnchorDay?: number; // ✅ v2.46.0: Dia fixo de vencimento (1-28)
  dealSummary?: string; // ✅ v2.45.1: Resumo do deal (handoff Sales → CS)
  closedAt?: string; // ✅ v2.45.1: Data de fechamento
  implementationNotes?: string; // ✅ v2.45.1: Notas de implementação
}

// ──────────────────────────────────────────────────────────────────────────
// Lead
// ──────────────────────────────────────────────────────────────────────────

export enum LeadStatus {
  NOVO = 'NOVO',
  EM_CONTATO = 'EM_CONTATO',
  QUALIFICADO = 'QUALIFICADO',
  PROPOSTA = 'PROPOSTA',
  GANHO = 'GANHO',
  PERDIDO = 'PERDIDO',
}

export enum LeadOrigin {
  WEBSITE = 'WEBSITE',
  INDICACAO = 'INDICACAO',
  LINKEDIN = 'LINKEDIN',
  INSTAGRAM = 'INSTAGRAM',
  TELEFONE = 'TELEFONE',
  EMAIL = 'EMAIL',
  EVENTO = 'EVENTO',
  OUTRO = 'OUTRO',
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  product: ProductType;
  origin: LeadOrigin;
  status: LeadStatus;
  score: number | null;
  expectedRevenue: number | null;
  notes: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Payment
// ──────────────────────────────────────────────────────────────────────────

export enum PaymentGateway {
  ABACATEPAY = 'ABACATEPAY',
  ASAAS = 'ASAAS',
  MANUAL = 'MANUAL',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export interface Payment {
  id: string;
  clientId: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  cancelledAt: string | null;
  status: PaymentStatus;
  gateway: PaymentGateway;
  externalId: string | null;
  gatewayId: string | null;
  gatewayData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Optional populated relation
  client?: Client;
}

// ──────────────────────────────────────────────────────────────────────────
// API Response Wrappers
// ──────────────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Dashboard Statistics
// ──────────────────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  churnedClients: number;
  mrr: number;
  totalLeads: number;
  conversionRate: number;
  overduePayments: number;
  // Trends (v2.48.0)
  totalClientsTrend?: string;
  totalClientsTrendUp?: boolean;
  mrrTrend?: string;
  mrrTrendUp?: boolean;
  totalLeadsTrend?: string;
  totalLeadsTrendUp?: boolean;
  overduePaymentsTrend?: string;
  overduePaymentsTrendUp?: boolean;
}

export interface RevenueOverTime {
  month: string;
  revenue: number;
}

export interface ClientsByPlan {
  plan: string;
  count: number;
}

export interface RecentLead {
  id: string;
  name: string;
  origin: string;
  createdAt: string;
}

export interface RecentClient {
  id: string;
  responsibleName: string;
  planName: string;       // ✅ v2.48.2: Nome do plano (ex: "One Nexus Basic", "Locadoras Gold")
  productType: string;    // ✅ v2.48.2: Enum ProductType para determinar cor do badge
  createdAt: string;
}

export interface UpcomingPayment {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  dueDate: string;
}

export interface RecentActivity {
  recentLeads: RecentLead[];
  recentClients: RecentClient[];
  upcomingPayments: UpcomingPayment[];
}

export interface DashboardStats {
  kpis: DashboardKPIs;
  revenueOverTime: RevenueOverTime[];
  clientsByPlan: ClientsByPlan[];
  recentActivity: RecentActivity;
}

// ──────────────────────────────────────────────────────────────────────────
// AI Insights (v2.49.0)
// ──────────────────────────────────────────────────────────────────────────

export enum InsightSeverity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface DashboardInsight {
  severity: InsightSeverity;
  title: string;
  description: string;
  actionable?: string;
}

export interface GenerateInsightsResponseDto {
  insights: DashboardInsight[];
  metadata: {
    generatedAt: string;
    period: string;
    product?: string;
    cached: boolean;
    cachedAt?: string; // ✅ v2.53.0: Timestamp do cache
  };
}
