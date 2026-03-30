/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🧠 SALES AI - Componente Principal
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Interface completa do Nexus Sales AI com:
 * - Chat com copiloto de vendas
 * - Análise DISC de personalidade
 * - Briefing para calls
 * - Battlecards competitivas
 * - Roleplay de treinamento
 * - Gerador de conteúdo
 */

import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  MessageSquare,
  Brain,
  FileText,
  Swords,
  Users,
  Sparkles,
  Settings,
  Zap,
  X,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import type { LeadContext, LeadStage } from '@/hooks/useSalesAI';
import { useLeads } from '@/features/leads/hooks/useLeads';
import type { Lead } from '@/features/leads/types';
import { LeadStatus, ProductType } from '@/features/leads/types';
import { LeadSelector } from './components/LeadSelector';
import { MetricsSidebar, type AIProvider } from './components/MetricsSidebar';
import { useUIStore } from '@/stores/useUIStore';

// Views (vão ser importadas quando criadas)
import { ChatView } from './views/ChatView';
import { InsightsView } from './views/InsightsView';
import { BriefingView } from './views/BriefingView';
import { BattlecardView } from './views/BattlecardView';
import { RoleplayView } from './views/RoleplayView';
import { GeneratorView } from './views/GeneratorView';

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════

type TabId = 'chat' | 'insights' | 'briefing' | 'battlecard' | 'roleplay' | 'generator';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof MessageSquare;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    description: 'Converse com o copiloto de vendas',
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: Brain,
    description: 'Análise DISC de personalidade',
  },
  {
    id: 'briefing',
    label: 'Briefing',
    icon: FileText,
    description: 'Preparação para call de vendas',
  },
  {
    id: 'battlecard',
    label: 'Battlecard',
    icon: Swords,
    description: 'Inteligência competitiva',
  },
  {
    id: 'roleplay',
    label: 'Roleplay',
    icon: Users,
    description: 'Simulador de vendas',
  },
  {
    id: 'generator',
    label: 'Generator',
    icon: Sparkles,
    description: 'Gerador de conteúdo',
  },
];

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

function mapStageNameToLeadStage(stageName?: string): LeadStage {
  if (!stageName) return 'QUALIFICACAO';
  const s = stageName.toUpperCase();
  if (s.includes('PROSPEC') || s.includes('NOVO') || s.includes('ABERTO')) return 'PROSPECCAO';
  if (s.includes('QUALIFIC') || s.includes('CONTATO') || s.includes('TENTATIVA')) return 'QUALIFICACAO';
  if (s.includes('APRES') || s.includes('PROPOSTA') || s.includes('DEMO')) return 'APRESENTACAO';
  if (s.includes('NEGOC')) return 'NEGOCIACAO';
  if (s.includes('FECHA') || s.includes('CLOSING')) return 'FECHAMENTO';
  if (s.includes('POS') || s.includes('POST')) return 'POS_VENDA';
  return 'QUALIFICACAO';
}

function getLastContactLabel(updatedAt: string): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoje';
  if (days === 1) return '1 dia atrás';
  return `${days} dias atrás`;
}

function mapLeadToContext(lead: Lead): LeadContext {
  return {
    id: lead.id,
    name: lead.name,
    company: lead.companyName,
    email: lead.email,
    phone: lead.phone,
    leadScore: lead.score,
    stage: mapStageNameToLeadStage(lead.stage?.name),
    product: lead.interestProduct === ProductType.LOCADORAS ? 'NEXLOC' : 'ONE_NEXUS',
    plan: lead.interestPlan?.name,
    notes: lead.notes ?? undefined,
    lastContact: getLastContactLabel(lead.updatedAt),
    aiScoreFactors: lead.aiScoreFactors,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════

export default function SalesAI() {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [selectedLead, setSelectedLead] = useState<LeadContext | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('groq');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);

  // Fetch real leads from backend
  const { data: rawLeads = [], isLoading: leadsLoading } = useLeads();

  // Map active leads (exclude converted/lost) to LeadContext
  const leadContexts = useMemo<LeadContext[]>(() => {
    return rawLeads
      .filter((l) => l.status !== LeadStatus.GANHO && l.status !== LeadStatus.PERDIDO)
      .map(mapLeadToContext);
  }, [rawLeads]);

  // Auto-select first lead when data loads
  useEffect(() => {
    if (leadContexts.length > 0 && !selectedLead) {
      setSelectedLead(leadContexts[0]);
    }
  }, [leadContexts, selectedLead]);

  const renderActiveView = () => {
    const props = { leadContext: selectedLead, provider: selectedProvider };

    switch (activeTab) {
      case 'chat':
        return <ChatView {...props} />;
      case 'insights':
        return <InsightsView {...props} />;
      case 'briefing':
        return <BriefingView {...props} onSwitchToChat={() => setActiveTab('chat')} />;
      case 'battlecard':
        return <BattlecardView {...props} />;
      case 'roleplay':
        return <RoleplayView {...props} />;
      case 'generator':
        return <GeneratorView {...props} />;
      default:
        return null;
    }
  };

  return (
    <>
    <div className="absolute inset-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0 flex flex-col animate-in fade-in duration-500 overflow-hidden z-0">
      {/* Sales AI Header Bar */}
      <div className={clsx('h-auto md:h-16 border-b flex flex-col md:flex-row items-start md:items-center justify-between px-3 md:px-8 py-3 md:py-0 gap-3 md:gap-0 z-20', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm')}>
        <div className="flex items-center gap-4">
          <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className={clsx('text-base md:text-lg font-black', isDark ? 'text-white' : 'text-zinc-900')}>
              Nexus Sales AI
            </h1>
            <p className="hidden md:block text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap size={10} className="text-yellow-500" /> Copiloto Inteligente de Vendas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Lead Selector */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs font-bold text-zinc-500">Contexto:</span>
            <LeadSelector
              leads={leadContexts}
              selectedLead={selectedLead}
              onSelectLead={setSelectedLead}
            />
          </div>
          <div className={clsx('hidden md:block h-8 w-[1px]', isDark ? 'bg-zinc-800' : 'bg-zinc-200')}></div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={clsx('p-2 rounded-xl transition-all', isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900')}
            title="Configurações"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area: Chat or Dashboard */}
        <main className="flex-1 flex flex-col relative min-h-0">

          {/* Mobile: Custom dropdown tab selector */}
          <div className={clsx('px-3 py-3 border-b md:hidden relative', isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100')}>
            {(() => {
              const activeItem = TABS.find(t => t.id === activeTab) || TABS[0];
              const ActiveTabIcon = activeItem.icon;
              return (
                <>
                  <button
                    onClick={() => setTabDropdownOpen(!tabDropdownOpen)}
                    className={clsx(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all',
                      isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800 shadow-sm'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ActiveTabIcon size={16} className="text-orange-500" />
                      {activeItem.label}
                    </span>
                    <ChevronDown size={16} className={clsx('transition-transform', tabDropdownOpen && 'rotate-180', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                  </button>
                  {tabDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setTabDropdownOpen(false)} />
                      <div className={clsx(
                        'absolute left-3 right-3 top-[calc(100%-4px)] z-20 rounded-xl border shadow-xl overflow-hidden',
                        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
                      )}>
                        {TABS.map((tab) => {
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => { setActiveTab(tab.id); setTabDropdownOpen(false); }}
                              className={clsx(
                                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                                activeTab === tab.id
                                  ? 'text-orange-500 bg-orange-500/5'
                                  : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-50'
                              )}
                            >
                              <Icon size={16} />
                              <div className="text-left">
                                <span>{tab.label}</span>
                                <span className={clsx('block text-[11px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{tab.description}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Desktop: Tab buttons */}
          <div className={clsx('px-8 py-4 border-b hidden md:flex items-center gap-2 overflow-x-auto no-scrollbar', isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100')}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : isDark
                        ? 'bg-zinc-900 text-zinc-500 hover:text-white'
                        : 'bg-white border border-zinc-200 text-zinc-500 hover:text-orange-500 shadow-sm'
                  )}
                  title={tab.description}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden relative flex flex-col">
            {selectedLead ? (
              renderActiveView()
            ) : leadsLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Carregando leads...</span>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Brain size={64} className={clsx('mx-auto mb-4', isDark ? 'text-zinc-700' : 'text-gray-300')} />
                  <h3 className={clsx('mb-2 text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    {leadContexts.length === 0 ? 'Nenhum lead ativo' : 'Selecione um lead'}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {leadContexts.length === 0
                      ? 'Adicione leads no módulo de CRM para usar o Sales AI'
                      : 'Escolha um lead para começar a usar o Sales AI'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Insights Sidebar */}
        <MetricsSidebar
          leadContext={selectedLead}
          provider={selectedProvider}
          onProviderChange={setSelectedProvider}
        />
      </div>

    </div>

    {/* ── Settings Modal — renderizado FORA do z-0 para escapar stacking context ── */}
    {isSettingsOpen && (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsSettingsOpen(false)}
        />

        {/* Panel */}
        <div className={clsx(
          'fixed right-0 top-0 h-full w-full md:w-[400px] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300',
          isDark ? 'bg-zinc-900 border-l border-zinc-800' : 'bg-white border-l border-zinc-200'
        )}>
          {/* Header */}
          <div className={clsx('flex items-center justify-between px-4 py-4 md:px-6 md:py-5 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-xl">
                <Settings size={18} className="text-orange-500" />
              </div>
              <div>
                <h2 className={clsx('font-black text-sm', isDark ? 'text-white' : 'text-zinc-900')}>Configurações</h2>
                <p className="text-[10px] text-zinc-500">Nexus Sales AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className={clsx('p-2 rounded-xl transition-all', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">

            {/* Motor de IA */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Motor de IA</h3>
              <div className="space-y-2">
                {(
                  [
                    { provider: 'groq' as AIProvider, name: 'Groq', model: 'LLaMA 3.3 70B', desc: 'Ultra-rápido, ideal para chat em tempo real', color: 'from-yellow-500 to-orange-600' },
                    { provider: 'gemini' as AIProvider, name: 'Gemini', model: 'Gemini 2.0 Flash', desc: 'Google AI, excelente para análise e contexto longo', color: 'from-indigo-500 to-purple-600' },
                    { provider: 'openai' as AIProvider, name: 'OpenAI', model: 'GPT-4o', desc: 'Alta precisão, melhor para geração de conteúdo', color: 'from-purple-500 to-pink-600' },
                  ] as const
                ).map(({ provider, name, model, desc, color }) => {
                  const isSelected = selectedProvider === provider;
                  return (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className={clsx(
                        'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left',
                        isSelected
                          ? 'border-orange-500 bg-orange-500/5'
                          : isDark
                            ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-800/30'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      )}
                    >
                      <div className={clsx('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-black text-xs shrink-0', color)}>
                        {name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={clsx('font-bold text-sm', isDark ? 'text-white' : 'text-zinc-900')}>{name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">{model}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{desc}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={18} className="text-orange-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Sobre */}
            <section className={clsx('p-4 rounded-2xl border', isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Versão</p>
              <p className="text-xs text-zinc-400">Nexus Sales AI <span className="text-orange-500 font-bold">v1.0</span></p>
              <p className="text-[10px] text-zinc-600 mt-1">Modelos e configurações aplicados imediatamente em todas as views.</p>
            </section>
          </div>

          {/* Footer */}
          <div className={clsx('px-4 py-3 md:px-6 md:py-4 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-orange-500/20"
            >
              Salvar e Fechar
            </button>
          </div>
        </div>
      </>
    )}
    </>
  );
}
