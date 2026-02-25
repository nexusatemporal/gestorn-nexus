export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
  companyName?: string;
  contactName?: string;
  city?: string;
  role?: string; // ✅ v2.29.0: ClientRole enum value from backend
  numberOfUnits?: number; // ✅ v2.35.0: Número de unidades da empresa
  instagram?: string; // ✅ v2.35.0: Instagram (opcional)
  facebook?: string; // ✅ v2.35.0: Facebook (opcional)
  // Aliases para compatibilidade frontend
  clinic?: string; // Alias for companyName
  cnpj?: string; // Alias for cpfCnpj
  origin: string | { id: string; name: string };
  status: LeadStatus;
  stageId?: string;
  interestProduct: ProductType;
  interestPlanId?: string;
  vendedorId?: string;
  notes?: string;
  score?: number; // Lead Score IA (0-100)
  aiScoreFactors?: {
    // ✅ v2.36.0: STAGE-BASED SCORING (4 fatores)
    // BASE SCORE (0-40 pontos)
    dataCompleteness: number; // 0-15 pontos
    planValue: number; // 0-15 pontos
    originQuality: number; // 0-10 pontos
    // STAGE SCORE (0-60 pontos)
    stageProgress: number; // 0-60 pontos (posição no funil - DINÂMICO)
  };
  aiScoreUpdatedAt?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  vendedor?: {
    id: string;
    name: string;
    email: string;
  };
  interestPlan?: {
    id: string;
    name: string;
    product: ProductType;
  };
  stage?: {
    id: string;
    name: string;
    order: number;
    color: string;
  };

  // Conversion metadata (returned when lead is converted to client)
  _conversion?: {
    productType: ProductType;
    moduleName: string;
    planName?: string;
  };
}

export enum LeadStatus {
  ABERTO = 'ABERTO',
  EM_CONTATO = 'EM_CONTATO',
  QUALIFICADO = 'QUALIFICADO',
  PROPOSTA = 'PROPOSTA',
  NEGOCIACAO = 'NEGOCIACAO',
  GANHO = 'GANHO',
  PERDIDO = 'PERDIDO',
}

export enum ProductType {
  ONE_NEXUS = 'ONE_NEXUS',
  LOCADORAS = 'LOCADORAS',
}

export enum LeadOrigin {
  WEBSITE = 'WEBSITE',
  INDICACAO = 'INDICACAO',
  REDES_SOCIAIS = 'REDES_SOCIAIS',
  EMAIL_MARKETING = 'EMAIL_MARKETING',
  EVENTO = 'EVENTO',
  COLD_CALL = 'COLD_CALL',
  OUTRO = 'OUTRO',
}

export interface CreateLeadDto {
  name: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
  companyName?: string;
  city?: string;
  role?: string; // ClientRole enum value (mapped from português to backend enum)
  numberOfUnits?: number; // ✅ v2.35.0: Número de unidades da empresa
  instagram?: string; // ✅ v2.35.0: Instagram (opcional)
  facebook?: string; // ✅ v2.35.0: Facebook (opcional)
  origin: string; // Human-readable string (converted to originId in backend)
  interestProduct: ProductType;
  interestPlanId?: string;
  vendedorId?: string;
  notes?: string;
}

export interface UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  companyName?: string;
  city?: string;
  role?: string; // ClientRole enum value (mapped from português to backend enum)
  numberOfUnits?: number; // ✅ v2.35.0: Número de unidades da empresa
  instagram?: string; // ✅ v2.35.0: Instagram (opcional)
  facebook?: string; // ✅ v2.35.0: Facebook (opcional)
  origin?: string; // Human-readable string (deprecated - use originId)
  originId?: string; // LeadOrigin UUID (v2.21.0+)
  status?: LeadStatus;
  stageId?: string; // FunnelStage UUID (FASE 2 - replaces status for drag-and-drop)
  interestProduct?: ProductType;
  interestPlanId?: string;
  vendedorId?: string;
  notes?: string;
  score?: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎯 FUNNEL STAGES (Pipeline Configuration)
// ══════════════════════════════════════════════════════════════════════════════

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    leads: number;
  };
}

export interface CreateFunnelStageDto {
  name: string;
  order: number;
  color?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateFunnelStageDto {
  name?: string;
  order?: number;
  color?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎉 LEAD CONVERSION (Smart Lock Feature)
// ══════════════════════════════════════════════════════════════════════════════

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export interface ConvertLeadPayload {
  dealSummary: string; // Resumo da negociação (mínimo 10 chars)
  planId: string; // Plano fechado (UUID)
  billingCycle: BillingCycle; // Ciclo de cobrança
  numberOfUsers: number; // Número de usuários (mínimo 1)
  closedAt: string; // Data de fechamento (ISO datetime)
  billingAnchorDay: number; // Dia de vencimento fixo (1-28) - v2.46.0
  implementationNotes?: string; // Notas de implantação (opcional)
}

export interface ConvertLeadResponse {
  client: {
    id: string;
    company: string;
    contactName: string;
    email: string;
    phone: string;
    planId: string;
    productType: ProductType;
    status: string;
    // ... outros campos
  };
  transaction: {
    id: string;
    amount: number;
    dueDate: string;
    status: string;
    billingCycle: BillingCycle;
    // ... outros campos
  };
  _conversion: {
    productType: ProductType;
    moduleName: string; // "Clientes One Nexus" ou "Clientes NexLoc"
  };
}

export interface GenerateSummaryResponse {
  summary: string;
}

export interface LeadScoreResponse {
  score: number;
  factors: {
    dataCompleteness: number;
    planValue: number;
    expectedRevenue: number;
    originQuality: number;
    funnelVelocity: number;
    engagement: number;
  };
}
