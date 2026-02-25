import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Loader2, Sparkles } from 'lucide-react';
import { useConvertLead, useGenerateSummary, usePlans } from '../hooks/useLeads';
import type { ConvertLeadPayload, BillingCycle } from '../types';
import { format } from 'date-fns';

interface Lead {
  id: string;
  name: string;
  companyName?: string;
  numberOfUnits?: number; // ✅ v2.35.0: Número de unidades da empresa
  interestPlanId?: string;
  interestPlan?: {
    id: string;
    name: string;
    priceMonthly: number;
    product: 'ONE_NEXUS' | 'LOCADORAS';
  };
  notes?: string;
}

interface ConvertLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
}

export function ConvertLeadModal({ isOpen, onClose, lead }: ConvertLeadModalProps) {
  // Hooks
  const convertMutation = useConvertLead();
  const generateSummaryMutation = useGenerateSummary();
  const { data: plans = [], isLoading: plansLoading } = usePlans();

  // Form state
  const [formData, setFormData] = useState<ConvertLeadPayload>({
    dealSummary: '',
    planId: lead.interestPlanId || '',
    billingCycle: 'MONTHLY' as BillingCycle,
    numberOfUsers: lead.numberOfUnits || 1, // ✅ v2.35.0: Pre-populate from lead
    closedAt: new Date().toISOString(),
    billingAnchorDay: new Date().getDate(), // ✅ v2.46.0: Default = hoje (1-28)
    implementationNotes: '',
  });

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Selected plan for price display
  const selectedPlan = plans.find((p: any) => p.id === formData.planId);

  // Pre-populate form when lead changes
  useEffect(() => {
    if (lead) {
      setFormData((prev) => ({
        ...prev,
        planId: lead.interestPlanId || '',
        closedAt: new Date().toISOString(),
      }));
    }
  }, [lead]);

  // Handle generate summary with AI
  const handleGenerateSummary = async () => {
    // ✅ Passar planId selecionado para API ser dinâmica
    const result = await generateSummaryMutation.mutateAsync({
      leadId: lead.id,
      planId: formData.planId, // ✅ Usa plano do modal, não do lead
    });
    setFormData((prev) => ({ ...prev, dealSummary: result.summary }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.dealSummary || formData.dealSummary.trim().length < 10) {
      newErrors.dealSummary = 'Resumo deve ter pelo menos 10 caracteres';
    }
    if (!formData.planId || formData.planId.trim() === '') {
      newErrors.planId = 'Selecione um plano';
    }
    if (!formData.billingCycle) {
      newErrors.billingCycle = 'Selecione o ciclo de cobrança';
    }
    if (!formData.numberOfUsers || formData.numberOfUsers < 1) {
      newErrors.numberOfUsers = 'Mínimo de 1 unidade';
    }
    if (!formData.closedAt || formData.closedAt.trim() === '') {
      newErrors.closedAt = 'Data de fechamento obrigatória';
    }
    if (!formData.billingAnchorDay || formData.billingAnchorDay < 1 || formData.billingAnchorDay > 28) {
      newErrors.billingAnchorDay = 'Selecione um dia válido (1-28)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // ✅ v2.29.0: Adicionar try/catch para capturar e exibir erros de conversão
    try {
      await convertMutation.mutateAsync({
        leadId: lead.id,
        payload: formData,
      });

      onClose(); // ✅ Só fecha se conversão for bem-sucedida
    } catch (error: any) {
      // ✅ Exibir mensagem de erro ao usuário
      const errorMessage = error.response?.data?.message || 'Erro ao converter lead. Tente novamente.';
      alert(errorMessage);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Converter Lead em Cliente" size="xl">
      <p className="text-sm text-muted-foreground mb-6">{lead.companyName || lead.name}</p>

      <div className="space-y-6">
        {/* Resumo da Negociação */}
        <div className="space-y-2">
          <label htmlFor="dealSummary" className="text-sm font-medium">
            Resumo da Negociação *
          </label>
          <Textarea
            id="dealSummary"
            value={formData.dealSummary}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData((prev) => ({ ...prev, dealSummary: e.target.value }))
            }
            placeholder="Descreva os principais pontos da negociação..."
            rows={4}
            className={errors.dealSummary ? 'border-red-500' : ''}
          />
          {errors.dealSummary && <p className="text-sm text-red-500">{errors.dealSummary}</p>}
          <Button
            onClick={handleGenerateSummary}
            disabled={generateSummaryMutation.isPending}
            variant="secondary"
            size="sm"
            className="mt-2"
          >
            {generateSummaryMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar com IA
          </Button>
        </div>

        {/* Plano Fechado */}
        <div className="space-y-2">
          <Select
            label="Plano Fechado *"
            placeholder="Selecione o plano"
            value={formData.planId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData((prev) => ({ ...prev, planId: e.target.value }))
            }
            options={
              plansLoading
                ? [{ value: '', label: 'Carregando...', disabled: true }]
                : plans.map((plan: any) => ({
                    value: plan.id,
                    label: plan.name, // ✅ APENAS nome do plano
                  }))
            }
            error={errors.planId}
          />
        </div>

        {/* Ciclo de Cobrança com Cards */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200">
            Ciclo de Cobrança *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Card MENSAL */}
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, billingCycle: 'MONTHLY' }))}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                formData.billingCycle === 'MONTHLY'
                  ? 'border-nexus-orange bg-nexus-orange/10'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.billingCycle === 'MONTHLY'
                      ? 'border-nexus-orange'
                      : 'border-zinc-600'
                  }`}
                >
                  {formData.billingCycle === 'MONTHLY' && (
                    <div className="w-3 h-3 rounded-full bg-nexus-orange" />
                  )}
                </div>
                <span className="font-semibold text-zinc-200">Mensal</span>
              </div>
              <p className="text-sm text-zinc-400">
                {selectedPlan ? formatCurrency(selectedPlan.priceMonthly) : 'R$ --'}/mês
              </p>
            </button>

            {/* Card ANUAL com badge desconto - v2.41.1: 10% desconto FIXO */}
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, billingCycle: 'ANNUAL' }))}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                formData.billingCycle === 'ANNUAL'
                  ? 'border-nexus-orange bg-nexus-orange/10'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              {selectedPlan && selectedPlan.priceMonthly && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                  -10%
                </span>
              )}
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.billingCycle === 'ANNUAL'
                      ? 'border-nexus-orange'
                      : 'border-zinc-600'
                  }`}
                >
                  {formData.billingCycle === 'ANNUAL' && (
                    <div className="w-3 h-3 rounded-full bg-nexus-orange" />
                  )}
                </div>
                <span className="font-semibold text-zinc-200">Anual</span>
              </div>
              <p className="text-sm text-zinc-400">
                {selectedPlan ? formatCurrency(selectedPlan.priceMonthly * 12 * 0.9) : 'R$ --'}/ano
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                ({selectedPlan ? formatCurrency(selectedPlan.priceMonthly * 0.9) : 'R$ --'}/mês)
              </p>
            </button>
          </div>
          {errors.billingCycle && <p className="text-sm text-red-500 mt-1">{errors.billingCycle}</p>}
        </div>

        {/* Número de Unidades */}
        <div className="space-y-2">
          <label htmlFor="numberOfUsers" className="text-sm font-medium">
            Nº de Unidades *
          </label>
          <Input
            id="numberOfUsers"
            type="number"
            min={1}
            value={formData.numberOfUsers}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev) => ({
                ...prev,
                numberOfUsers: parseInt(e.target.value) || 1,
              }))
            }
            className={errors.numberOfUsers ? 'border-red-500' : ''}
          />
          {errors.numberOfUsers && <p className="text-sm text-red-500">{errors.numberOfUsers}</p>}
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="closedAt" className="text-sm font-medium">
              Data Fechamento *
            </label>
            <Input
              id="closedAt"
              type="date"
              value={formData.closedAt ? format(new Date(formData.closedAt), 'yyyy-MM-dd') : ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (!e.target.value) {
                  // If input is cleared, use empty string instead of Invalid Date
                  setFormData((prev) => ({ ...prev, closedAt: '' }));
                } else {
                  setFormData((prev) => ({
                    ...prev,
                    closedAt: new Date(e.target.value + 'T00:00:00').toISOString(),
                  }));
                }
              }}
              className={errors.closedAt ? 'border-red-500' : ''}
            />
            {errors.closedAt && <p className="text-sm text-red-500">{errors.closedAt}</p>}
          </div>

          <div className="space-y-2">
            <Select
              id="billingAnchorDay"
              label="Dia de Vencimento *"
              value={String(formData.billingAnchorDay)}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData((prev) => ({ ...prev, billingAnchorDay: parseInt(e.target.value) }))
              }
              options={Array.from({ length: 28 }, (_, i) => ({
                value: String(i + 1),
                label: `Dia ${i + 1}`,
              }))}
              error={errors.billingAnchorDay}
              helperText="Dia fixo do mês para cobrança (1-28)"
            />
          </div>
        </div>

        {/* Notas de Implantação */}
        <div className="space-y-2">
          <label htmlFor="implementationNotes" className="text-sm font-medium">
            Notas para Implantação (opcional)
          </label>
          <Textarea
            id="implementationNotes"
            value={formData.implementationNotes || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData((prev) => ({ ...prev, implementationNotes: e.target.value }))
            }
            placeholder="Ex: Migrar dados do sistema X, contato TI: João (11) 98888-8888"
            rows={3}
          />
        </div>
      </div>

      <ModalFooter className="mt-6">
        <Button variant="secondary" onClick={onClose} disabled={convertMutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={convertMutation.isPending} variant="primary">
          {convertMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Convertendo...
            </>
          ) : (
            <>Converter em Cliente</>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
