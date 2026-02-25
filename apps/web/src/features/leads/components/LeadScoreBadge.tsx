import { Sparkles } from 'lucide-react';

interface LeadScoreBadgeProps {
  score: number;
  factors?: {
    dataCompleteness: number;
    planValue: number;
    hasInterestPlan: number; // ✅ v2.35.0: NOVO FATOR
    expectedRevenue: number;
    originQuality: number;
    funnelVelocity: number;
    engagement: number;
  };
  showTooltip?: boolean;
}

export function LeadScoreBadge({ score, factors, showTooltip = true }: LeadScoreBadgeProps) {
  // Criar título para tooltip nativo
  const tooltipText =
    showTooltip && factors
      ? `Lead Score: ${score}%
📝 Dados Completos: ${factors.dataCompleteness}/25
💰 Valor do Plano: ${factors.planValue}/20
✅ Tem Plano: ${factors.hasInterestPlan}/10
📈 Receita Esperada: ${factors.expectedRevenue}/10
🎯 Qualidade Origem: ${factors.originQuality}/15
⚡ Velocidade Funil: ${factors.funnelVelocity}/10
💬 Engajamento: ${factors.engagement}/10`
      : undefined;

  // Badge EXATAMENTE como no modelo original: verde se >80, senão amarelo
  return (
    <div
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 ${
        score > 80 ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
      }`}
      title={tooltipText}
    >
      <Sparkles size={10} />
      {score}%
    </div>
  );
}
