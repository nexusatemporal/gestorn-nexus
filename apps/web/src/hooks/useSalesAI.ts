/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🧠 SALES AI - CUSTOM HOOK
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Hook customizado para integração com Nexus Sales AI API.
 * Usa TanStack Query para gerenciamento de estado do servidor.
 *
 * FEATURES:
 * - Chat com IA (regular + streaming)
 * - Análise DISC
 * - Geração de Briefing
 * - Battlecard competitiva
 * - Roleplay de vendas
 * - Gerador de conteúdo (8 tipos)
 * - Feedback de respostas
 * - Analytics
 */

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════

export type DISCProfile = 'DOMINANTE' | 'INFLUENTE' | 'ESTAVEL' | 'CONSCIENTE' | 'HIBRIDO';
export type LeadStage = 'PROSPECCAO' | 'QUALIFICACAO' | 'APRESENTACAO' | 'NEGOCIACAO' | 'FECHAMENTO' | 'POS_VENDA';
export type RoleplayDifficulty = 'FACIL' | 'MEDIO' | 'DIFICIL';
export type GeneratorContentType =
  | 'pitch-60s'
  | 'email-cold'
  | 'email-followup'
  | 'whatsapp-first'
  | 'whatsapp-followup'
  | 'script-discovery'
  | 'objection-response'
  | 'proposal';

export interface LeadContext {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  disc?: DISCProfile;
  leadScore?: number;
  stage: LeadStage;
  product: 'ONE_NEXUS' | 'NEXLOC';
  plan?: string;
  pains?: string[];
  interests?: string[];
  budget?: string;
  timeline?: string;
  companySize?: string;
  industry?: string;
  currentSolution?: string;
  lastContact?: string;
  interactions?: number;
  notes?: string;
}

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

export interface DISCAnalysis {
  profile: DISCProfile;
  scores: {
    dominance: number;
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

export interface RoleplayScenario {
  title: string;
  description: string;
  difficulty: RoleplayDifficulty;
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

// ══════════════════════════════════════════════════════════════════════════
// HOOKS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hook para chat com IA (não-streaming)
 */
export function useChatAI() {
  return useMutation({
    mutationFn: async (request: ChatRequest): Promise<ChatResponse> => {
      const { data } = await api.post('/sales-ai/chat', request);
      return data;
    },
  });
}

/**
 * Hook para análise DISC do lead
 */
export function useAnalyzeDISC() {
  return useMutation({
    mutationFn: async (leadContext: LeadContext): Promise<{ analysis: DISCAnalysis }> => {
      const { data } = await api.post('/sales-ai/insights', { leadContext });
      return data;
    },
  });
}

/**
 * Hook para gerar briefing de call
 */
export function useGenerateBriefing() {
  return useMutation({
    mutationFn: async (params: {
      leadContext: LeadContext;
      callType?: 'discovery' | 'demo' | 'negotiation' | 'closing';
    }): Promise<{ briefing: Briefing }> => {
      const { data } = await api.post('/sales-ai/briefing', params);
      return data;
    },
  });
}

/**
 * Hook para gerar battlecard competitiva
 */
export function useGenerateBattlecard() {
  return useMutation({
    mutationFn: async (params: {
      leadContext: LeadContext;
      competitor: string;
    }): Promise<{ battlecard: Battlecard }> => {
      const { data } = await api.post('/sales-ai/battlecard', params);
      return data;
    },
  });
}

/**
 * Hook para roleplay de vendas
 */
export function useRoleplay() {
  return useMutation({
    mutationFn: async (params: {
      scenario: RoleplayScenario;
      message: string;
      history: RoleplayMessage[];
      leadContext?: LeadContext;
    }): Promise<{
      response: string;
      feedback?: {
        score: number;
        strengths: string[];
        improvements: string[];
      };
      suggestedResponses?: string[];
    }> => {
      const { data } = await api.post('/sales-ai/roleplay', params);
      return data;
    },
  });
}

/**
 * Hook para geração de conteúdo
 */
export function useGenerateContent() {
  return useMutation({
    mutationFn: async (request: GeneratorRequest): Promise<GeneratorResponse> => {
      const { data } = await api.post('/sales-ai/generate', request);
      return data;
    },
  });
}

/**
 * Hook para enviar feedback de resposta
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (params: {
      messageId: string;
      rating: 'helpful' | 'not_helpful';
      comment?: string;
      leadContext?: LeadContext;
    }): Promise<{ success: boolean; message: string }> => {
      const { data } = await api.post('/sales-ai/feedback', params);
      return data;
    },
  });
}

/**
 * Hook para buscar analytics (query, não mutation)
 */
export function useSalesAnalytics(userId: string) {
  return useQuery({
    queryKey: ['sales-analytics', userId],
    queryFn: async () => {
      const { data } = await api.get(`/sales-ai/analytics/${userId}`);
      return data;
    },
    enabled: !!userId,
  });
}

/**
 * Hook para health check da API
 */
export function useSalesAIHealth() {
  return useQuery({
    queryKey: ['sales-ai-health'],
    queryFn: async () => {
      const { data } = await api.get('/sales-ai/health');
      return data;
    },
    refetchInterval: 60000, // Refetch a cada 60s
  });
}

// ══════════════════════════════════════════════════════════════════════════
// CHAT STREAMING (SSE)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hook para chat com streaming via SSE
 *
 * USAGE:
 * ```tsx
 * const { startStream, stopStream, content, isStreaming, error } = useChatStream();
 *
 * const handleSend = (message: string) => {
 *   startStream({ message, leadContext, history });
 * };
 * ```
 */
export function useChatStream() {
  const [content, setContent] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  const startStream = (request: ChatRequest) => {
    // Limpar estado anterior
    setContent('');
    setError(null);
    setIsStreaming(true);

    // Construir URL com query params
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const params = new URLSearchParams({
      message: request.message,
      leadContext: JSON.stringify(request.leadContext),
      history: request.history ? JSON.stringify(request.history) : '',
    });
    const url = `${baseURL}/sales-ai/chat/stream?${params}`;

    // Criar EventSource
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const chunk = event.data;
      setContent((prev) => prev + chunk);
    };

    eventSource.onerror = () => {
      setError('Erro ao conectar com streaming');
      setIsStreaming(false);
      eventSource.close();
    };

    // EventSource fecha automaticamente quando servidor envia 'done'
    eventSource.addEventListener('done', () => {
      setIsStreaming(false);
      eventSource.close();
    });
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  // Cleanup ao desmontar
  React.useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return {
    startStream,
    stopStream,
    content,
    isStreaming,
    error,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════

export default {
  useChatAI,
  useChatStream,
  useAnalyzeDISC,
  useGenerateBriefing,
  useGenerateBattlecard,
  useRoleplay,
  useGenerateContent,
  useSubmitFeedback,
  useSalesAnalytics,
  useSalesAIHealth,
};
