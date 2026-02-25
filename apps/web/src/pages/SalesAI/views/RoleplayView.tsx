/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🎭 ROLEPLAY VIEW - Simulador de vendas interativo
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { Users } from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface RoleplayViewProps {
  leadContext: LeadContext | null;
}

export function RoleplayView({ leadContext }: RoleplayViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [scenario, setScenario] = useState('Agendamento Inicial / Demo');
  const [difficulty, setDifficulty] = useState('Médio (Realístico)');

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Selecione um lead para iniciar roleplay</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-500/10 text-orange-500 rounded-full">
              <Users size={48} />
            </div>
          </div>
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Simulador de Vendas IA
          </h2>
          <p className="text-sm text-zinc-500">
            Você atuará como {leadContext.name} ({leadContext.company || 'Clínica Estética Bella'}). Pratique seu pitch e aprenda a lidar com as objeções dela/e em um ambiente seguro.
          </p>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scenario Selector */}
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">
              Cenário
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className={`w-full p-3 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
            >
              <option>Agendamento Inicial / Demo</option>
              <option>Apresentação de Proposta</option>
              <option>Negociação de Preço</option>
              <option>Fechamento Final</option>
              <option>Objeção de Concorrente</option>
            </select>
          </div>

          {/* Difficulty Selector */}
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">
              Dificuldade
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={`w-full p-3 rounded-xl border text-sm font-medium ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'} ${difficulty.includes('Realístico') ? 'text-yellow-500' : ''}`}
            >
              <option>Fácil (Warm Lead)</option>
              <option>Médio (Realístico)</option>
              <option>Difícil (Cold Lead)</option>
            </select>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-center pt-6">
          <button className="px-12 py-4 bg-orange-500 text-white rounded-2xl text-sm font-bold shadow-2xl shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95">
            Iniciar Simulação
          </button>
        </div>

        {/* Info */}
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">
            Pressione Enter para Começar
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            A IA simulará o comportamento de {leadContext.name} baseada no perfil DISC {leadContext.disc || 'INFLUENTE'},
            histórico de interações e contexto atual do lead. Use isto para praticar diferentes abordagens e
            aprender como lidar com objeções reais.
          </p>
        </div>
      </div>
    </div>
  );
}
