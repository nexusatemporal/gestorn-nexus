import { DashboardStatsDto } from '@/modules/dashboard/dto/dashboard-stats.dto';

/**
 * ✅ v2.51.0: Gera prompt para análise de métricas do dashboard
 *
 * @param stats - Estatísticas completas do dashboard
 * @param product - Produto filtrado (ONE_NEXUS, LOCADORAS) ou undefined para todos
 * @returns Objeto com system prompt e user prompt
 */
export const getDashboardInsightsPrompt = (
  stats: DashboardStatsDto,
  product?: string,
) => ({
  system: `Você é um consultor financeiro e de vendas com 20 anos de experiência em SaaS B2B.
Sua especialidade é analisar métricas e fornecer insights acionáveis para gestores.

**REGRAS DE OURO:**
1. Seja direto e prático - gestores não têm tempo
2. Priorize insights ACIONÁVEIS sobre observações óbvias
3. Use números concretos sempre que possível
4. Indique SEVERIDADE correta:
   - CRITICAL: Problemas urgentes que exigem ação imediata
   - WARNING: Tendências negativas que precisam atenção
   - SUCCESS: Vitórias e oportunidades para capitalizar
   - INFO: Observações neutras ou contextuais

5. Cada insight deve ter:
   - title: Resumo em 5-8 palavras
   - description: Explicação em 1-2 frases (máximo 500 chars)
   - actionable: Próximo passo claro (opcional, se aplicável)

**IMPORTANTE: Retorne APENAS um JSON válido, sem markdown, sem \`\`\`json, apenas o objeto puro.**`,

  user: `Analise os dados abaixo e gere exatamente 3 insights estratégicos:

**MÉTRICAS ATUAIS (MoM - Mês Atual vs Mês Anterior)**
${product ? `**Produto Filtrado**: ${product}` : '**Todos os Produtos**'}

📊 **KPIs Principais:**
- Total de Clientes: ${stats.kpis.totalClients}
- Clientes Ativos: ${stats.kpis.activeClients}
- Clientes em Trial: ${stats.kpis.trialClients}
- Clientes Cancelados (período): ${stats.kpis.churnedClients}
- MRR: R$ ${stats.kpis.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Leads em Aberto: ${stats.kpis.totalLeads}
- Taxa de Conversão: ${stats.kpis.conversionRate.toFixed(1)}%
- Inadimplência: ${stats.kpis.overduePayments} pagamentos vencidos

📈 **Tendências vs Período Anterior:**
- Clientes: ${stats.kpis.totalClientsTrend || 'N/A'} ${stats.kpis.totalClientsTrendUp ? '↑' : '↓'}
- MRR: ${stats.kpis.mrrTrend || 'N/A'} ${stats.kpis.mrrTrendUp ? '↑' : '↓'}
- Leads: ${stats.kpis.totalLeadsTrend || 'N/A'} ${stats.kpis.totalLeadsTrendUp ? '↑' : '↓'}
- Inadimplência: ${stats.kpis.overduePaymentsTrend || 'N/A'} ${stats.kpis.overduePaymentsTrendUp ? '↑' : '↓'}

💰 **Distribuição de Clientes por Plano:**
${stats.clientsByPlan.map((p) => `  - ${p.plan}: ${p.count} clientes`).join('\n')}

📅 **Evolução de Receita (últimos 6 meses):**
${stats.revenueOverTime.map((r) => `  - ${r.month}: R$ ${r.revenue.toLocaleString('pt-BR')}`).join('\n')}

**TAREFA:**
Gere exatamente 3 insights no formato JSON abaixo.
Priorize insights sobre:
1. Saúde financeira (MRR, churn, inadimplência)
2. Pipeline de vendas (conversão, leads, trials)
3. Oportunidades de crescimento ou riscos críticos

**ESTRUTURA JSON (ATENÇÃO: severity sempre em MINÚSCULAS):**
{
  "insights": [
    {
      "severity": "critical|warning|success|info",
      "title": "Título curto e impactante (5-8 palavras)",
      "description": "Explicação clara do insight com números concretos (1-2 frases, max 500 chars)",
      "actionable": "Próximo passo específico que o gestor deve tomar (opcional, max 300 chars)"
    },
    { /* insight 2 */ },
    { /* insight 3 */ }
  ]
}

**EXEMPLOS CORRETOS de severity:**
✅ "severity": "critical"
✅ "severity": "warning"
✅ "severity": "success"
✅ "severity": "info"

❌ "severity": "CRITICAL" (ERRADO - não use maiúsculas)
❌ "severity": "Warning" (ERRADO - não use PascalCase)

**RETORNE APENAS O JSON, SEM QUALQUER TEXTO ADICIONAL.**`,
});
