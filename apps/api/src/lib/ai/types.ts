/**
 * 🎯 NEXUS SALES AI - TYPES & INTERFACES
 *
 * Definições de tipos para todo o sistema Sales AI
 */

// ========================================
// ENUMS
// ========================================

export enum DISCProfile {
  DOMINANTE = 'DOMINANTE',
  INFLUENTE = 'INFLUENTE',
  ESTAVEL = 'ESTAVEL',
  CONSCIENTE = 'CONSCIENTE',
  HIBRIDO = 'HIBRIDO',
}

export enum LeadStage {
  PROSPECCAO = 'PROSPECCAO',
  QUALIFICACAO = 'QUALIFICACAO',
  APRESENTACAO = 'APRESENTACAO',
  NEGOCIACAO = 'NEGOCIACAO',
  FECHAMENTO = 'FECHAMENTO',
  POS_VENDA = 'POS_VENDA',
}

export enum GeneratorContentType {
  PITCH_60S = 'pitch-60s',
  EMAIL_COLD = 'email-cold',
  EMAIL_FOLLOWUP = 'email-followup',
  WHATSAPP_FIRST = 'whatsapp-first',
  WHATSAPP_FOLLOWUP = 'whatsapp-followup',
  SCRIPT_DISCOVERY = 'script-discovery',
  OBJECTION_RESPONSE = 'objection-response',
  PROPOSAL = 'proposal',
}

// ========================================
// CONTEXTO DO LEAD
// ========================================

export interface LeadContext {
  // Identificação
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;

  // Dados comportamentais
  disc?: DISCProfile;
  leadScore?: number; // 0-100

  // Estágio e produto
  stage: LeadStage;
  product: 'ONE_NEXUS' | 'NEXLOC';
  plan?: string;

  // Dores e interesses
  pains?: string[];
  interests?: string[];
  budget?: string;
  timeline?: string;

  // Dados da empresa
  companySize?: string;
  industry?: string;
  currentSolution?: string;

  // Histórico
  lastContact?: string;
  interactions?: number;
  notes?: string;
}

// ========================================
// CHAT
// ========================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  leadId?: string;
}

export interface ChatRequest {
  message: string;
  leadContext: LeadContext;
  history?: ChatMessage[];
  provider?: 'groq' | 'gemini' | 'openai';
}

export interface ChatResponse {
  response: string;
  suggestions?: string[];
  nextActions?: string[];
}

// ========================================
// DISC ANALYSIS
// ========================================

export interface DISCAnalysis {
  profile: DISCProfile;
  scores: {
    dominance: number; // 0-100
    influence: number;
    steadiness: number;
    conscientiousness: number;
  };
  traits: {
    strengths: string[];
    weaknesses: string[];
    motivators: string[];
    fears: string[];
  };
  salesApproach: {
    communication: string;
    presentation: string;
    negotiation: string;
    closing: string;
  };
  triggers: string[];
  warnings: string[];
}

export interface DISCAnalysisRequest {
  leadContext: LeadContext;
}

export interface DISCAnalysisResponse {
  analysis: DISCAnalysis;
}

// ========================================
// BRIEFING
// ========================================

export interface SPINQuestion {
  situation: string[];
  problem: string[];
  implication: string[];
  needPayoff: string[];
}

export interface Briefing {
  objective: string;
  spinQuestions: SPINQuestion;
  talkingPoints: string[];
  objections: Array<{
    objection: string;
    response: string;
  }>;
  pricing: {
    anchor: string;
    justification: string;
  };
  nextSteps: string[];
}

export interface BriefingRequest {
  leadContext: LeadContext;
  callType?: 'discovery' | 'demo' | 'negotiation' | 'closing';
}

export interface BriefingResponse {
  briefing: Briefing;
}

// ========================================
// BATTLECARD
// ========================================

export interface CompetitorIntel {
  name: string;
  strengths: string[];
  weaknesses: string[];
  pricing: string;
  targetMarket: string;
}

export interface Battlecard {
  competitor: CompetitorIntel;
  ourAdvantages: string[];
  trapQuestions: string[];
  landmines: string[];
  winningScript: string;
}

export interface BattlecardRequest {
  leadContext: LeadContext;
  competitor: string;
}

export interface BattlecardResponse {
  battlecard: Battlecard;
}

// ========================================
// ROLEPLAY
// ========================================

export interface RoleplayScenario {
  title: string;
  description: string;
  difficulty: 'FACIL' | 'MEDIO' | 'DIFICIL';
  persona: {
    name: string;
    role: string;
    disc: DISCProfile;
    objections: string[];
  };
}

export interface RoleplayMessage {
  id: string;
  role: 'vendedor' | 'cliente' | 'coach';
  content: string;
  timestamp: Date;
  feedback?: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
}

export interface RoleplayRequest {
  scenario: RoleplayScenario;
  message: string;
  history: RoleplayMessage[];
  leadContext?: LeadContext;
}

export interface RoleplayResponse {
  response: string;
  feedback?: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  suggestedResponses?: string[];
}

// ========================================
// GENERATOR
// ========================================

export interface GeneratorRequest {
  type: GeneratorContentType;
  leadContext: LeadContext;
  instructions?: string;
  context?: Record<string, unknown>;
}

export interface GeneratorResponse {
  content: string;
  metadata?: {
    wordCount?: number;
    estimatedTime?: string;
    tone?: string;
  };
}

// ========================================
// FEEDBACK
// ========================================

export interface FeedbackRequest {
  messageId: string;
  rating: 'helpful' | 'not_helpful';
  comment?: string;
  leadContext?: LeadContext;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
}

// ========================================
// ANALYTICS
// ========================================

export interface SalesMetrics {
  lead: {
    totalLeads: number;
    activeLeads: number;
    convertedLeads: number;
    conversionRate: number;
  };
  ai: {
    totalInteractions: number;
    avgResponseTime: number;
    satisfactionRate: number;
    mostUsedFeatures: Array<{
      feature: string;
      count: number;
    }>;
  };
  performance: {
    avgDealSize: number;
    avgSalesCycle: number;
    winRate: number;
  };
}

export interface AnalyticsRequest {
  userId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AnalyticsResponse {
  metrics: SalesMetrics;
}

// ========================================
// ERROR HANDLING
// ========================================

export interface AIError {
  code: string;
  message: string;
  provider?: string;
  details?: unknown;
}

// ========================================
// STREAMING
// ========================================

export interface StreamChunk {
  content: string;
  done: boolean;
}
