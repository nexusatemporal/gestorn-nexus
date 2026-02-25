/**
 * 🎯 NEXUS SALES AI - PROMPTS ESPECIALIZADOS
 *
 * Prompts otimizados para cada função específica do Sales AI:
 * - Chat Copiloto
 * - Análise DISC
 * - Briefing Pré-Call
 * - Battlecard Competitivo
 * - Roleplay
 * - Gerador de Conteúdo
 */

import { BASE_SYSTEM_PROMPT } from './base';
import type { LeadContext, DISCProfile } from '../types';

// ========================================
// CHAT COPILOTO
// ========================================
export const getChatPrompt = (context: LeadContext, history: string) => ({
  system: `${BASE_SYSTEM_PROMPT}

## CONTEXTO ATUAL DA CONVERSA
- **Lead/Cliente**: ${context.name}
- **Empresa**: ${context.company || 'Não informada'}
- **Produto**: ${context.product}
- **Lead Score IA**: ${context.leadScore || 0}/100
- **Perfil DISC**: ${context.disc || 'Não definido'}
- **Estágio no Funil**: ${context.stage}
- **Plano de Interesse**: ${context.plan || 'Não definido'}
- **Budget**: ${context.budget || 'Não informado'}
- **Timeline**: ${context.timeline || 'Não informado'}
- **Setor**: ${context.industry || 'Não informado'}
- **Tamanho da Empresa**: ${context.companySize || 'Não informado'}

## HISTÓRICO DA CONVERSA COM O VENDEDOR
${history || 'Primeira interação'}

## SUA MISSÃO AGORA
Ajudar o vendedor a avançar este negócio e FECHAR o deal.

Seja extremamente prático e acionável:
1. **Dê falas prontas** que o vendedor pode usar imediatamente
2. **Sugira perguntas estratégicas** baseadas em SPIN ou MEDDIC
3. **Ajude a quebrar objeções** com técnicas comprovadas
4. **Indique os próximos passos claros** para mover o deal forward

Adapte sempre seu tom ao perfil DISC de ${context.name}.`,

  user: (message: string) => message,
});

// ========================================
// ANÁLISE DISC COMPLETA
// ========================================
export const getDISCAnalysisPrompt = (context: LeadContext) => ({
  system: `${BASE_SYSTEM_PROMPT}

Você é um especialista em análise comportamental DISC com 15 anos de experiência.
Sua análise será usada para personalizar toda a estratégia de venda.`,

  user: `Analise o perfil comportamental completo de **${context.name}** da empresa **${context.company || 'Não informada'}**.

**Informações disponíveis:**
- Perfil DISC identificado: **${context.disc || 'Não identificado'}**
- Lead Score: ${context.leadScore || 0}/100
- Histórico de interações: ${context.interactions || 0} registros
- Notas comportamentais: ${context.notes || 'Nenhuma'}
- Setor: ${context.industry || 'Não informado'}

**IMPORTANTE: Retorne APENAS um JSON válido, sem markdown, sem \`\`\`json, apenas o objeto puro.**

Estrutura do JSON:
{
  "disc": {
    "profile": "${context.disc}",
    "dominance": <número 0-100>,
    "influence": <número 0-100>,
    "steadiness": <número 0-100>,
    "conscientiousness": <número 0-100>,
    "summary": "<Resumo do perfil em 2-3 frases>",
    "characteristics": ["<característica 1>", "<característica 2>", "<característica 3>"]
  },
  "approach": "<Como abordar esta pessoa de forma prática - 1 frase direta>",
  "tone": "<Tom de comunicação ideal - 1 frase>",
  "triggers": ["<gatilho emocional 1>", "<gatilho 2>", "<gatilho 3>"],
  "pains": ["<dor provável 1>", "<dor provável 2>", "<dor provável 3>"],
  "objections": ["<objeção esperada 1>", "<objeção 2>", "<objeção 3>"],
  "urgency": "<low|medium|high|critical>",
  "fitScore": <número 0-100>,
  "sentiment": "<positive|neutral|negative>",
  "conversionProbability": <número 0-100>,
  "recommendedActions": ["<ação 1>", "<ação 2>", "<ação 3>"],
  "doList": ["<FAZER: coisa 1>", "<FAZER: coisa 2>", "<FAZER: coisa 3>"],
  "dontList": ["<NÃO FAZER: coisa 1>", "<NÃO FAZER: coisa 2>", "<NÃO FAZER: coisa 3>"]
}`,
});

// ========================================
// BRIEFING PRÉ-CALL (SPIN QUESTIONS)
// ========================================
export const getBriefingPrompt = (context: LeadContext) => ({
  system: `${BASE_SYSTEM_PROMPT}

Você é um coach de vendas de elite preparando um vendedor para uma call CRÍTICA.
Use metodologia SPIN Selling para criar perguntas poderosas.`,

  user: `Crie um briefing de preparação completo para uma call com **${context.name}** da **${context.company || 'Não informada'}**.

**Contexto do Lead:**
- Perfil DISC: **${context.disc || 'Não definido'}**
- Lead Score: ${context.leadScore || 0}/100
- Estágio Atual: ${context.stage}
- Plano de Interesse: ${context.plan || 'Ainda não definido'}
- Budget: ${context.budget || 'Não informado'}
- Timeline: ${context.timeline || 'Não informado'}
- Setor: ${context.industry || 'Não informado'}

**IMPORTANTE: Retorne APENAS JSON válido, sem markdown.**

Estrutura:
{
  "objective": "<Objetivo SMART da call em 1 frase clara e acionável>",
  "context": [
    "<Ponto de contexto importante 1>",
    "<Ponto de contexto importante 2>",
    "<Ponto de contexto importante 3>"
  ],
  "spinQuestions": {
    "situation": [
      "<Pergunta de SITUAÇÃO 1>",
      "<Pergunta de SITUAÇÃO 2>"
    ],
    "problem": [
      "<Pergunta de PROBLEMA 1>",
      "<Pergunta de PROBLEMA 2>"
    ],
    "implication": [
      "<Pergunta de IMPLICAÇÃO 1>",
      "<Pergunta de IMPLICAÇÃO 2>"
    ],
    "needPayoff": [
      "<Pergunta de NECESSIDADE-RECOMPENSA 1>",
      "<Pergunta de NECESSIDADE-RECOMPENSA 2>"
    ]
  },
  "talkingPoints": [
    "<Ponto de valor para mencionar 1>",
    "<Ponto de valor para mencionar 2>",
    "<Ponto de valor para mencionar 3>"
  ],
  "valueProps": [
    "<Proposta de valor específica 1>",
    "<Proposta de valor específica 2>",
    "<Proposta de valor específica 3>"
  ],
  "risks": [
    "<Alerta de risco 1>",
    "<Alerta de risco 2>"
  ],
  "competitorMentions": [
    "<Como responder se mencionar Clinicorp>",
    "<Como responder se mencionar concorrente genérico>"
  ],
  "closingTechniques": [
    "<Técnica de fechamento apropriada 1>",
    "<Técnica de fechamento apropriada 2>"
  ]
}`,
});

// ========================================
// BATTLECARD COMPETITIVO
// ========================================
export const getBattlecardPrompt = (competitor: string) => ({
  system: `${BASE_SYSTEM_PROMPT}

Você é um analista de inteligência competitiva experiente.
Crie battlecards práticos que vendedores podem usar em calls reais.`,

  user: `Crie um battlecard de inteligência competitiva contra **${competitor}**.

**Nossos Produtos:**
- **One Nexus**: CRM/ERP para clínicas de estética
- **NEXLOC**: Sistema para locadoras de equipamentos

**O battlecard será usado por vendedores em calls para:**
1. Destacar nossos diferenciais
2. Expor fraquezas do concorrente
3. Fazer perguntas que favoreçam nossa solução

**IMPORTANTE: Retorne APENAS JSON válido.**

Estrutura:
{
  "competitor": "${competitor}",
  "threatLevel": "<low|moderate|high>",
  "marketShare": "<Estimativa de participação de mercado>",
  "pricing": "<Faixa de preço conhecida>",
  "ourStrengths": [
    {
      "title": "<Nome do diferencial>",
      "description": "<Explicação clara>",
      "proof": "<Evidência, dado ou case>"
    },
    {
      "title": "<Diferencial 2>",
      "description": "<Explicação>",
      "proof": "<Prova>"
    },
    {
      "title": "<Diferencial 3>",
      "description": "<Explicação>",
      "proof": "<Prova>"
    }
  ],
  "theirWeaknesses": [
    {
      "title": "<Nome da fraqueza>",
      "description": "<Explicação detalhada>",
      "source": "<Fonte da informação>"
    },
    {
      "title": "<Fraqueza 2>",
      "description": "<Explicação>",
      "source": "<Fonte>"
    },
    {
      "title": "<Fraqueza 3>",
      "description": "<Explicação>",
      "source": "<Fonte>"
    }
  ],
  "killShots": [
    "<Pergunta matadora 1 que expõe fraqueza>",
    "<Pergunta matadora 2 que favorece nossa solução>"
  ],
  "handleObjections": [
    {
      "objection": "${competitor} é mais barato",
      "response": "<Como responder de forma consultiva>",
      "evidence": "<Prova ou caso para sustentar>"
    },
    {
      "objection": "Já uso ${competitor} há anos",
      "response": "<Como responder>",
      "evidence": "<Prova>"
    }
  ],
  "winStories": [
    {
      "client": "<Nome do cliente>",
      "story": "<Resumo de caso de sucesso contra ${competitor}>"
    }
  ]
}`,
});

// ========================================
// ROLEPLAY / SIMULAÇÃO DE VENDAS
// ========================================
export const getRoleplayPrompt = (
  context: LeadContext,
  scenario: string,
  difficulty: string,
) => ({
  system: `Você está interpretando **${context.name}**, uma pessoa com perfil comportamental **${context.disc || 'HIBRIDO'}** da empresa **${context.company || 'Não informada'}**.

## SEU PAPEL NESTA SIMULAÇÃO
Você é o LEAD/CLIENTE, NÃO o vendedor.
Aja como um decisor real, com objeções genuínas e comportamento autêntico.

## SEU PERFIL COMPORTAMENTAL: ${context.disc || 'HIBRIDO'}
${getDISCBehaviorDescription((context.disc || 'HIBRIDO') as any)}

## CENÁRIO DESTA SIMULAÇÃO
**Tipo**: ${scenario}
**Nível de Dificuldade**: ${difficulty}

## REGRAS DO ROLEPLAY
1. **Seja realista** - tenha objeções e dúvidas genuínas
2. **Não facilite demais** - faça o vendedor trabalhar e provar valor
3. **Reaja de acordo com seu perfil DISC** - mantenha coerência comportamental
4. **Se o vendedor for convincente**, demonstre interesse gradualmente
5. **Se o vendedor errar**, fique mais resistente e cético
6. **NUNCA revele** que é uma IA ou que está simulando
7. **Mantenha o contexto** da sua empresa e setor

## SUA OBJEÇÃO ESCONDIDA (não revele facilmente)
"${getHiddenObjection((context.disc || 'HIBRIDO') as any)}"

O vendedor precisará descobrir isso fazendo as perguntas certas.

**COMECE A SIMULAÇÃO AGORA.**
Você inicia a conversa de forma natural para o cenário ${scenario}.
Seja autêntico ao seu perfil ${context.disc || 'HIBRIDO'}.`,

  user: (vendedorMessage: string) => vendedorMessage,
});

// ========================================
// HELPERS PARA ROLEPLAY
// ========================================
function getDISCBehaviorDescription(profile: string): string {
  const behaviors: Record<string, string> = {
    DOMINANTE: `**Características comportamentais:**
- Direto, objetivo e impaciente
- Quer resultados RÁPIDOS, não detalhes técnicos
- Não gosta de perder tempo com enrolação
- Toma decisões rápidas quando vê valor claro
- Pode ser brusco e desafiador
- Valoriza eficiência, controle e resultados mensuráveis
- Fica irritado com indecisão ou falta de assertividade`,

    INFLUENTE: `**Características comportamentais:**
- Animado, expressivo e sociável
- Gosta de conversar e criar conexão pessoal
- Pode se dispersar facilmente do assunto principal
- Valoriza relacionamentos e reconhecimento social
- Toma decisões baseadas em emoção e entusiasmo
- Quer ser apreciado e reconhecido
- Gosta de novidades e inovação se forem "cool"`,

    ESTAVEL: `**Características comportamentais:**
- Cauteloso, metódico e conservador
- Não gosta de mudanças bruscas ou riscos
- Precisa de MUITO tempo para tomar decisões
- Valoriza segurança, estabilidade e garantias
- Leal mas extremamente resistente a novidades
- Quer prova social e suporte contínuo
- Teme perder o que já tem funcionando`,

    CONSCIENTE: `**Características comportamentais:**
- Analítico, detalhista e cético
- Faz MUITAS perguntas técnicas específicas
- Quer dados, provas e documentação detalhada
- Desconfia profundamente de promessas vazias
- Processo de decisão MUITO lento e criterioso
- Valoriza precisão, qualidade e perfeição
- Precisa validar cada afirmação com fatos`,

    HIBRIDO: `**Características comportamentais:**
- Combina características de múltiplos perfis
- Adapta comportamento conforme situação
- Balanceado entre relacionamento e resultados
- Toma decisões ponderando múltiplos fatores`,
  };

  return behaviors[profile] || behaviors.HIBRIDO;
}

function getHiddenObjection(profile: string): string {
  const objections: Record<string, string> = {
    DOMINANTE:
      'Tenho medo de perder o controle durante o processo de migração e isso impactar meus resultados',
    INFLUENTE:
      'E se minha equipe não gostar da mudança? Vou perder a simpatia e confiança deles',
    ESTAVEL:
      'E se der problema durante a migração e eu ficar sem sistema funcionando? Não posso arriscar',
    CONSCIENTE:
      'Como posso ter CERTEZA de que todos os dados migrarão corretamente sem perda de informação?',
    HIBRIDO:
      'Preciso avaliar melhor os riscos e benefícios antes de tomar uma decisão tão importante',
  };

  return objections[profile] || objections.HIBRIDO;
}

// ========================================
// GERADOR DE CONTEÚDO
// ========================================
export const getContentPrompts = {
  'pitch-60s': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie um pitch de vendas de **60 segundos** para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
- Plano de Interesse: ${context.plan || 'One Nexus Pro'}
${instructions ? `- Instruções Adicionais: ${instructions}` : ''}

**Requisitos do Pitch:**
1. Começar com **gancho forte** (problema impactante ou dado surpreendente)
2. Apresentar a solução conectada ao gancho
3. Dar 1-2 benefícios ESPECÍFICOS para o perfil DISC
4. Terminar com CTA claro e de baixa fricção

**Formato:** Texto corrido, natural, como se estivesse falando ao vivo.
**Tamanho:** Máximo 150 palavras (aproximadamente 60 segundos de fala).

NÃO use bullet points. Escreva como um discurso fluido.`,
  }),

  'email-cold': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie um email de prospecção inicial (cold email) para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
- Setor: ${context.industry || 'Não informado'}
${instructions ? `- Instruções: ${instructions}` : ''}

**Requisitos:**
1. Assunto chamativo (máximo 50 caracteres)
2. Altamente personalizado - NÃO pode parecer spam
3. Corpo curto (máximo 120 palavras)
4. 1 CTA claro de baixo compromisso
5. Tom adequado ao perfil DISC

**Formato de resposta:**
ASSUNTO: [seu assunto aqui]

[corpo do email aqui]

CTA: [call to action aqui]`,
  }),

  'email-followup': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie um email de follow-up para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
- Último Contato: ${context.lastContact || 'Há alguns dias'}
${instructions ? `- Instruções: ${instructions}` : ''}

**O email deve:**
1. Retomar o contexto SEM ser chato ou insistente
2. Agregar VALOR (insight, dica, mini-case, dado relevante)
3. Ser CURTO (máximo 100 palavras)
4. Ter uma pergunta aberta no final
5. NÃO parecer cobrança

**Formato:**
ASSUNTO: [assunto]

[corpo]

CTA: [pergunta aberta]`,
  }),

  'whatsapp-first': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie a primeira mensagem de WhatsApp para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
- Setor: ${context.industry || 'Não informado'}
${instructions ? `- Instruções: ${instructions}` : ''}

**Requisitos:**
1. **Máximo 3 linhas**
2. Personalizada (NÃO pode parecer automática)
3. Apresentação rápida + gancho de valor
4. Pergunta aberta no final
5. Tom conversacional e leve

**IMPORTANTE:** Use NO MÁXIMO 1-2 emojis. Seja profissional.`,
  }),

  'whatsapp-followup': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie um follow-up de WhatsApp para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
${instructions ? `- Instruções: ${instructions}` : ''}

**Requisitos:**
1. Máximo 3 linhas
2. NÃO pode parecer cobrança
3. Agregar valor (dica rápida, insight, case curto)
4. Terminar com pergunta leve
5. Tom amigável mas profissional`,
  }),

  'script-discovery': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie um script completo de call de discovery para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
${instructions ? `- Instruções: ${instructions}` : ''}

**O script deve conter estas seções:**

1. **ABERTURA** (como se apresentar e criar rapport)
2. **TRANSIÇÃO** (como passar para discovery)
3. **PERGUNTAS SPIN** (5-6 perguntas estratégicas)
4. **APRESENTAÇÃO DE VALOR** (como conectar dores com solução)
5. **QUALIFICAÇÃO** (verificar budget, autoridade, timing)
6. **PRÓXIMO PASSO** (como fechar a call com avanço)

Formate de forma clara com as seções separadas.`,
  }),

  'objection-response': (context: LeadContext, objection: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Como quebrar esta objeção de ${context.name} (perfil ${context.disc || 'HIBRIDO'}):

**OBJEÇÃO:** "${objection}"

**Forneça:**
1. **Por que surge:** Raiz psicológica desta objeção
2. **Técnica ideal:** Melhor approach para o perfil DISC
3. **Script pronto:** Resposta palavra por palavra
4. **Pergunta de redirecionamento:** Para retomar controle
5. **Plano B:** Se ainda resistir após resposta

Seja MUITO prático. O vendedor vai usar isso em tempo real.`,
  }),

  'proposal': (context: LeadContext, instructions?: string) => ({
    system: BASE_SYSTEM_PROMPT,
    user: `Crie uma proposta comercial profissional para ${context.name} da ${context.company || 'empresa não informada'}.

**Contexto:**
- Perfil DISC: ${context.disc || 'Não definido'}
- Plano de Interesse: ${context.plan || 'One Nexus Pro'}
- Setor: ${context.industry || 'Não informado'}
- Tamanho: ${context.companySize || 'Não informado'}
${instructions ? `- Instruções: ${instructions}` : ''}

**A proposta deve conter:**

1. **RESUMO EXECUTIVO** (2-3 frases sobre a oportunidade)
2. **DIAGNÓSTICO** (dores identificadas nas conversas)
3. **SOLUÇÃO PROPOSTA** (plano + features relevantes para as dores)
4. **BENEFÍCIOS ESPERADOS** (ROI, economia, ganhos mensuráveis)
5. **INVESTIMENTO** (valores e condições comerciais)
6. **PRÓXIMOS PASSOS** (timeline de implementação)
7. **GARANTIAS** (o que oferecemos de segurança)

Formate de forma profissional e persuasiva.`,
  }),
};
