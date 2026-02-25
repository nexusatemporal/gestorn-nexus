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

import { useState } from 'react';
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
} from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
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

// Mock leads - TODO: Buscar do backend
const MOCK_LEADS: LeadContext[] = [
  {
    id: '1',
    name: 'Dr. Carlos Silva',
    company: 'Clínica Estética Silva',
    email: 'carlos@clinicasilva.com.br',
    phone: '(11) 98765-4321',
    disc: 'DOMINANTE',
    leadScore: 85,
    stage: 'NEGOCIACAO',
    product: 'ONE_NEXUS',
    plan: 'Pro',
    pains: ['Gestão de agendamentos manual', 'Perda de receita por faltas'],
    interests: ['Automação', 'Integração WhatsApp'],
    budget: 'R$ 500-1000/mês',
    timeline: '30 dias',
    companySize: '5-10 funcionários',
    industry: 'Estética',
    lastContact: '2 dias atrás',
    interactions: 12,
    notes: 'Muito interessado, aguardando aprovação do sócio',
  },
  {
    id: '2',
    name: 'Dra. Maria Santos',
    company: 'Clínica Renova',
    disc: 'INFLUENTE',
    leadScore: 65,
    stage: 'QUALIFICACAO',
    product: 'ONE_NEXUS',
    pains: ['Falta de controle financeiro', 'Relatórios manuais'],
    interests: ['Dashboard', 'Relatórios'],
    companySize: '3-5 funcionários',
    interactions: 5,
  },
  {
    id: '3',
    name: 'João Pereira',
    company: 'Locadora Premium',
    disc: 'CONSCIENTE',
    leadScore: 45,
    stage: 'PROSPECCAO',
    product: 'NEXLOC',
    pains: ['Controle de estoque manual'],
    companySize: '10-20 funcionários',
    interactions: 2,
  },
];

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════

export default function SalesAI() {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [selectedLead, setSelectedLead] = useState<LeadContext | null>(
    MOCK_LEADS[0]
  );
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('groq');

  const renderActiveView = () => {
    const props = { leadContext: selectedLead, provider: selectedProvider };

    switch (activeTab) {
      case 'chat':
        return <ChatView {...props} />;
      case 'insights':
        return <InsightsView {...props} />;
      case 'briefing':
        return <BriefingView {...props} />;
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
    <div className="h-full flex flex-col animate-in fade-in duration-500 -mt-8 -mx-8 overflow-hidden">
      {/* Sales AI Header Bar */}
      <div className={clsx('h-16 border-b flex items-center justify-between px-8 z-20', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm')}>
        <div className="flex items-center gap-4">
          <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className={clsx('text-lg font-black', isDark ? 'text-white' : 'text-zinc-900')}>
              Nexus Sales AI
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap size={10} className="text-yellow-500" /> Copiloto Inteligente de Vendas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Lead Selector */}
          <div className={clsx('flex items-center gap-3 px-4 py-2 rounded-xl border', isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-100 border-zinc-200')}>
            <span className="text-xs font-bold text-zinc-500">Contexto:</span>
            <LeadSelector
              leads={MOCK_LEADS}
              selectedLead={selectedLead}
              onSelectLead={setSelectedLead}
              className="bg-transparent"
            />
          </div>
          <div className={clsx('h-8 w-[1px]', isDark ? 'bg-zinc-800' : 'bg-zinc-200')}></div>

          {/* Settings Button */}
          <button
            className={clsx('p-2 rounded-xl transition-all', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
            title="Configurações"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area: Chat or Dashboard */}
        <main className="flex-1 flex flex-col relative h-full">

          {/* Action Tabs */}
          <div className={clsx('px-8 py-4 border-b flex items-center gap-2 overflow-x-auto no-scrollbar', isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100')}>
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
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Brain size={64} className={clsx('mx-auto mb-4', isDark ? 'text-zinc-700' : 'text-gray-300')} />
                  <h3 className={clsx('mb-2 text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    Selecione um lead
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Escolha um lead para começar a usar o Sales AI
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
  );
}
