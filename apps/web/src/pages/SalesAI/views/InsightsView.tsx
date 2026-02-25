/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🧠 INSIGHTS VIEW - Análise DISC e Score IA
 * ══════════════════════════════════════════════════════════════════════════
 */

import { Sparkles, Brain, Award, Briefcase, TrendingUp } from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface InsightsViewProps {
  leadContext: LeadContext | null;
}

export function InsightsView({ leadContext }: InsightsViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Selecione um lead para ver insights</p>
      </div>
    );
  }

  const score = leadContext.leadScore || 88;
  const disc = leadContext.disc || 'INFLUENTE';

  return (
    <div className="flex-1 overflow-y-auto p-10 space-y-10 animate-in fade-in duration-500 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lead Score IA Card */}
        <div className={`p-8 rounded-3xl border ${isDark ? 'bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700' : 'bg-white border-zinc-200 shadow-xl shadow-black/5'}`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Lead Intelligence Score</h3>
              <p className="text-xs text-zinc-500">Probabilidade preditiva de conversão.</p>
            </div>
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
              <Sparkles size={28} />
            </div>
          </div>
          <div className="flex items-center gap-10 mb-8">
            {/* Circular Progress */}
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364.4}
                  strokeDashoffset={364.4 - (364.4 * score / 100)}
                  strokeLinecap="round"
                  className="text-orange-500 transition-all duration-1000"
                />
              </svg>
              <span className={`absolute text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{score}%</span>
            </div>
            {/* Metrics */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Urgência</span>
                <span className="text-green-500 font-black">ALTA</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Fit ICP</span>
                <span className="text-indigo-500 font-black">EXCELENTE</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Sentimento</span>
                <span className="text-yellow-500 font-black whitespace-nowrap">NEUTRO-POSITIVO</span>
              </div>
            </div>
          </div>
        </div>

        {/* DISC Profile Card */}
        <div className={`p-8 rounded-3xl border ${isDark ? 'bg-gradient-to-br from-indigo-900/20 to-zinc-900 border-indigo-500/20' : 'bg-white border-zinc-200 shadow-xl shadow-black/5'}`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Perfil Comportamental (DISC)</h3>
              <p className="text-xs text-zinc-500">Análise baseada em interações anteriores.</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
              <Brain size={28} />
            </div>
          </div>
          <div className="flex gap-4 mb-6">
            <span className="px-4 py-1.5 rounded-full text-xs font-black bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 tracking-widest uppercase">{disc}</span>
            <span className="px-4 py-1.5 rounded-full text-xs font-bold border border-zinc-800 text-zinc-500 bg-zinc-900/50">EXTROVERTIDA</span>
          </div>
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-800/40' : 'bg-zinc-50'}`}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2">Como Abordar</h4>
              <p className="text-xs text-zinc-400 leading-relaxed italic">"Focar em resultados e reconhecimento social. Demonstre como a solução vai destacá-los no mercado e trazer prestígio profissional."</p>
            </div>
            <div className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-800/40' : 'bg-zinc-50'}`}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Tom Recomendado</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">Profissional, assertivo, focado em ROI e autoridade técnica. Demonstre cases de sucesso sem enrolação.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className={`p-6 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Award size={14} className="text-yellow-500" /> Gatilhos Emocionais
          </h4>
          <ul className="space-y-3">
            {['Reconhecimento', 'Modernidade', 'Exclusividade'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className={`p-6 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Briefcase size={14} className="text-blue-500" /> Dores Prováveis
          </h4>
          <ul className="space-y-3">
            {['Gestão manual', 'Inadimplência alta', 'Equipe desmotivada'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className={`p-6 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-green-500" /> ROI Estimado
          </h4>
          <div className="text-center">
            <span className="text-2xl font-black text-green-500">24%</span>
            <p className="text-[10px] text-zinc-500 mt-1">Crescimento projetado em 6 meses com automação.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
