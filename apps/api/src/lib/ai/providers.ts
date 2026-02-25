/**
 * 🤖 NEXUS SALES AI - CONFIGURAÇÃO DE PROVIDERS
 *
 * Sistema multi-provider com fallback automático
 * - OpenAI: Melhor para conteúdo criativo e roleplay
 * - Gemini: Ótimo para análises longas e DISC
 * - Groq: Ultra-rápido para chat e briefings
 */

export type AIProvider = 'openai' | 'gemini' | 'groq';

export interface ProviderConfig {
  name: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

/**
 * Configuração dos 3 providers
 * Cada um tem seu ponto forte
 */
export const AI_PROVIDERS: Record<AIProvider, ProviderConfig> = {
  groq: {
    name: 'Groq',
    model: 'llama-3.3-70b-versatile',
    apiKey: process.env.GROQ_API_KEY || '',
    baseUrl: 'https://api.groq.com/openai/v1',
    maxTokens: 4096,
    temperature: 0.7,
    description: 'Ultra-rápido para conversas e briefings',
  },
  gemini: {
    name: 'Gemini',
    model: 'gemini-2.0-flash-exp',
    apiKey: process.env.GEMINI_API_KEY || '',
    maxTokens: 8192,
    temperature: 0.7,
    description: 'Ótimo para análises longas e perfil DISC',
  },
  openai: {
    name: 'OpenAI',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || '',
    maxTokens: 4096,
    temperature: 0.8,
    description: 'Melhor para criatividade e roleplay',
  },
};

/**
 * Mapeamento automático de tarefa → provider ideal
 * Otimiza custo e performance
 */
export const TASK_PROVIDER_MAP: Record<string, AIProvider> = {
  'chat': 'groq',              // Respostas rápidas no chat
  'chat-complex': 'openai',    // Perguntas complexas
  'disc-analysis': 'gemini',   // Análise de perfil DISC
  'briefing': 'groq',          // Preparação de call (rápido)
  'battlecard': 'gemini',      // Análise competitiva
  'roleplay': 'openai',        // Simulação (mais natural)
  'pitch': 'openai',           // Geração de pitch
  'email': 'openai',           // Geração de email
  'script': 'openai',          // Script de call
  'proposal': 'gemini',        // Proposta comercial (longa)
  'objection': 'groq',         // Resposta a objeção (rápido)
  'sentiment': 'gemini',       // Análise de sentimento
  'whatsapp': 'openai',        // Mensagem WhatsApp
};

/**
 * Seleciona o provider ideal para a tarefa
 * Se não encontrar mapeamento, usa Groq (default rápido)
 */
export function selectProvider(task: string): AIProvider {
  return TASK_PROVIDER_MAP[task] || 'groq';
}

/**
 * Valida se as API keys estão configuradas
 */
export function validateProviders(): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!AI_PROVIDERS.groq.apiKey) missing.push('GROQ_API_KEY');
  if (!AI_PROVIDERS.gemini.apiKey) missing.push('GEMINI_API_KEY');
  if (!AI_PROVIDERS.openai.apiKey) missing.push('OPENAI_API_KEY');

  return {
    valid: missing.length === 0,
    missing,
  };
}
