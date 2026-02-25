import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Lead, Plan, LeadOrigin, FunnelStage } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * v2.36.0: LEAD SCORE IA - STAGE-BASED SCORING (Boas Práticas do Mercado)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * METODOLOGIA:
 * - Base Score (0-40 pontos): Qualidade intrínseca do lead
 * - Stage Score (0-60 pontos): Progresso no funil (DINÂMICO)
 *
 * FÓRMULA:
 * Score Final = Base Score + Stage Score
 * Stage Score = (ordem_atual / ordem_máxima) × 60
 *
 * VANTAGENS:
 * ✅ Score aumenta AUTOMATICAMENTE ao mover entre colunas
 * ✅ NÃO QUEBRA se usuário alterar CRUD de colunas (adapta via order)
 * ✅ Última coluna sempre chega perto de 100%
 * ✅ Justo: dados ruins + estágio avançado = score moderado/alto
 *
 * EXEMPLO:
 * Lead com dados completos (40 pts) em estágio 5/6 = 40 + 50 = 90%
 * Lead com dados incompletos (20 pts) em estágio 5/6 = 20 + 50 = 70%
 * Lead com dados completos (40 pts) em estágio 1/6 = 40 + 10 = 50%
 */

export interface ScoreFactors {
  // BASE SCORE (0-40 pontos)
  dataCompleteness: number; // 0-15 pontos (campos preenchidos)
  planValue: number; // 0-15 pontos (Enterprise/Pro/Basic)
  originQuality: number; // 0-10 pontos (Indicação/Evento/Site)

  // STAGE SCORE (0-60 pontos)
  stageProgress: number; // 0-60 pontos (posição no funil - DINÂMICO)
}

interface LeadWithRelations extends Lead {
  interestPlan?: Plan | null;
  origin?: LeadOrigin | null;
  stage?: FunnelStage | null;
}

@Injectable()
export class LeadScoreService {
  private readonly logger = new Logger(LeadScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula o Lead Score IA baseado em STAGE-BASED SCORING (v2.36.0)
   * @param lead Lead com relacionamentos carregados
   * @returns { score: number, factors: ScoreFactors }
   */
  async calculateLeadScore(lead: LeadWithRelations): Promise<{ score: number; factors: ScoreFactors }> {
    const factors: ScoreFactors = {
      // BASE SCORE (0-40 pontos)
      dataCompleteness: this.calculateCompleteness(lead),
      planValue: this.calculatePlanValue(lead.interestPlan),
      originQuality: this.calculateOriginQuality(lead.origin),

      // STAGE SCORE (0-60 pontos) - DINÂMICO baseado em order
      stageProgress: await this.calculateStageProgress(lead.stage),
    };

    const score = Math.min(100, Math.round(Object.values(factors).reduce((a, b) => a + b, 0)));

    this.logger.debug(`📊 Lead Score calculado para ${lead.id}: ${score}%`);
    this.logger.debug(`   Fatores: ${JSON.stringify(factors)}`);

    return { score, factors };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * BASE SCORE: QUALIDADE INTRÍNSECA DO LEAD (0-40 PONTOS)
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Fator 1: Completude dos Dados (0-15 pontos)
   * +3 pts para cada campo preenchido: nome, email, telefone, empresa, cpfCnpj
   */
  private calculateCompleteness(lead: Lead): number {
    let score = 0;
    if (lead.name && lead.name.trim()) score += 3;
    if (lead.email && lead.email.trim()) score += 3;
    if (lead.phone && lead.phone.trim()) score += 3;
    if (lead.companyName && lead.companyName.trim()) score += 3;
    if (lead.cpfCnpj && lead.cpfCnpj.trim()) score += 3;
    return score;
  }

  /**
   * Fator 2: Valor do Plano (0-15 pontos)
   * Enterprise/Premium = 15, Pro = 12, Basic = 10
   */
  private calculatePlanValue(plan: Plan | null | undefined): number {
    if (!plan) return 5; // Não tem plano, mas não zera (dá uma chance)

    const planName = plan.name.toLowerCase();

    if (planName.includes('enterprise') || planName.includes('premium')) {
      return 15;
    }
    if (planName.includes('pro') || planName.includes('professional')) {
      return 12;
    }
    if (planName.includes('basic') || planName.includes('starter')) {
      return 10;
    }

    // Fallback: baseado no preço
    const price = Number(plan.priceMonthly) || 0;
    if (price >= 500) return 15;
    if (price >= 200) return 12;
    return 10;
  }

  /**
   * Fator 3: Qualidade da Origem (0-10 pontos)
   * Indicação = 10, Evento = 8, Site = 6, Redes Sociais = 4, Cold Call = 2
   */
  private calculateOriginQuality(origin: LeadOrigin | null | undefined): number {
    if (!origin) return 3; // Não tem origem, mas não zera (dá uma chance)

    const originName = origin.name.toLowerCase();

    if (originName.includes('indicação') || originName.includes('indicacao') || originName.includes('referral')) {
      return 10;
    }
    if (originName.includes('evento') || originName.includes('feira') || originName.includes('event')) {
      return 8;
    }
    if (
      originName.includes('site') ||
      originName.includes('formulário') ||
      originName.includes('form') ||
      originName.includes('inbound')
    ) {
      return 6;
    }
    if (
      originName.includes('social') ||
      originName.includes('instagram') ||
      originName.includes('facebook') ||
      originName.includes('linkedin')
    ) {
      return 4;
    }
    if (originName.includes('cold') || originName.includes('outbound') || originName.includes('prospecção')) {
      return 2;
    }

    return 5; // Valor padrão
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * STAGE SCORE: PROGRESSO NO FUNIL (0-60 PONTOS) - DINÂMICO
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Fator 4: Progresso no Funil (0-60 pontos) - DINÂMICO
   * Calcula: (ordem_atual / ordem_máxima) × 60
   *
   * ADAPTAÇÃO AUTOMÁTICA:
   * - Se usuário tiver 6 colunas: ordem 1 = 10 pts, ordem 6 = 60 pts
   * - Se usuário adicionar 7ª coluna: ordem 1 = 8.5 pts, ordem 7 = 60 pts
   * - Se usuário deletar coluna: recalcula automaticamente
   */
  private async calculateStageProgress(stage: FunnelStage | null | undefined): Promise<number> {
    if (!stage) {
      // Lead sem estágio, usa padrão do primeiro estágio (Novo)
      const firstStage = await this.prisma.funnelStage.findFirst({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });

      if (!firstStage) return 0;

      return this.calculateStageProgressFromOrder(firstStage.order);
    }

    return this.calculateStageProgressFromOrder(stage.order);
  }

  /**
   * Calcula o Stage Score baseado na posição normalizada no funil
   * ✅ v2.37.0: FIX - Adapta automaticamente a order não-sequencial (gaps)
   *
   * ANTES: Usava (currentOrder / maxOrder) × 60
   * DEPOIS: Usa (posição_normalizada / totalColunas) × 60
   *
   * Exemplo: Colunas com order [1, 2, 3, 4, 6, 8] (6 colunas ativas)
   * - Coluna order=1 (índice 0): (1/6) × 60 = 10 pts
   * - Coluna order=8 (índice 5): (6/6) × 60 = 60 pts
   */
  private async calculateStageProgressFromOrder(currentOrder: number): Promise<number> {
    // Buscar TODAS as colunas ativas ordenadas
    const activeStages = await this.prisma.funnelStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    if (activeStages.length === 0) {
      // Fallback: se não há estágios, retorna 30 (meio termo)
      return 30;
    }

    // Encontrar índice da coluna atual no array ordenado
    const currentIndex = activeStages.findIndex((s) => s.order === currentOrder);

    if (currentIndex === -1) {
      // Coluna não encontrada nas ativas, usar fallback
      this.logger.warn(`Stage com order ${currentOrder} não encontrado nas colunas ativas`);
      return 30;
    }

    const normalizedPosition = currentIndex + 1; // 1-based (1, 2, 3, 4, 5, 6)
    const totalColumns = activeStages.length;

    // Fórmula: (posição_normalizada / total) × 60
    const progress = (normalizedPosition / totalColumns) * 60;

    return Math.round(progress);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DATABASE OPERATIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Atualiza o Lead Score no banco de dados
   */
  async updateLeadScore(leadId: string): Promise<{ score: number; factors: ScoreFactors }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        interestPlan: true,
        origin: true,
        stage: true,
      },
    });

    if (!lead) {
      throw new Error(`Lead ${leadId} não encontrado`);
    }

    const { score, factors } = await this.calculateLeadScore(lead);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        score: score,
        aiScoreFactors: factors as any,
        aiScoreUpdatedAt: new Date(),
      },
    });

    this.logger.log(`✅ Lead Score atualizado: ${lead.name || lead.companyName} = ${score}%`);

    return { score, factors };
  }

  /**
   * Retorna a classificação do score (para badge colorido)
   */
  getScoreClassification(score: number): { label: string; color: string; emoji: string } {
    if (score >= 80) {
      return { label: 'QUENTE', color: 'green', emoji: '🟢' };
    }
    if (score >= 50) {
      return { label: 'MORNO', color: 'yellow', emoji: '🟡' };
    }
    return { label: 'FRIO', color: 'red', emoji: '🔴' };
  }
}
