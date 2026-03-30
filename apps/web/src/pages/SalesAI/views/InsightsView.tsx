/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🧠 INSIGHTS VIEW - Análise DISC e Score IA
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Sparkles, Brain, Award, Briefcase, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import type { LeadContext, DISCAnalysis } from '@/hooks/useSalesAI';
import { useAnalyzeDISC } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface InsightsViewProps {
  leadContext: LeadContext | null;
}

// ── Helpers para derivar métricas do score ──

function getUrgency(score: number) {
  if (score >= 80) return { label: 'ALTA', color: 'text-red-500' };
  if (score >= 50) return { label: 'MÉDIA', color: 'text-yellow-500' };
  return { label: 'BAIXA', color: 'text-zinc-500' };
}

function getTemperature(score: number) {
  if (score >= 80) return { label: 'QUENTE', color: 'text-green-500' };
  if (score >= 50) return { label: 'MORNO', color: 'text-yellow-500' };
  return { label: 'FRIO', color: 'text-red-500' };
}

function getFitICP(factors?: LeadContext['aiScoreFactors']) {
  if (!factors) return { label: '---', color: 'text-zinc-500' };
  const fitScore = factors.planValue + factors.originQuality;
  if (fitScore >= 20) return { label: 'EXCELENTE', color: 'text-green-500' };
  if (fitScore >= 12) return { label: 'BOM', color: 'text-indigo-500' };
  return { label: 'MÉDIO', color: 'text-yellow-500' };
}

const STAGE_LABELS: Record<string, string> = {
  PROSPECCAO: 'Prospecção',
  QUALIFICACAO: 'Qualificação',
  APRESENTACAO: 'Apresentação',
  NEGOCIACAO: 'Negociação',
  FECHAMENTO: 'Fechamento',
  POS_VENDA: 'Pós-Venda',
};

export function InsightsView({ leadContext }: InsightsViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [discAnalysis, setDiscAnalysis] = useState<DISCAnalysis | null>(null);
  const [discError, setDiscError] = useState<string | null>(null);
  const analyzeDISC = useAnalyzeDISC();

  // Reset DISC analysis when lead changes
  useEffect(() => {
    setDiscAnalysis(null);
    setDiscError(null);
  }, [leadContext?.id]);

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Selecione um lead para ver insights</p>
      </div>
    );
  }

  const score = leadContext.leadScore ?? 0;
  const scoreDisplay = (score / 10).toFixed(1);
  const urgency = getUrgency(score);
  const fitIcp = getFitICP(leadContext.aiScoreFactors);
  const temperature = getTemperature(score);

  const discProfile = discAnalysis?.profile || leadContext.disc;

  const handleAnalyzeDISC = () => {
    setDiscError(null);
    analyzeDISC.mutate(leadContext, {
      onSuccess: (data) => {
        setDiscAnalysis(data.analysis);
      },
      onError: () => {
        setDiscError('Falha ao gerar análise. Verifique se a chave de IA está configurada.');
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 animate-in fade-in duration-500 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {/* Lead Score IA Card */}
        <div className={`p-4 md:p-8 rounded-2xl md:rounded-3xl border ${isDark ? 'bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700' : 'bg-white border-zinc-200 shadow-xl shadow-black/5'}`}>
          <div className="flex justify-between items-start mb-4 md:mb-6">
            <div>
              <h3 className={`text-base md:text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Lead Intelligence Score</h3>
              <p className="text-xs text-zinc-500">Score de qualificação do lead (0-10).</p>
            </div>
            <div className="p-2.5 md:p-3 bg-orange-500/10 text-orange-500 rounded-xl md:rounded-2xl">
              <Sparkles size={20} className="md:w-7 md:h-7" />
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-10 mb-6 md:mb-8">
            {/* Circular Progress */}
            <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center shrink-0">
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
              <div className="absolute flex flex-col items-center">
                <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{scoreDisplay}</span>
                <span className="text-[9px] text-zinc-500 font-bold">/ 10</span>
              </div>
            </div>
            {/* Metrics */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Urgência</span>
                <span className={`${urgency.color} font-black`}>{urgency.label}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Fit ICP</span>
                <span className={`${fitIcp.color} font-black`}>{fitIcp.label}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Temperatura</span>
                <span className={`${temperature.color} font-black whitespace-nowrap`}>{temperature.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DISC Profile Card */}
        <div className={`p-4 md:p-8 rounded-2xl md:rounded-3xl border ${isDark ? 'bg-gradient-to-br from-indigo-900/20 to-zinc-900 border-indigo-500/20' : 'bg-white border-zinc-200 shadow-xl shadow-black/5'}`}>
          <div className="flex justify-between items-start mb-4 md:mb-6">
            <div>
              <h3 className={`text-base md:text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Perfil Comportamental (DISC)</h3>
              <p className="text-xs text-zinc-500">
                {discAnalysis ? 'Análise gerada por IA.' : 'Gere uma análise para este lead.'}
              </p>
            </div>
            <div className="p-2.5 md:p-3 bg-indigo-500/10 text-indigo-500 rounded-xl md:rounded-2xl">
              <Brain size={20} className="md:w-7 md:h-7" />
            </div>
          </div>

          {discAnalysis ? (
            <>
              <div className="flex gap-4 mb-6">
                <span className="px-4 py-1.5 rounded-full text-xs font-black bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 tracking-widest uppercase">{discAnalysis.profile}</span>
              </div>
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-800/40' : 'bg-zinc-50'}`}>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2">Como Abordar</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed italic">"{discAnalysis.salesApproach.communication}"</p>
                </div>
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-800/40' : 'bg-zinc-50'}`}>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Tom Recomendado</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{discAnalysis.salesApproach.presentation}</p>
                </div>
              </div>
            </>
          ) : discProfile ? (
            <>
              <div className="flex gap-4 mb-6">
                <span className="px-4 py-1.5 rounded-full text-xs font-black bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 tracking-widest uppercase">{discProfile}</span>
              </div>
              <div className="text-center py-4">
                <p className="text-xs text-zinc-500 mb-4">Perfil identificado. Gere a análise completa para ver recomendações de abordagem.</p>
                <button
                  onClick={handleAnalyzeDISC}
                  disabled={analyzeDISC.isPending}
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {analyzeDISC.isPending ? <><Loader2 size={14} className="animate-spin" /> Analisando...</> : 'Gerar Análise Completa'}
                </button>
                {discError && (
                  <p className="text-[10px] text-red-400 mt-3 flex items-center gap-1 justify-center"><AlertCircle size={10} /> {discError}</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <Brain size={40} className="mx-auto mb-4 text-zinc-700" />
              <p className="text-xs text-zinc-500 mb-4">Gere uma análise DISC baseada nos dados do lead para obter recomendações de abordagem.</p>
              <button
                onClick={handleAnalyzeDISC}
                disabled={analyzeDISC.isPending}
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {analyzeDISC.isPending ? <><Loader2 size={14} className="animate-spin" /> Analisando...</> : 'Gerar Análise DISC'}
              </button>
              {discError && (
                <p className="text-[10px] text-red-400 mt-3 flex items-center gap-1 justify-center"><AlertCircle size={10} /> {discError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Award size={14} className="text-yellow-500" /> Gatilhos Emocionais
          </h4>
          {discAnalysis && discAnalysis.triggers.length > 0 ? (
            <ul className="space-y-3">
              {discAnalysis.triggers.map((t) => (
                <li key={t} className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-zinc-600">Gere a análise DISC para ver gatilhos emocionais.</p>
          )}
        </div>

        <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <Briefcase size={14} className="text-blue-500" /> Dores Prováveis
          </h4>
          {discAnalysis && discAnalysis.traits.fears.length > 0 ? (
            <ul className="space-y-3">
              {discAnalysis.traits.fears.map((t) => (
                <li key={t} className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-zinc-600">Gere a análise DISC para ver dores prováveis.</p>
          )}
        </div>

        <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-green-500" /> Progresso no Funil
          </h4>
          <div className="text-center">
            <span className="text-2xl font-black text-green-500">
              {leadContext.aiScoreFactors
                ? `${Math.round((leadContext.aiScoreFactors.stageProgress / 60) * 100)}%`
                : '---'}
            </span>
            <p className="text-[10px] text-zinc-500 mt-1">
              Etapa atual: {STAGE_LABELS[leadContext.stage] || leadContext.stage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
