/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🎯 LEAD SELECTOR - Dropdown para selecionar lead
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Search, User, Check } from 'lucide-react';
import type { LeadContext } from '@/hooks/useSalesAI';
import { useUIStore } from '@/stores/useUIStore';

interface LeadSelectorProps {
  leads: LeadContext[];
  selectedLead: LeadContext | null;
  onSelectLead: (lead: LeadContext) => void;
  className?: string;
}

export function LeadSelector({
  leads,
  selectedLead,
  onSelectLead,
  className,
}: LeadSelectorProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLeads = leads.filter((lead) =>
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lead.company && lead.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-3 px-4 py-2 rounded-xl border transition-all min-w-[200px]',
          isDark
            ? 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
            : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-sm'
        )}
      >
        {selectedLead ? (
          <>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-nexus-orange/20 text-nexus-orange">
              {selectedLead.name.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              <p className={clsx('text-sm font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {selectedLead.name}
              </p>
              {selectedLead.company && (
                <p className="text-[10px] text-zinc-500">{selectedLead.company}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <User size={20} className="text-zinc-500" />
            <span className={clsx('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              Selecione um lead
            </span>
          </>
        )}
        <ChevronDown
          size={16}
          className={clsx('text-zinc-500 transition-transform', {
            'rotate-180': isOpen,
          })}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className={clsx(
            'absolute top-full right-0 mt-2 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden',
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            {/* Search */}
            <div className={clsx('p-3 border-b', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar lead ou cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={clsx(
                    'w-full pl-9 pr-3 py-2 rounded-lg text-xs border-none outline-none',
                    isDark
                      ? 'bg-zinc-800 text-white placeholder:text-zinc-600'
                      : 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>
            </div>

            {/* Leads List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredLeads.length === 0 ? (
                <div className={clsx('p-4 text-center text-sm', isDark ? 'text-zinc-500' : 'text-gray-500')}>
                  Nenhum lead encontrado
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = selectedLead?.id === lead.id;

                  return (
                    <button
                      key={lead.id}
                      onClick={() => {
                        onSelectLead(lead);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 transition-colors',
                        isSelected
                          ? isDark ? 'bg-nexus-orange/10' : 'bg-nexus-orange/5'
                          : isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
                      )}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-nexus-orange/20 text-nexus-orange">
                        {lead.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className={clsx('text-sm font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                          {lead.name}
                        </p>
                        {lead.company && (
                          <p className="text-[10px] text-zinc-500">{lead.company}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-nexus-orange/10 text-nexus-orange">
                          Lead
                        </span>
                        {lead.leadScore !== undefined && (
                          <span className="text-[9px] text-zinc-500">Score: {lead.leadScore}%</span>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-nexus-orange" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
