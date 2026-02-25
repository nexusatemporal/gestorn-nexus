import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useReactivateClient } from '../hooks/useReactivateClient';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/utils/cn';

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  product: 'ONE_NEXUS' | 'LOCADORAS';
}

interface Client {
  id: string;
  company: string;
  contactName: string;
  status: string;
  planId?: string;
  billingCycle?: string;
}

interface ReactivateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  plans: Plan[];
}

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export function ReactivateClientModal({
  isOpen,
  onClose,
  client,
  plans,
}: ReactivateClientModalProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const reactivateMutation = useReactivateClient();

  // Form state
  const [planId, setPlanId] = useState(client.planId || '');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    (client.billingCycle as BillingCycle) || 'MONTHLY'
  );
  const [newPaymentDate, setNewPaymentDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPlanId(client.planId || '');
      setBillingCycle((client.billingCycle as BillingCycle) || 'MONTHLY');
      setNewPaymentDate('');
      setErrors({});
    }
  }, [isOpen, client]);

  // Calculate selected plan and amount
  const selectedPlan = plans.find((p) => p.id === planId);
  const amount = selectedPlan
    ? billingCycle === 'ANNUAL'
      ? selectedPlan.priceMonthly * 12
      : billingCycle === 'SEMIANNUAL'
      ? selectedPlan.priceMonthly * 6
      : billingCycle === 'QUARTERLY'
      ? selectedPlan.priceMonthly * 3
      : selectedPlan.priceMonthly
    : 0;

  // Extract billing anchor day from selected date
  const billingAnchorDay = newPaymentDate
    ? parseInt(newPaymentDate.split('-')[2], 10)
    : null;

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!planId || planId.trim() === '') {
      newErrors.planId = 'Selecione um plano';
    }
    if (!billingCycle) {
      newErrors.billingCycle = 'Selecione o ciclo de cobrança';
    }
    if (!newPaymentDate || newPaymentDate.trim() === '') {
      newErrors.newPaymentDate = 'Selecione a nova data de pagamento';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validateForm()) return;

    reactivateMutation.mutate(
      {
        clientId: client.id,
        planId,
        billingCycle,
        newPaymentDate,
        amount,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  // Plan options
  const planOptions = plans.map((plan) => ({
    value: plan.id,
    label: `${plan.name} - R$ ${plan.priceMonthly.toFixed(2)}/mês`,
  }));

  // Billing cycle options
  const billingCycleOptions = [
    { value: 'MONTHLY', label: 'Mensal' },
    { value: 'QUARTERLY', label: 'Trimestral' },
    { value: 'SEMIANNUAL', label: 'Semestral' },
    { value: 'ANNUAL', label: 'Anual' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Reativar Cliente" size="lg">
      <div className="space-y-4">
        {/* Client info banner */}
        <div
          className={cn(
            'p-4 rounded-xl border',
            isDark
              ? 'bg-zinc-800 border-zinc-700'
              : 'bg-gray-50 border-gray-200'
          )}
        >
          <h4
            className={cn(
              'font-bold text-lg',
              isDark ? 'text-white' : 'text-gray-900'
            )}
          >
            {client.company}
          </h4>
          <p
            className={cn(
              'text-sm',
              isDark ? 'text-zinc-400' : 'text-gray-600'
            )}
          >
            Contato: {client.contactName}
          </p>
          <p
            className={cn(
              'text-sm font-medium mt-1',
              client.status === 'CANCELADO'
                ? 'text-red-500'
                : client.status === 'INADIMPLENTE'
                ? 'text-yellow-500'
                : 'text-orange-500'
            )}
          >
            Status Atual: {client.status}
          </p>
        </div>

        {/* Plan selection */}
        <Select
          label="Plano"
          options={planOptions}
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          error={errors.planId}
          placeholder="Selecione um plano"
          required
        />

        {/* Billing cycle selection */}
        <Select
          label="Ciclo de Cobrança"
          options={billingCycleOptions}
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
          error={errors.billingCycle}
          required
        />

        {/* New payment date */}
        <Input
          type="date"
          label="Nova Data de Pagamento"
          value={newPaymentDate}
          onChange={(e) => setNewPaymentDate(e.target.value)}
          error={errors.newPaymentDate}
          helperText="Essa será a data do primeiro pagamento"
          required
        />

        {/* Calculated amount display */}
        {selectedPlan && (
          <div
            className={cn(
              'p-4 rounded-xl border',
              isDark
                ? 'bg-nexus-orange/10 border-nexus-orange/30'
                : 'bg-orange-50 border-orange-200'
            )}
          >
            <p
              className={cn(
                'text-sm font-medium',
                isDark ? 'text-zinc-400' : 'text-gray-600'
              )}
            >
              Valor Total
            </p>
            <p className="text-3xl font-bold text-nexus-orange mt-1">
              R$ {amount.toFixed(2)}
            </p>
            <p
              className={cn(
                'text-xs mt-1',
                isDark ? 'text-zinc-500' : 'text-gray-500'
              )}
            >
              {billingCycle === 'MONTHLY' && 'Cobrança mensal'}
              {billingCycle === 'QUARTERLY' && 'Cobrança a cada 3 meses'}
              {billingCycle === 'SEMIANNUAL' && 'Cobrança a cada 6 meses'}
              {billingCycle === 'ANNUAL' && 'Cobrança anual'}
            </p>
          </div>
        )}

        {/* Billing anchor day info */}
        {billingAnchorDay && (
          <div
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl',
              isDark ? 'bg-zinc-800' : 'bg-gray-50'
            )}
          >
            <AlertCircle
              className={cn(
                'w-5 h-5 flex-shrink-0 mt-0.5',
                isDark ? 'text-zinc-400' : 'text-gray-500'
              )}
            />
            <div>
              <p
                className={cn(
                  'text-sm font-medium',
                  isDark ? 'text-zinc-300' : 'text-gray-700'
                )}
              >
                Dia de Vencimento Fixo
              </p>
              <p
                className={cn(
                  'text-xs mt-1',
                  isDark ? 'text-zinc-500' : 'text-gray-600'
                )}
              >
                O dia de vencimento será fixado como <strong>dia {billingAnchorDay}</strong> de
                cada mês (ou período escolhido).
              </p>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={reactivateMutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={reactivateMutation.isPending}
          isLoading={reactivateMutation.isPending}
          leftIcon={!reactivateMutation.isPending && <RefreshCw className="w-4 h-4" />}
        >
          {reactivateMutation.isPending ? 'Reativando...' : 'Reativar Cliente'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
