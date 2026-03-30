/**
 * ══════════════════════════════════════════════════════════════════════════
 * 📊 METRICS SIDEBAR - Barra lateral com métricas IA
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Sparkles,
  Lightbulb,
  Calendar as CalendarIcon,
  Thermometer,
  Zap,
  Brain,
} from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

export type AIProvider = 'groq' | 'gemini' | 'openai';

interface AIModel {
  provider: AIProvider;
  name: string;
  model: string;
  gradient: string;
  icon: typeof Zap;
}

const AI_MODELS: AIModel[] = [
  {
    provider: 'groq',
    name: 'Groq',
    model: 'LLaMA 3.3 70B',
    gradient: 'from-yellow-600 to-orange-700',
    icon: Zap,
  },
  {
    provider: 'gemini',
    name: 'Gemini',
    model: 'Gemini 2.0 Flash',
    gradient: 'from-indigo-600 to-purple-700',
    icon: Brain,
  },
  {
    provider: 'openai',
    name: 'OpenAI',
    model: 'GPT-4o',
    gradient: 'from-purple-600 to-pink-700',
    icon: Sparkles,
  },
];

const STAGE_ACTIONS: Record<string, string> = {
  PROSPECCAO: 'Agendar call de discovery com o lead',
  QUALIFICACAO: 'Fazer SPIN Questions e validar budget',
  APRESENTACAO: 'Agendar demo personalizada do produto',
  NEGOCIACAO: 'Negociar condições e responder objeções',
  FECHAMENTO: 'Agendar assinatura de contrato',
  POS_VENDA: 'Check-in de 30 dias com o cliente',
};

interface MetricsSidebarProps {
  leadContext: LeadContext | null;
  provider?: AIProvider;
  onProviderChange?: (provider: AIProvider) => void;
  className?: string;
}

export function MetricsSidebar({ leadContext, provider = 'groq', onProviderChange, className }: MetricsSidebarProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  if (!leadContext) {
    return null;
  }

  const selectedModel = AI_MODELS.find(m => m.provider === provider) || AI_MODELS[0];
  const ModelIcon = selectedModel.icon;

  // Render card helper
  const renderMetricCard = (title: string, value: string, icon: any, colorClasses: string) => (
    <div className={clsx('p-4 rounded-2xl border', isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm')}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</span>
        <div className={clsx('p-1.5 rounded-lg', colorClasses)}>{icon}</div>
      </div>
      <p className={clsx('text-lg font-black', isDark ? 'text-white' : 'text-zinc-900')}>{value}</p>
    </div>
  );

  return (
    <aside className={clsx('w-80 border-l p-6 overflow-y-auto space-y-6 hidden xl:flex xl:flex-col transition-all', isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200', className)}>
      {/* Header */}
      <h3 className={clsx('text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
        <TrendingUp size={16} className="text-orange-500" /> Métricas IA do Lead
      </h3>

      {/* Metric Cards */}
      <div className="space-y-4">
        {(() => {
          const s = leadContext.leadScore ?? 0;
          const temp = s >= 80 ? { label: 'QUENTE', color: 'text-green-500 bg-green-500/10' }
            : s >= 50 ? { label: 'MORNO', color: 'text-yellow-500 bg-yellow-500/10' }
            : { label: 'FRIO', color: 'text-red-500 bg-red-500/10' };
          return renderMetricCard(
            "Temperatura",
            leadContext.leadScore != null ? temp.label : '---',
            <Thermometer size={18} />,
            temp.color
          );
        })()}
        {renderMetricCard(
          "Plano",
          leadContext.plan || 'Não definido',
          <DollarSign size={18} />,
          "text-indigo-500 bg-indigo-500/10"
        )}
        {renderMetricCard(
          "Lead Score IA",
          leadContext.leadScore != null ? `${(leadContext.leadScore / 10).toFixed(1)} / 10` : '---',
          <Sparkles size={18} />,
          "text-yellow-500 bg-yellow-500/10"
        )}
      </div>

      {/* Próxima Ação Sugerida */}
      <div className={clsx('p-5 rounded-2xl border space-y-4', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Lightbulb size={14} className="text-yellow-500" /> Próxima Ação Sugerida
        </h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          "{STAGE_ACTIONS[leadContext.stage] || 'Qualificar o lead e identificar necessidades'}"
        </p>
        <button
          onClick={() => {
            const eventTitle = `Nexus Reunião: ${leadContext.name} (${leadContext.company || 'Cliente'})`;
            const googleUrl = `https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(eventTitle)}&details=${encodeURIComponent('Agendamento via Nexus Sales AI Copilot')}`;
            window.open(googleUrl, '_blank');
          }}
          className="w-full py-2 bg-orange-500/10 text-orange-500 rounded-xl text-[10px] font-bold hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
        >
          <CalendarIcon size={12} /> Agendar Agora
        </button>
      </div>

      {/* Histórico de Sugestões */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Histórico de Sugestões</h4>
        <div className={clsx('p-4 rounded-xl border text-center', isDark ? 'bg-zinc-950/30 border-zinc-800' : 'bg-zinc-100/50 border-zinc-100')}>
          <p className="text-[10px] text-zinc-600">Interaja com o chat para gerar histórico de sugestões.</p>
        </div>
      </div>

      {/* Status do Motor IA - Seletor Interativo */}
      <div className="pt-10 relative">
        <button
          onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
          className={clsx('w-full p-4 rounded-2xl bg-gradient-to-br text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95', selectedModel.gradient)}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Status do Motor IA</p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <ModelIcon size={16} />
              <div className="text-left">
                <p className="text-xs font-bold">{selectedModel.name}</p>
                <p className="text-[9px] opacity-70">{selectedModel.model}</p>
              </div>
            </div>
            <div className="flex gap-0.5">
              {[1,2,3].map(i => (
                <div
                  key={i}
                  className="w-1 h-3 bg-white rounded-full opacity-40 animate-pulse"
                  style={{ animationDelay: `${i*0.2}s` }}
                />
              ))}
            </div>
          </div>
        </button>

        {/* Dropdown Menu */}
        {isModelMenuOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsModelMenuOpen(false)} />

            {/* Menu */}
            <div className={clsx('absolute bottom-full mb-2 left-0 right-0 rounded-2xl border shadow-2xl z-50 overflow-hidden', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
              <div className={clsx('p-2 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2">
                  Selecionar Motor de IA
                </p>
              </div>

              <div className="p-2 space-y-1">
                {AI_MODELS.map((model) => {
                  const Icon = model.icon;
                  const isSelected = model.provider === provider;

                  return (
                    <button
                      key={model.provider}
                      onClick={() => {
                        onProviderChange?.(model.provider);
                        setIsModelMenuOpen(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left',
                        isSelected
                          ? 'bg-orange-500 text-white'
                          : isDark
                          ? 'hover:bg-zinc-800 text-zinc-300'
                          : 'hover:bg-zinc-100 text-zinc-700'
                      )}
                    >
                      <Icon size={18} className={isSelected ? 'text-white' : 'text-orange-500'} />
                      <div className="flex-1">
                        <div className="font-bold text-xs">{model.name}</div>
                        <div
                          className={clsx(
                            'text-[10px]',
                            isSelected
                              ? 'text-orange-100'
                              : isDark
                              ? 'text-zinc-500'
                              : 'text-zinc-400'
                          )}
                        >
                          {model.model}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} className="text-white" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div
                className={clsx(
                  'p-3 border-t text-[10px] text-zinc-500',
                  isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'
                )}
              >
                <p className="flex items-center gap-1">
                  <Sparkles size={10} className="text-orange-500" />
                  <span>Clique para alternar entre os motores disponíveis</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
