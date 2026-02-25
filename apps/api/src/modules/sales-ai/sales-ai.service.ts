/**
 * 🧠 SALES AI SERVICE
 *
 * Camada de serviço que orquestra chamadas ao NexusSalesAI
 */

import { Injectable, Logger } from '@nestjs/common';
import { salesAI } from '../../lib/ai/service';
import {
  getChatPrompt,
  getDISCAnalysisPrompt,
  getBriefingPrompt,
  getBattlecardPrompt,
  getRoleplayPrompt,
  getContentPrompts,
} from '../../lib/ai/prompts/functions';
import type {
  ChatRequest,
  ChatResponse,
  DISCAnalysisRequest,
  DISCAnalysisResponse,
  BriefingRequest,
  BriefingResponse,
  BattlecardRequest,
  BattlecardResponse,
  RoleplayRequest,
  RoleplayResponse,
  GeneratorRequest,
  GeneratorResponse,
  FeedbackRequest,
  FeedbackResponse,
  LeadContext,
} from '../../lib/ai/types';

@Injectable()
export class SalesAIService {
  private readonly logger = new Logger(SalesAIService.name);

  // ========================================
  // CHAT
  // ========================================
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.logger.log(
      `[CHAT] Lead: ${request.leadContext.name} | Message: "${request.message.substring(0, 50)}..."`,
    );

    const historyText = request.history
      ? request.history
          .map((msg) => `${msg.role === 'user' ? 'Vendedor' : 'AI'}: ${msg.content}`)
          .join('\n')
      : '';

    const prompts = getChatPrompt(
      request.leadContext as LeadContext,
      historyText,
    );

    const response = await salesAI.generate({
      task: 'chat',
      systemPrompt: prompts.system,
      prompt: prompts.user(request.message),
      provider: request.provider as any,
    });

    // Gerar sugestões de próximas perguntas
    const suggestions = this.generateSuggestions(request.leadContext as LeadContext);

    return {
      response,
      suggestions,
      nextActions: this.getNextActions(request.leadContext as LeadContext),
    };
  }

  // ========================================
  // CHAT STREAMING
  // ========================================
  async *chatStream(request: ChatRequest): AsyncGenerator<string> {
    this.logger.log(
      `[CHAT STREAM] Lead: ${request.leadContext.name}`,
    );

    const historyText = request.history
      ? request.history
          .map((msg) => `${msg.role === 'user' ? 'Vendedor' : 'AI'}: ${msg.content}`)
          .join('\n')
      : '';

    const prompts = getChatPrompt(
      request.leadContext as LeadContext,
      historyText,
    );

    yield* salesAI.generateStream({
      systemPrompt: prompts.system,
      prompt: prompts.user(request.message),
      provider: request.provider as any,
    });
  }

  // ========================================
  // DISC ANALYSIS
  // ========================================
  async analyzeDISC(request: DISCAnalysisRequest): Promise<DISCAnalysisResponse> {
    this.logger.log(`[DISC] Analyzing: ${request.leadContext.name}`);

    const prompts = getDISCAnalysisPrompt(request.leadContext as LeadContext);

    const response = await salesAI.generate({
      task: 'disc-analysis',
      systemPrompt: prompts.system,
      prompt: prompts.user,
      jsonMode: true,
    });

    const analysis = JSON.parse(response);

    return { analysis };
  }

  // ========================================
  // BRIEFING
  // ========================================
  async generateBriefing(request: BriefingRequest): Promise<BriefingResponse> {
    this.logger.log(
      `[BRIEFING] Lead: ${request.leadContext.name} | Type: ${request.callType || 'discovery'}`,
    );

    const prompts = getBriefingPrompt(
      request.leadContext as LeadContext,
    );

    const response = await salesAI.generate({
      task: 'briefing',
      systemPrompt: prompts.system,
      prompt: prompts.user,
      jsonMode: true,
    });

    const briefing = JSON.parse(response);

    return { briefing };
  }

  // ========================================
  // BATTLECARD
  // ========================================
  async generateBattlecard(request: BattlecardRequest): Promise<BattlecardResponse> {
    this.logger.log(
      `[BATTLECARD] Lead: ${request.leadContext.name} | Competitor: ${request.competitor}`,
    );

    const prompts = getBattlecardPrompt(
      request.competitor,
    );

    const response = await salesAI.generate({
      task: 'battlecard',
      systemPrompt: prompts.system,
      prompt: prompts.user,
      jsonMode: true,
    });

    const battlecard = JSON.parse(response);

    return { battlecard };
  }

  // ========================================
  // ROLEPLAY
  // ========================================
  async roleplay(request: RoleplayRequest): Promise<RoleplayResponse> {
    this.logger.log(
      `[ROLEPLAY] Scenario: ${request.scenario.title} | Difficulty: ${request.scenario.difficulty}`,
    );

    const historyText = request.history
      .map((msg) => {
        const roleLabel =
          msg.role === 'vendedor'
            ? 'Vendedor'
            : msg.role === 'cliente'
              ? 'Cliente'
              : 'Coach';
        return `${roleLabel}: ${msg.content}`;
      })
      .join('\n');

    // Criar contexto do lead a partir do scenario persona
    const leadContext: LeadContext = {
      id: 'roleplay',
      name: request.scenario.persona.name,
      disc: request.scenario.persona.disc as any,
      stage: 'PROSPECCAO' as any,
      product: 'ONE_NEXUS' as any,
    };

    const prompts = getRoleplayPrompt(
      leadContext,
      request.scenario.description + '\n\nHistórico:\n' + historyText,
      request.scenario.difficulty,
    );

    const response = await salesAI.generate({
      task: 'roleplay',
      systemPrompt: prompts.system,
      prompt: prompts.user(request.message),
    });

    // TODO: Implementar análise de feedback
    const feedback = this.analyzeRoleplayPerformance(
      request.message,
      response,
      request.scenario.difficulty,
    );

    return {
      response,
      feedback,
      suggestedResponses: this.generateRoleplaySuggestions(request.scenario),
    };
  }

  // ========================================
  // CONTENT GENERATOR
  // ========================================
  async generateContent(request: GeneratorRequest): Promise<GeneratorResponse> {
    this.logger.log(
      `[GENERATOR] Type: ${request.type} | Lead: ${request.leadContext.name}`,
    );

    // Tratamento especial para objection-response que requer objection obrigatória
    const prompts =
      request.type === 'objection-response'
        ? getContentPrompts[request.type](
            request.leadContext as LeadContext,
            request.instructions || 'Preço muito alto',
          )
        : getContentPrompts[request.type](
            request.leadContext as LeadContext,
            request.instructions,
          );

    const content = await salesAI.generate({
      task: request.type,
      systemPrompt: prompts.system,
      prompt: prompts.user,
    });

    return {
      content,
      metadata: {
        wordCount: content.split(/\s+/).length,
        tone: this.getToneForDISC(request.leadContext.disc),
      },
    };
  }

  // ========================================
  // FEEDBACK
  // ========================================
  async submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
    this.logger.log(
      `[FEEDBACK] Message: ${request.messageId} | Rating: ${request.rating}`,
    );

    // TODO: Implementar armazenamento de feedback
    // Para melhorar o modelo e tracking de qualidade

    return {
      success: true,
      message: 'Feedback recebido com sucesso! Obrigado por ajudar a melhorar o Nexus Sales AI.',
    };
  }

  // ========================================
  // ANALYTICS (MOCK - Implementar com banco)
  // ========================================
  async getAnalytics(userId: string): Promise<any> {
    this.logger.log(`[ANALYTICS] User: ${userId}`);

    // TODO: Implementar queries reais no banco
    return {
      metrics: {
        lead: {
          totalLeads: 0,
          activeLeads: 0,
          convertedLeads: 0,
          conversionRate: 0,
        },
        ai: {
          totalInteractions: 0,
          avgResponseTime: 0,
          satisfactionRate: 0,
          mostUsedFeatures: [],
        },
        performance: {
          avgDealSize: 0,
          avgSalesCycle: 0,
          winRate: 0,
        },
      },
    };
  }

  // ========================================
  // HELPERS
  // ========================================

  private generateSuggestions(context: LeadContext): string[] {
    const stage = context.stage;
    const suggestions: Record<string, string[]> = {
      PROSPECCAO: [
        'Quais são as maiores dores do lead?',
        'Como posso qualificar melhor esse lead?',
        'Qual abordagem usar nesse perfil DISC?',
      ],
      QUALIFICACAO: [
        'Perguntas SPIN para aprofundar discovery',
        'Como identificar o real decisor?',
        'Estratégia para construir urgência',
      ],
      APRESENTACAO: [
        'Como adaptar demo para esse perfil?',
        'Quais cases de sucesso mostrar?',
        'Objeções comuns e respostas',
      ],
      NEGOCIACAO: [
        'Estratégia de precificação',
        'Como lidar com objeção de preço?',
        'Próximos passos para fechamento',
      ],
      FECHAMENTO: [
        'Como criar senso de urgência?',
        'Técnicas de fechamento para esse perfil',
        'Condições especiais disponíveis',
      ],
      POS_VENDA: [
        'Oportunidades de upsell',
        'Como garantir sucesso do cliente?',
        'Momento ideal para expansão',
      ],
    };

    return suggestions[stage] || suggestions.PROSPECCAO;
  }

  private getNextActions(context: LeadContext): string[] {
    const stage = context.stage;
    const actions: Record<string, string[]> = {
      PROSPECCAO: ['Agendar call de discovery', 'Enviar material institucional', 'Conectar no LinkedIn'],
      QUALIFICACAO: ['Fazer SPIN Questions', 'Validar budget e timeline', 'Identificar decisor'],
      APRESENTACAO: ['Agendar demo personalizada', 'Enviar proposta comercial', 'Preparar cases relevantes'],
      NEGOCIACAO: ['Negociar condições', 'Responder objeções', 'Enviar contrato'],
      FECHAMENTO: ['Agendar assinatura', 'Confirmar onboarding', 'Celebrar fechamento'],
      POS_VENDA: ['Check-in de 30 dias', 'Avaliar satisfação', 'Explorar upsell'],
    };

    return actions[stage] || actions.PROSPECCAO;
  }

  private analyzeRoleplayPerformance(
    vendedorMessage: string,
    clienteResponse: string,
    difficulty: string,
  ): { score: number; strengths: string[]; improvements: string[] } {
    // TODO: Implementar análise real com IA
    return {
      score: 75,
      strengths: ['Boa abertura', 'Comunicação clara'],
      improvements: ['Aprofundar descoberta de dores', 'Fazer mais perguntas abertas'],
    };
  }

  private generateRoleplaySuggestions(scenario: any): string[] {
    return [
      'Fazer uma pergunta SPIN Situation',
      'Explorar a dor principal do cliente',
      'Apresentar um benefício específico',
    ];
  }

  private getToneForDISC(disc?: string): string {
    const tones: Record<string, string> = {
      DOMINANTE: 'Direto e assertivo',
      INFLUENTE: 'Entusiasmado e visual',
      ESTAVEL: 'Paciente e reassegurador',
      CONSCIENTE: 'Preciso e detalhista',
      HIBRIDO: 'Balanceado e adaptável',
    };

    return tones[disc || 'HIBRIDO'] || 'Profissional';
  }
}
