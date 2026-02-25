/**
 * ══════════════════════════════════════════════════════════════════════════
 * ✨ GENERATOR VIEW - Gerador de conteúdo de vendas
 * ══════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Sparkles,
  Copy,
  RefreshCw,
  Check,
  Mail,
  MessageSquare,
  FileText,
  ShieldAlert,
  Mic,
} from 'lucide-react';
import type { LeadContext, GeneratorContentType } from '@/hooks/useSalesAI';
import { useGenerateContent } from '@/hooks/useSalesAI';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useUIStore } from '@/stores/useUIStore';

interface GeneratorViewProps {
  leadContext: LeadContext | null;
}

interface ContentTypeOption {
  value: GeneratorContentType;
  label: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
}

const CONTENT_TYPES: ContentTypeOption[] = [
  {
    value: 'pitch-60s',
    label: 'Pitch 60s',
    description: 'Apresentação rápida e impactante',
    icon: Mic,
    color: 'text-orange-600 bg-blue-100',
  },
  {
    value: 'email-cold',
    label: 'Email Cold',
    description: 'Primeiro contato por email',
    icon: Mail,
    color: 'text-purple-600 bg-purple-100',
  },
  {
    value: 'email-followup',
    label: 'Email Follow-up',
    description: 'Email de acompanhamento',
    icon: Mail,
    color: 'text-indigo-600 bg-indigo-100',
  },
  {
    value: 'whatsapp-first',
    label: 'WhatsApp First',
    description: 'Primeira mensagem WhatsApp',
    icon: MessageSquare,
    color: 'text-green-600 bg-green-100',
  },
  {
    value: 'whatsapp-followup',
    label: 'WhatsApp Follow-up',
    description: 'Follow-up WhatsApp',
    icon: MessageSquare,
    color: 'text-teal-600 bg-teal-100',
  },
  {
    value: 'script-discovery',
    label: 'Script Discovery',
    description: 'Roteiro para call de descoberta',
    icon: FileText,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    value: 'objection-response',
    label: 'Resposta Objeção',
    description: 'Responder objeções comuns',
    icon: ShieldAlert,
    color: 'text-red-600 bg-red-100',
  },
  {
    value: 'proposal',
    label: 'Proposta',
    description: 'Proposta comercial completa',
    icon: FileText,
    color: 'text-zinc-500 bg-gray-100',
  },
];

export function GeneratorView({ leadContext }: GeneratorViewProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [selectedType, setSelectedType] = useState<GeneratorContentType>('pitch-60s');
  const [instructions, setInstructions] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [metadata, setMetadata] = useState<{
    wordCount?: number;
    tone?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateContent = useGenerateContent();

  const handleGenerate = async () => {
    if (!leadContext) return;

    try {
      const response = await generateContent.mutateAsync({
        type: selectedType,
        leadContext,
        instructions: instructions.trim() || undefined,
      });

      setGeneratedContent(response.content);
      setMetadata(response.metadata || null);
    } catch (error) {
      console.error('Erro ao gerar conteúdo:', error);
    }
  };

  const handleCopy = async () => {
    if (!generatedContent) return;

    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  if (!leadContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className={clsx(isDark ? 'text-zinc-500' : 'text-gray-500')}>
          Selecione um lead para gerar conteúdo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-nexus-orange">
          Gerador de Conteúdo
        </h2>
        <p className={clsx('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-600')}>
          Crie conteúdo personalizado de vendas com IA
        </p>
      </div>

      {/* Content Type Selector */}
      <div className={clsx(
        'p-6 rounded-3xl border',
        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
      )}>
        <h3 className={clsx('text-sm font-bold mb-4', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          Tipo de Conteúdo
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTENT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.value;

            return (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={clsx(
                  'p-6 rounded-2xl border text-left transition-all',
                  isSelected
                    ? 'bg-nexus-orange/10 border-nexus-orange'
                    : isDark
                    ? 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                    : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-sm'
                )}
              >
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                    isSelected
                      ? 'bg-nexus-orange text-white'
                      : isDark
                      ? 'bg-zinc-700 text-zinc-400'
                      : 'bg-zinc-100 text-zinc-500'
                  )}
                >
                  <Icon size={20} />
                </div>
                <p className={clsx('text-sm font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  {type.label}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <div className={clsx(
        'p-6 rounded-3xl border',
        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
      )}>
        <h3 className={clsx('text-sm font-bold mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          Instruções (Opcional)
        </h3>
        <p className={clsx('text-xs mb-4', isDark ? 'text-zinc-500' : 'text-zinc-600')}>
          Adicione detalhes específicos para personalizar o conteúdo
        </p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={
            selectedType === 'objection-response'
              ? 'Ex: Preço muito alto, Não tenho tempo agora...'
              : 'Ex: Mencionar case de sucesso da Clínica X, Focar em automação...'
          }
          rows={4}
          className={clsx(
            'w-full h-24 p-4 rounded-2xl border text-sm resize-none outline-none focus:ring-2 focus:ring-nexus-orange/20',
            isDark
              ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
              : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
          )}
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleGenerate}
            disabled={generateContent.isPending}
            className={clsx(
              'px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95',
              generateContent.isPending
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-nexus-orange text-white shadow-lg shadow-nexus-orange/20 hover:bg-nexus-orangeDark'
            )}
          >
            {generateContent.isPending ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Gerar Conteúdo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {generateContent.isPending && (
        <div className={clsx(
          'p-8 rounded-3xl border',
          isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        )}>
          <LoadingIndicator size="lg" text="Gerando conteúdo personalizado..." />
        </div>
      )}

      {/* Generated Content */}
      {generatedContent && !generateContent.isPending && (
        <div className={clsx(
          'p-8 rounded-3xl border',
          isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-nexus-orange" />
              <h3 className={clsx('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                Conteúdo Gerado
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  isDark
                    ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                    : 'border-zinc-200 text-zinc-600 hover:bg-gray-50'
                )}
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-green-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copiar</span>
                  </>
                )}
              </button>
              <button
                onClick={handleGenerate}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  isDark
                    ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                    : 'border-zinc-200 text-zinc-600 hover:bg-gray-50'
                )}
              >
                <RefreshCw size={16} />
                <span>Regenerar</span>
              </button>
            </div>
          </div>
          <div className={clsx(
            'rounded-lg p-4',
            isDark ? 'bg-zinc-800' : 'bg-gray-50'
          )}>
            <pre className={clsx(
              'whitespace-pre-wrap font-sans text-sm',
              isDark ? 'text-zinc-300' : 'text-zinc-600'
            )}>
              {generatedContent}
            </pre>
          </div>

          {metadata && (
            <div className={clsx(
              'mt-4 flex items-center gap-4 border-t pt-4 text-sm',
              isDark ? 'border-zinc-800 text-zinc-500' : 'border-gray-200 text-zinc-500'
            )}>
              {metadata.wordCount && (
                <div>
                  <span className="font-medium">Palavras:</span>{' '}
                  {metadata.wordCount}
                </div>
              )}
              {metadata.tone && (
                <div>
                  <span className="font-medium">Tom:</span> {metadata.tone}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!generatedContent && !generateContent.isPending && (
        <div className={clsx(
          'p-8 rounded-3xl border',
          isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        )}>
          <div className="py-12 text-center">
            <Sparkles size={64} className={clsx('mx-auto mb-4', isDark ? 'text-zinc-700' : 'text-gray-300')} />
            <h3 className={clsx('mb-2 text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Nenhum conteúdo gerado
            </h3>
            <p className="mb-4 text-sm text-zinc-500">
              Selecione um tipo de conteúdo e clique em "Gerar Conteúdo" para
              criar seu material de vendas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
