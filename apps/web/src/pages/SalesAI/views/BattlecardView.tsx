/**
 * ══════════════════════════════════════════════════════════════════════════
 * ⚔️ BATTLECARD VIEW - Inteligência competitiva
 * ══════════════════════════════════════════════════════════════════════════
 */

import { Zap, ShieldAlert } from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface BattlecardViewProps {
  leadContext: LeadContext | null;
}

export function BattlecardView({ leadContext }: BattlecardViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Selecione um lead para gerar battlecard</p>
      </div>
    );
  }

  const differentials = [
    { t: 'Inteligência de Vendas Consultiva (SPIN/Challenger)', d: 'Clinicorp da Locaweb é apenas CRM raso. Não tem IA nem análise comportamental do lead.' },
    { t: 'Otimização Dinâmica de Equipamentos', d: 'Ajuste automático das configurações do equipamento baseado em eficiência energética e melhor ROI da clínica.' },
    { t: 'Análise Preditiva de Churn e Recompra', d: 'Prevê o abandono de leads ou churn e sugere ações de retenção a partir da análise da base histórica.' }
  ];

  const weaknesses = [
    { t: 'Complexidade Operacional (Curva de Aprendizado)', d: 'A Clinicorp possui uma interface datada e dificuldade de curva de aprendizado elevada.' },
    { t: 'Lentidão em Back-office', d: 'O Clinicorp sofre de lentidão operacional para processar muitos dados simultaneamente.' },
    { t: 'Suporte Técnico Reativo', d: 'Demora média de 24h nas chamadas abertas via tickets. One Nexus tem WhatsApp < 15 min.' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-10 animate-in zoom-in-95 duration-500 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Competitor Intelligence: Clinicorp
          </h2>
          <span className="px-4 py-1.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest">
            Ameaça: Moderada
          </span>
        </div>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Nossos Diferenciais */}
          <div className={`p-8 rounded-3xl border ${isDark ? 'bg-green-500/5 border-green-500/10' : 'bg-green-50 border-green-200'}`}>
            <h3 className="text-green-500 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <Zap size={16}/> Nossos Diferenciais
            </h3>
            <ul className="space-y-4">
              {differentials.map((f, i) => (
                <li key={i}>
                  <p className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>{f.t}</p>
                  <p className="text-xs text-zinc-500 mt-1">{f.d}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Fraquezas da Clinicorp */}
          <div className={`p-8 rounded-3xl border ${isDark ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-200'}`}>
            <h3 className="text-red-500 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <ShieldAlert size={16}/> Fraquezas da Clinicorp
            </h3>
            <ul className="space-y-4">
              {weaknesses.map((f, i) => (
                <li key={i}>
                  <p className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>{f.t}</p>
                  <p className="text-xs text-zinc-500 mt-1">{f.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Kill Shots */}
        <div className={`p-8 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'} space-y-6`}>
          <h3 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            Como Desarmar (Kill Shots)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pergunta de Reflexão */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-orange-500/5 border-orange-500/10' : 'bg-orange-50 border-orange-200'}`}>
              <h4 className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-3">
                Pergunta de Reflexão
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                "Se o Clinicorp já atende suas necessidades, por que você pediu orçamento conosco? Existe algo que eles não estão conseguindo resolver?"
              </p>
            </div>

            {/* Ponto de Dor Específico */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50 border-indigo-200'}`}>
              <h4 className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-3">
                Ponto de Dor Específico
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                "Você já perdeu algum negócio por causa de lentidão do sistema? Se eu te mostrasse que somos 3x mais rápidos, isso faria diferença?"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
