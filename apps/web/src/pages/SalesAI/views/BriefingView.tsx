/**
 * ══════════════════════════════════════════════════════════════════════════
 * 📋 BRIEFING VIEW - Preparação para call de vendas
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useMemo } from 'react';
import { Target, Download, Check, ShieldAlert } from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface BriefingViewProps {
  leadContext: LeadContext | null;
  onSwitchToChat?: () => void;
}

export function BriefingView({ leadContext, onSwitchToChat }: BriefingViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Valores derivados do leadContext — estáveis por lead, sem Math.random() no render
  const seedFromId = useMemo(() => {
    const n = leadContext?.id
      ? leadContext.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : 42;
    return n;
  }, [leadContext?.id]);

  const yearsActive  = useMemo(() => (seedFromId % 10) + 3, [seedFromId]);
  const patientsPerMonth = useMemo(() => ((seedFromId % 5) + 2) * 100, [seedFromId]);

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Selecione um lead para gerar briefing</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 animate-in slide-in-from-right-10 duration-500 custom-scrollbar">
      <div className={`max-w-4xl mx-auto p-4 md:p-10 rounded-2xl md:rounded-3xl border shadow-2xl ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-black/10'}`}>
        {/* Header */}
        <div className="flex justify-between items-start md:items-center mb-6 md:mb-10 pb-4 md:pb-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-orange-500 text-white rounded-xl md:rounded-2xl shadow-lg shadow-orange-500/20">
              <Target size={24} className="md:w-8 md:h-8" />
            </div>
            <div>
              <h2 className={`text-lg md:text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Pre-Call Briefing</h2>
              <p className="text-xs md:text-sm text-zinc-500">Preparado para {leadContext.name} às {new Date().getHours()}:00</p>
            </div>
          </div>
          <button className="p-2 md:p-3 rounded-xl hover:bg-zinc-800 text-zinc-500 transition-all border border-zinc-800">
            <Download size={18} className="md:w-5 md:h-5" />
          </button>
        </div>

        <div className="space-y-6 md:space-y-10">
          {/* Objetivo e Contexto */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500">Objetivo Sugerido</h4>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>
                Qualificar a clínica operacional para o aumento de lucratividade via otimização de recebíveis e identificar abertura para apresentação avançada.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Contexto em 3 Pontos</h4>
              <ul className="space-y-2">
                {[
                  `${leadContext.company || 'Clínica'} opera há ${yearsActive} anos, atende em média ${patientsPerMonth} pacientes/mês.`,
                  `Tem histórico de interesse em automação de gestão de unidades múltiplas.`,
                  `Verificando logs do tenant para análise de uso prioritário.`
                ].map((p, i) => (
                  <li key={i} className="text-xs text-zinc-500 flex items-center gap-2">
                    <Check size={12} className="text-indigo-400"/> {p}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Perguntas Poderosas */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
              3 Perguntas Poderosas (Discovery)
            </h4>
            <div className="grid gap-4">
              {[
                `Considerando o seu volume atual de ${leadContext.company || 'sua clínica'}, qual é o impacto financeiro de um erro de faturamento hoje?`,
                "Se você pudesse investir o tempo que gasta em burocracia em marketing/expansão, quanto a clínica cresceria?",
                "Hoje, qual é o maior obstáculo para você abrir uma segunda unidade da clínica?"
              ].map((q, i) => (
                <div key={i} className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-800/20 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600'} text-xs italic leading-relaxed`}>
                  "{q}"
                </div>
              ))}
            </div>
          </section>

          {/* Alertas de Risco */}
          <section className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
              <ShieldAlert size={14} /> Alertas de Risco
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed italic">
              "Cuidado ao falar de preços logo no início. {leadContext.name} demonstrou ser sensível a custos se não vir valor claro em exclusividade primeiro."
            </p>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-8 md:mt-12 flex justify-center">
          <button
            onClick={onSwitchToChat}
            className="px-8 py-3 bg-orange-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-orange-500/20 transition-all active:scale-95"
          >
            Iniciar Chat com Briefing
          </button>
        </div>
      </div>
    </div>
  );
}
