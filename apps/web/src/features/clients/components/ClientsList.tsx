import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  ArrowLeft,
  Calendar,
  CreditCard,
  History,
  Info,
  X,
  Database,
  UserRoundSearch,
  Globe,
  Server,
  Activity,
  ExternalLink,
  ShieldCheck,
  Lock,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useApiQuery } from '@/hooks/useApi';
import { api } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query'; // v2.44.0: Invalidação de cache
import {
  ClientStatus,
  ProductType,
  TenantStatus,
  UserRole,
  ClientExtended,
  BillingCycle,
} from '@/types';
import { formatDateLocal } from '@/utils/formatters';
import { ReactivateClientModal } from './ReactivateClientModal';
import { usePlans } from '../hooks/usePlans';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLIENTS LIST - Módulo de Gestão de Clientes
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Módulo reutilizado para One Nexus e Locadoras.
 * Recebe `product` como prop e filtra automaticamente.
 *
 * FEATURES:
 * - Tabela de clientes com busca e filtros
 * - Modal de criação/edição
 * - Modal de detalhes com 5 abas
 * - Aba Tenant & Acesso com Impersonate
 * - RBAC por role
 * - Dark mode completo
 */

// ✅ v2.45.0: Roles disponíveis para clientes (igual ao Lead)
const ROLES = [
  "Sócio ou Fundador",
  "Presidente ou CEO",
  "Vice-presidente ou C-Level",
  "Diretor",
  "Gerente",
  "Coordenador",
  "Supervisor",
  "Analista",
  "Recepcionista"
];

// ✅ v2.45.0: Map frontend role (português) to backend enum (ClientRole)
const mapRoleToApi = (role: string | null | undefined): string | undefined => {
  if (!role) return undefined;
  const mapping: Record<string, string> = {
    'Sócio ou Fundador': 'SOCIO_FUNDADOR',
    'Presidente ou CEO': 'CEO_PRESIDENTE',
    'Vice-presidente ou C-Level': 'VP_CLEVEL',
    'Diretor': 'DIRETOR',
    'Gerente': 'GERENTE',
    'Coordenador': 'COORDENADOR',
    'Supervisor': 'SUPERVISOR',
    'Analista': 'ANALISTA',
    'Recepcionista': 'RECEPCIONISTA',
  };
  return mapping[role] || 'OUTRO';
};

// ✅ v2.45.0: REVERSE MAP - Backend enum to Portuguese
const mapApiRoleToDisplay = (apiRole: string | undefined): string => {
  if (!apiRole) return ROLES[0];
  const mapping: Record<string, string> = {
    'SOCIO_FUNDADOR': 'Sócio ou Fundador',
    'CEO_PRESIDENTE': 'Presidente ou CEO',
    'VP_CLEVEL': 'Vice-presidente ou C-Level',
    'DIRETOR': 'Diretor',
    'GERENTE': 'Gerente',
    'COORDENADOR': 'Coordenador',
    'SUPERVISOR': 'Supervisor',
    'ANALISTA': 'Analista',
    'RECEPCIONISTA': 'Recepcionista',
    'OUTRO': 'Outro',
  };
  return mapping[apiRole] || ROLES[0];
};

// ✅ v2.45.0: Formata CNPJ para exibição
const formatCnpj = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    // CPF: 000.000.000-00
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
};

// ✅ v2.45.0: Formata telefone para exibição
const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return value;
};

const StatusBadge: React.FC<{ status: ClientStatus }> = ({ status }) => {
  const styles = {
    [ClientStatus.ATIVO]: 'bg-green-500/10 text-green-500 border-green-500/20',
    [ClientStatus.INADIMPLENTE]:
      'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    [ClientStatus.CANCELADO]: 'bg-red-500/10 text-red-500 border-red-500/20',
    [ClientStatus.EM_TRIAL]: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  const labels = {
    [ClientStatus.ATIVO]: 'Ativo',
    [ClientStatus.INADIMPLENTE]: 'Inadimplente',
    [ClientStatus.CANCELADO]: 'Cancelado',
    [ClientStatus.EM_TRIAL]: 'Em Trial',
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
};

const TenantStatusBadge: React.FC<{ status: TenantStatus }> = ({ status }) => {
  const styles = {
    [TenantStatus.ATIVO]: 'bg-green-500/10 text-green-500 border-green-500/20',
    [TenantStatus.SUSPENSO]:
      'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    [TenantStatus.BLOQUEADO]:
      'bg-red-500/10 text-red-500 border-red-500/20',
    [TenantStatus.DELETADO]:
      'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };

  const labels = {
    [TenantStatus.ATIVO]: 'Ativo',
    [TenantStatus.SUSPENSO]: 'Suspenso',
    [TenantStatus.BLOQUEADO]: 'Bloqueado',
    [TenantStatus.DELETADO]: 'Deletado',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
};

const ClientFormModal: React.FC<{
  client: ClientExtended | null;
  productType: ProductType;
  isDark: boolean;
  onClose: () => void;
  onSave: (client: ClientExtended) => void;
}> = ({ client, productType, isDark, onClose, onSave }) => {
  // Buscar planos do backend
  const { data: plans = [], isLoading: loadingPlans } = usePlans(productType);

  // ✅ v2.45.2: Estado de etapa do modal (1 = dados cliente, 2 = dados plano)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState<Partial<ClientExtended>>(
    client ? {
      ...client,
      phone: formatPhone(client.phone || ''), // ✅ v2.45.3: Aplicar formatação para exibição
      cpfCnpj: formatCnpj(client.cpfCnpj || ''), // ✅ v2.45.3: Aplicar formatação para exibição
      billingCycle: client.billingCycle || BillingCycle.MONTHLY, // ✅ Garantir valor definido
      role: client.role ? mapApiRoleToDisplay(client.role) : ROLES[0], // ✅ v2.45.0: Map backend enum to display
      billingAnchorDay: client.subscriptions?.[0]?.billingAnchorDay || new Date().getDate(), // ✅ v2.46.0: Ler da Subscription ativa
    } : {
      company: '',
      contactName: '',
      email: '',
      phone: '',
      cpfCnpj: '',
      role: ROLES[0], // ✅ v2.45.0: Default role
      productType: productType,
      planId: '',
      billingCycle: BillingCycle.MONTHLY, // Default apenas para CREATE
      status: ClientStatus.EM_TRIAL, // ✅ v2.45.0: Default status
      numberOfUsers: 1, // ✅ v2.45.0: Default number of users
      billingAnchorDay: new Date().getDate(), // ✅ v2.46.0: Default = dia de hoje (1-28)
      closedAt: new Date().toISOString().split('T')[0], // ✅ v2.45.1: Data de fechamento (YYYY-MM-DD)
    }
  );

  // ✅ v2.46.1: Atualizar formData quando client mudar (fix modal mostrando dia 11)
  useEffect(() => {
    if (client) {
      setFormData({
        ...client,
        phone: formatPhone(client.phone || ''),
        cpfCnpj: formatCnpj(client.cpfCnpj || ''),
        billingCycle: client.billingCycle || BillingCycle.MONTHLY,
        role: client.role ? mapApiRoleToDisplay(client.role) : ROLES[0],
        billingAnchorDay: client?.subscriptions?.[0]?.billingAnchorDay || new Date().getDate(),
      });
    }
  }, [client]);

  // Plano selecionado
  const selectedPlan = useMemo(() => {
    return plans.find((p) => p.id === formData.planId);
  }, [plans, formData.planId]);

  // ✅ v2.42.2: Calcular MRR com desconto fixo 10% para ANNUAL (não usa priceAnnual)
  const calculatedMRR = useMemo(() => {
    if (!selectedPlan || !formData.billingCycle) return 0;

    switch (formData.billingCycle) {
      case BillingCycle.MONTHLY:
        return selectedPlan.priceMonthly;
      case BillingCycle.QUARTERLY:
        return selectedPlan.priceMonthly; // Assumindo mesmo preço mensal
      case BillingCycle.SEMIANNUAL:
        return selectedPlan.priceMonthly; // Assumindo mesmo preço mensal
      case BillingCycle.ANNUAL:
        return selectedPlan.priceMonthly * 0.9; // ✅ v2.42.2: MRR = priceMonthly com 10% desconto fixo
      default:
        return 0;
    }
  }, [selectedPlan, formData.billingCycle]);

  // v2.41.1: Desconto anual FIXO em 10% (não depende do priceAnnual do banco)
  const annualDiscount = 10;

  // ✅ v2.45.2: Validar etapa 1 antes de avançar
  const validateStep1 = (): boolean => {
    if (!formData.company?.trim()) {
      alert('❌ Nome da empresa é obrigatório');
      return false;
    }
    if (!formData.contactName?.trim()) {
      alert('❌ Nome do contato é obrigatório');
      return false;
    }
    if (!formData.email?.trim()) {
      alert('❌ Email é obrigatório');
      return false;
    }
    if (!formData.phone?.trim()) {
      alert('❌ Telefone é obrigatório');
      return false;
    }
    if (!formData.cpfCnpj?.trim()) {
      alert('❌ CPF/CNPJ é obrigatório');
      return false;
    }
    return true;
  };

  // ✅ v2.45.2: Avançar para etapa 2
  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  // ✅ v2.45.2: Voltar para etapa 1
  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: any = {
        company: formData.company,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        productType: formData.productType,
        planId: formData.planId,
        billingCycle: formData.billingCycle,
        status: formData.status,
      };

      // UPDATE: não enviar cpfCnpj, role, numberOfUsers (não podem ser editados)
      // CREATE: incluir todos os campos
      if (client?.id) {
        // UPDATE - incluir billingAnchorDay se fornecido (✅ v2.46.0)
        if (formData.billingAnchorDay !== undefined) {
          payload.billingAnchorDay = formData.billingAnchorDay;
        }
        await api.put(`/clients/${client.id}`, payload);
      } else {
        // CREATE - incluir todos os campos obrigatórios + handoff fields
        payload.cpfCnpj = formData.cpfCnpj?.replace(/\D/g, ''); // ✅ v2.45.0: Remove formatting
        payload.role = mapRoleToApi(formData.role); // ✅ v2.45.0: Map to backend enum
        payload.numberOfUsers = formData.numberOfUsers || 1; // ✅ v2.45.0: Default 1
        payload.billingAnchorDay = formData.billingAnchorDay || new Date().getDate(); // ✅ v2.46.0: Dia de vencimento (1-28)

        // ✅ v2.45.1: Campos de handoff mínimos (Sales → CS)
        payload.closedAt = formData.closedAt || new Date().toISOString().split('T')[0]; // Data de fechamento
        payload.convertedFromLeadId = null; // Criação direta, não veio de lead
        // dealSummary e implementationNotes removidos do modal (opcionais, backend aceita vazio)

        // ✅ v2.45.0: vendedorId será auto-atribuído pelo backend
        await api.post('/clients', payload);
      }

      onSave(formData as ClientExtended);
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);

      // Exibir mensagem detalhada do erro
      const errorMessage = error.response?.data?.message || 'Erro desconhecido';
      alert(`❌ Erro ao salvar cliente:\n\n${errorMessage}\n\nVerifique o console para mais detalhes.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-2xl'} border w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl`}
      >
        <form onSubmit={handleSubmit}>
          {/* ✅ v2.45.2: Header com indicador de etapas */}
          <div
            className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2
                className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}
              >
                {client ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Indicador de etapas (apenas em CREATE) */}
            {!client && (
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-nexus-orange' : 'text-zinc-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${currentStep === 1 ? 'border-nexus-orange bg-nexus-orange/10' : 'border-zinc-500'}`}>
                    1
                  </div>
                  <span className="text-xs font-bold uppercase">Dados do Cliente</span>
                </div>
                <div className={`flex-1 h-[2px] ${currentStep === 2 ? 'bg-nexus-orange' : 'bg-zinc-700'}`} />
                <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-nexus-orange' : 'text-zinc-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${currentStep === 2 ? 'border-nexus-orange bg-nexus-orange/10' : 'border-zinc-500'}`}>
                    2
                  </div>
                  <span className="text-xs font-bold uppercase">Dados do Plano</span>
                </div>
              </div>
            )}
          </div>

          {/* ✅ v2.45.2: Conteúdo por etapa */}
          <div className="p-6 space-y-4">
            {/* ETAPA 1: Dados do Cliente (CREATE) ou Todos os campos (EDIT) */}
            {(currentStep === 1 || !!client) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Nome da Empresa
                  </label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.company || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Nome do Contato
                </label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.contactName || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactName: e.target.value,
                    })
                  }
                />
              </div>

              {/* ✅ v2.45.0: Email */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={!!client} // Não editar em UPDATE
                />
              </div>

              {/* ✅ v2.45.0: Telefone */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.phone || ''}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setFormData({ ...formData, phone: formatted });
                  }}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  disabled={!!client} // Não editar em UPDATE
                />
              </div>

              {/* ✅ v2.45.0: CPF/CNPJ */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  CPF/CNPJ
                </label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.cpfCnpj || ''}
                  onChange={(e) => {
                    const formatted = formatCnpj(e.target.value);
                    setFormData({ ...formData, cpfCnpj: formatted });
                  }}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  disabled={!!client} // Não editar em UPDATE
                />
              </div>

              {/* ✅ v2.45.0: Cargo */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Cargo (Opcional)
                </label>
                <select
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.role || ROLES[0]}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  disabled={!!client} // Não editar em UPDATE
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ v2.45.0: Número de Unidades */}
              {!client && (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Nº de Unidades
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                    value={formData.numberOfUsers || 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        numberOfUsers: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              )}

              {/* ✅ v2.46.0: Dia de Vencimento (disponível em CREATE e EDIT) */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Dia de Vencimento *
                </label>
                <select
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.billingAnchorDay || new Date().getDate()}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billingAnchorDay: parseInt(e.target.value),
                    })
                  }
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Dia {day}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  Dia fixo do mês para cobrança (1-28)
                </p>
              </div>

              {/* ✅ v2.45.1: Data de Fechamento */}
              {!client && (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Data de Fechamento
                  </label>
                  <input
                    type="date"
                    className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                    value={formData.closedAt || new Date().toISOString().split('T')[0]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        closedAt: e.target.value,
                      })
                    }
                  />
                </div>
              )}
              </div>
            )}

            {/* ETAPA 2: Dados do Plano (CREATE only) ou Todos os campos (EDIT) */}
            {(currentStep === 2 || !!client) && (
              <div className="grid grid-cols-2 gap-4">
                {/* Planos e Ciclo de Cobrança */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Plano
                  </label>
                <select
                  required
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.planId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, planId: e.target.value })
                  }
                  disabled={loadingPlans}
                >
                  <option value="">
                    {loadingPlans ? 'Carregando...' : 'Selecione um plano'}
                  </option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Radio Buttons de Billing Cycle */}
              {formData.planId && selectedPlan && (
                <div className="col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Ciclo de Cobrança
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Mensal */}
                    <label
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer
                        transition-all hover:border-nexus-orange/50
                        ${
                          formData.billingCycle === BillingCycle.MONTHLY
                            ? 'border-nexus-orange bg-nexus-orange/5'
                            : isDark
                              ? 'border-zinc-700'
                              : 'border-zinc-300'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="billingCycle"
                        value={BillingCycle.MONTHLY}
                        checked={formData.billingCycle === BillingCycle.MONTHLY}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            billingCycle: e.target.value as BillingCycle,
                          })
                        }
                        className="text-nexus-orange"
                      />
                      <div className="flex-1">
                        <div
                          className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}
                        >
                          Mensal
                        </div>
                        <div className="text-xs text-zinc-400">
                          R$ {selectedPlan.priceMonthly.toFixed(2)}/mês
                        </div>
                      </div>
                    </label>

                    {/* Anual */}
                    <label
                      className={`
                        relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer
                        transition-all hover:border-nexus-orange/50
                        ${
                          formData.billingCycle === BillingCycle.ANNUAL
                            ? 'border-nexus-orange bg-nexus-orange/5'
                            : isDark
                              ? 'border-zinc-700'
                              : 'border-zinc-300'
                        }
                      `}
                    >
                      {annualDiscount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          -{annualDiscount}%
                        </span>
                      )}

                      <input
                        type="radio"
                        name="billingCycle"
                        value={BillingCycle.ANNUAL}
                        checked={formData.billingCycle === BillingCycle.ANNUAL}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            billingCycle: e.target.value as BillingCycle,
                          })
                        }
                        className="text-nexus-orange"
                      />
                      <div className="flex-1">
                        <div
                          className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}
                        >
                          Anual
                        </div>
                        <div className="text-xs text-zinc-400">
                          R$ {(selectedPlan.priceMonthly * 12 * 0.9).toFixed(2)}/ano
                          <span className="text-green-400 ml-1">
                            (R$ {(selectedPlan.priceMonthly * 0.9).toFixed(2)}/mês)
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* MRR Calculado (Read-only) */}
              {formData.planId && selectedPlan && (
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    MRR (Receita Mensal Recorrente)
                  </label>
                  <div
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? 'bg-zinc-800/50 border-zinc-700 text-nexus-orange' : 'bg-zinc-50 border-zinc-300 text-nexus-orange'} font-bold`}
                  >
                    R$ {calculatedMRR.toFixed(2)}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Status
                </label>
                <select
                  className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-1 focus:ring-nexus-orange outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as ClientStatus,
                    })
                  }
                >
                  <option value={ClientStatus.ATIVO}>Ativo</option>
                  <option value={ClientStatus.INADIMPLENTE}>
                    Inadimplente
                  </option>
                  <option value={ClientStatus.CANCELADO}>Cancelado</option>
                  <option value={ClientStatus.EM_TRIAL}>Em Trial</option>
                </select>
              </div>
              </div>
            )}
          </div>

          <div
            className={`p-6 border-t flex gap-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}
          >
            {/* ✅ v2.45.2: Botões condicionais por etapa */}
            {!client ? (
              currentStep === 1 ? (
                // Etapa 1: Cancelar + Próximo
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 text-zinc-500 text-sm font-bold hover:text-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-2 bg-nexus-orange text-white rounded-lg text-sm font-bold hover:bg-nexus-orangeDark transition-all shadow-lg shadow-nexus-orange/20"
                  >
                    Próximo →
                  </button>
                </>
              ) : (
                // Etapa 2: Voltar + Salvar
                <>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 py-2 text-zinc-500 text-sm font-bold hover:text-zinc-900 transition-colors"
                  >
                    ← Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-nexus-orange text-white rounded-lg text-sm font-bold hover:bg-nexus-orangeDark transition-all shadow-lg shadow-nexus-orange/20"
                  >
                    Salvar
                  </button>
                </>
              )
            ) : (
              // EDIÇÃO: Botões normais
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 text-zinc-500 text-sm font-bold hover:text-zinc-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-nexus-orange text-white rounded-lg text-sm font-bold hover:bg-nexus-orangeDark transition-all shadow-lg shadow-nexus-orange/20"
                >
                  Salvar
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

const ImpersonateModal: React.FC<{
  client: ClientExtended;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}> = ({ client, isDark, onClose, onConfirm }) => {
  const [reason, setReason] = useState('Suporte técnico');
  const [customReason, setCustomReason] = useState('');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-2xl'} border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95`}
      >
        <div
          className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex justify-between items-center bg-indigo-600/10`}
        >
          <h2 className="font-bold flex items-center gap-2 text-indigo-500">
            <UserRoundSearch size={20} /> Confirmar Impersonate
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div
            className={`p-4 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}
          >
            <p className="text-xs text-zinc-500 font-bold uppercase mb-2 tracking-widest">
              Alvo do Acesso
            </p>
            <div className="flex flex-col gap-1">
              <span
                className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}
              >
                {client.company}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 break-all">
                {client.tenant?.id}
              </span>
              <span className="text-xs text-indigo-400 font-medium">
                {client.productType === ProductType.ONE_NEXUS
                  ? 'One Nexus'
                  : 'Locadoras'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed italic border-l-2 border-indigo-500 pl-3 bg-indigo-500/5 py-2">
              ⚠️ Esta ação será registrada no log de auditoria permanente. O
              acesso como cliente deve ser realizado apenas para fins
              profissionais.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-bold uppercase">
                Motivo do Acesso
              </label>
              <select
                className={`w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option>Suporte técnico</option>
                <option>Debug/Investigação</option>
                <option>Monitoramento de saúde</option>
                <option>Outro</option>
              </select>

              {reason === 'Outro' && (
                <textarea
                  placeholder="Especifique o motivo detalhadamente..."
                  className={`mt-2 w-full rounded-lg px-3 py-2 text-sm border h-20 outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        <div
          className={`p-6 border-t flex gap-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-zinc-500 text-sm font-bold hover:text-zinc-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason === 'Outro' ? customReason : reason)}
            disabled={reason === 'Outro' && !customReason}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            Confirmar e Acessar
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientDetailModal: React.FC<{
  client: ClientExtended;
  isDark: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onImpersonate: (cName: string, tId: string) => void;
  role: UserRole;
}> = ({ client, isDark, onClose, onEdit, onDelete, onImpersonate, role }) => {
  const [activeTab, setActiveTab] = useState('geral');
  const [isImpersonateOpen, setIsImpersonateOpen] = useState(false);

  const canSeeFinancial =
    role === UserRole.SUPERADMIN || role === UserRole.ADMINISTRATIVO;
  const canImpersonate =
    role === UserRole.SUPERADMIN ||
    role === UserRole.DESENVOLVEDOR ||
    role === UserRole.GESTOR;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div
        className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-2xl'} border w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden relative z-10 flex flex-col animate-in slide-in-from-bottom-4 duration-300`}
      >
        {/* Header */}
        <div
          className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex items-center justify-between`}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg text-zinc-400 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2
                className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}
              >
                {client.company}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={client.status} />
                <span className="text-xs text-zinc-500 font-mono">
                  {client.tenant?.id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canImpersonate && (
              <button
                onClick={() => setIsImpersonateOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                <UserRoundSearch size={18} /> Impersonate
              </button>
            )}
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-nexus-orange text-white rounded-lg text-sm font-bold hover:bg-nexus-orangeDark transition-colors shadow-lg shadow-nexus-orange/20"
            >
              Editar Ficha
            </button>
            <button
              onClick={() => {
                if (confirm('Excluir?')) onDelete();
              }}
              className={`p-2.5 text-zinc-500 hover:text-red-500 rounded-lg transition-colors border ${isDark ? 'border-zinc-800 hover:bg-red-500/10' : 'border-zinc-200 hover:bg-red-50'}`}
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          className={`flex px-6 border-b overflow-x-auto ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}
        >
          {[
            { id: 'geral', label: 'Dados Gerais', icon: Info, show: true },
            { id: 'contrato', label: 'Contrato', icon: Calendar, show: true },
            {
              id: 'financeiro',
              label: 'Financeiro',
              icon: CreditCard,
              show: canSeeFinancial,
            },
            {
              id: 'tenant',
              label: 'Tenant & Acesso',
              icon: Database,
              show: true,
            },
            {
              id: 'interacoes',
              label: 'Interações',
              icon: History,
              show: true,
            },
          ]
            .filter((t) => t.show)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-nexus-orange text-nexus-orange'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'tenant' && client.tenant && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* 3 Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Sistema & Host */}
                <div
                  className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'}`}
                >
                  <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
                    <Globe size={14} className="text-indigo-400" /> Sistema &
                    Host
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Sistema:</span>
                      <span className="text-sm font-bold">
                        {client.tenant.system === ProductType.ONE_NEXUS
                          ? 'One Nexus'
                          : 'Locadoras'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">VPS:</span>
                      <span className="text-sm font-bold">
                        {client.tenant.vps}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Versão:</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}`}
                      >
                        {client.tenant.version}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Recursos */}
                <div
                  className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'}`}
                >
                  <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
                    <Server size={14} className="text-green-400" /> Recursos
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">
                        Armazenamento:
                      </span>
                      <span className="text-sm font-bold">
                        {client.tenant.storageUsage}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">
                        Usuários Ativos:
                      </span>
                      <span className="text-sm font-bold">
                        {client.tenant.activeUsers}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Uptime:</span>
                      <span className="text-[10px] font-bold text-green-500">
                        99.9%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Status & Saúde */}
                <div
                  className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'}`}
                >
                  <div className="flex items-center gap-2 text-zinc-500 mb-4 font-bold text-[10px] uppercase tracking-widest">
                    <Activity size={14} className="text-nexus-orange" /> Status
                    & Saúde
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Status:</span>
                      <TenantStatusBadge status={client.tenant.status} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">
                        Último Acesso:
                      </span>
                      <span className="text-[10px] font-medium text-zinc-400">
                        {client.tenant.lastAccess}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Saúde:</span>
                      <div className="flex gap-1 h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="bg-green-500 h-full"
                          style={{ width: `${client.healthScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção de Impersonate */}
              <div
                className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-800/20 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} flex flex-wrap items-center justify-between gap-6`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                    <Lock size={24} />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                    >
                      Acesso por Impersonate
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                      Acesse o ambiente do cliente com privilégios de
                      administrador para suporte e manutenção.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={`https://${client.tenant.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-600 hover:bg-white'}`}
                  >
                    Link Direto <ExternalLink size={14} />
                  </a>
                  {canImpersonate && (
                    <button
                      onClick={() => setIsImpersonateOpen(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      Acessar como Cliente <UserRoundSearch size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Histórico de Impersonate */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <ShieldCheck size={14} /> Histórico de Impersonate
                </h4>
                <div
                  className={`border rounded-xl overflow-hidden ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
                >
                  <table className="w-full text-left">
                    <thead
                      className={`text-[9px] font-bold uppercase text-zinc-500 ${isDark ? 'bg-zinc-900/50' : 'bg-zinc-50'}`}
                    >
                      <tr>
                        <th className="px-4 py-2">Data/Hora</th>
                        <th className="px-4 py-2">Usuário</th>
                        <th className="px-4 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y text-xs ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}
                    >
                      <tr>
                        <td className="px-4 py-2">12/12/2023 14:00</td>
                        <td className="px-4 py-2 font-bold text-nexus-orange">
                          Alex Silva
                        </td>
                        <td className="px-4 py-2 italic">
                          Suporte ao faturamento
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">05/12/2023 09:30</td>
                        <td className="px-4 py-2 font-bold text-nexus-orange">
                          Ricardo Dev
                        </td>
                        <td className="px-4 py-2 italic">
                          Investigação de Bug v2.4
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'geral' && (
            <div className="grid grid-cols-2 gap-8 animate-in fade-in duration-300">
              <section className="space-y-6">
                <div>
                  <h3 className="text-zinc-500 text-xs font-bold uppercase mb-4 tracking-wider">
                    Identificação
                  </h3>
                  <div className="space-y-3">
                    <div
                      className={`flex justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    >
                      <span className="text-zinc-400 text-sm">
                        Responsável
                      </span>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                      >
                        {client.contactName}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    >
                      <span className="text-zinc-400 text-sm">CPF/CNPJ</span>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                      >
                        {formatCnpj(client.cpfCnpj || '')}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    >
                      <span className="text-zinc-400 text-sm">Email</span>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                      >
                        {client.email}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div>
                  <h3 className="text-zinc-500 text-xs font-bold uppercase mb-4 tracking-wider">
                    Localização & Assinatura
                  </h3>
                  <div className="space-y-3">
                    <div
                      className={`flex justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    >
                      <span className="text-zinc-400 text-sm">Telefone</span>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                      >
                        {formatPhone(client.phone || '')}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    >
                      <span className="text-zinc-400 text-sm">Plano</span>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}
                      >
                        {client.plan}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between border-b pb-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    >
                      <span className="text-zinc-400 text-sm">Vencimento</span>
                      <span className="text-sm font-bold text-nexus-orange">
                        {!client.subscriptionExpiry || client.subscriptionExpiry === 'Sem vencimento'
                          ? 'Sem vencimento'
                          : formatDateLocal(client.subscriptionExpiry)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {!['tenant', 'geral'].includes(activeTab) && (
            <div className="flex items-center justify-center h-48 text-zinc-500 italic">
              Carregando dados de {activeTab}...
            </div>
          )}
        </div>
      </div>

      {isImpersonateOpen && (
        <ImpersonateModal
          client={client}
          isDark={isDark}
          onClose={() => setIsImpersonateOpen(false)}
          onConfirm={(_reason) => {
            setIsImpersonateOpen(false);
            onImpersonate(client.company || 'Cliente', client.tenant?.id || '');
            onClose();
          }}
        />
      )}
    </div>
  );
};

export const ClientsList: React.FC<{
  product: ProductType;
  onImpersonate?: (cName: string, tId: string) => void;
  role?: UserRole;
}> = ({
  product,
  onImpersonate = () => {},
  role = UserRole.SUPERADMIN,
}) => {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  // Fetch real data from API
  const { data: apiClients = [], isLoading, refetch } = useApiQuery<any[]>(
    ['clients', product],
    `/clients?productType=${product}`
  );

  // Transform API data to match ClientExtended interface
  const clients: ClientExtended[] = apiClients.map((c) => ({
    id: c.id,
    company: c.company,
    contactName: c.contactName,
    cpfCnpj: c.cpfCnpj,
    email: c.email,
    phone: c.phone,
    productType: c.productType,
    status: c.status,
    planId: c.planId,
    billingCycle: c.billingCycle || BillingCycle.MONTHLY, // ✅ v2.42.0: Mapear billing cycle do backend
    billingAnchorDay: c.subscriptions?.[0]?.billingAnchorDay || new Date().getDate(), // ✅ v2.46.0: Ler da Subscription ativa
    subscriptions: c.subscriptions, // ✅ v2.46.1: Incluir subscriptions do backend para modal de edição
    vendedorId: c.vendedorId,
    leadId: c.leadId,
    plan: c.plan?.name || 'N/A',
    mrr: c.billingCycle === 'ANNUAL'
      ? (c.plan?.priceMonthly || 0) * 0.9  // ✅ v2.42.2: MRR = priceMonthly com 10% desconto fixo
      : (c.plan?.priceMonthly || 0),
    lastPayment: c.createdAt?.substring(0, 10) || '',
    subscriptionExpiry: c.nextDueDate || 'Sem vencimento', // ✅ v2.39.0: Usar nextDueDate do backend
    healthScore: 100,
    createdAt: c.createdAt?.substring(0, 10) || '',
    updatedAt: c.updatedAt?.substring(0, 10) || '',
    tenant: c.tenant ? {
      id: c.tenant.id,
      system: c.productType,
      vps: c.tenant.vpsLocation || 'N/A',
      url: c.tenant.systemUrl,
      createdAt: c.tenant.createdAt?.substring(0, 10) || '',
      status: c.tenant.status,
      lastAccess: c.tenant.lastAccessAt || 'N/A',
      activeUsers: c.tenant.activeUsers || 0,
      storageUsage: `${c.tenant.storageUsedMb || 0}MB`,
      version: c.tenant.version || 'N/A',
    } : undefined,
  }));

  const [selectedClient, setSelectedClient] = useState<ClientExtended | null>(
    null
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientExtended | null>(null);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [clientToReactivate, setClientToReactivate] = useState<ClientExtended | null>(null);

  // v2.44.0: Query client para invalidação de cache bidirecional
  const queryClient = useQueryClient();

  // Buscar plans do backend para o modal de reativação
  const { data: plansData = [] } = useApiQuery<any[]>(['plans'], '/plans');

  const filteredClients = clients;

  const handleSave = (_client: ClientExtended) => {
    setIsFormOpen(false);
    setEditClient(null);
    setSelectedClient(null);
    refetch();  // ✅ v2.42.2: Invalida cache e refaz query para atualizar tabela
    // v2.44.0: Invalidar caches relacionados para sincronização bidirecional
    queryClient.invalidateQueries({ queryKey: ['finance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/clients/${id}`);
      refetch();
      setSelectedClient(null);
      // v2.44.0: Invalidar caches relacionados para sincronização bidirecional
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); // ✅ v2.50.3: Auto-refresh dashboard
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao excluir cliente';
      alert(`Erro: ${errorMessage}`);
    }
  };

  const productLabel =
    product === ProductType.ONE_NEXUS ? 'One Nexus' : 'Locadoras';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className={`text-lg font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Carregando clientes...
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            Aguarde enquanto buscamos os dados
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1
            className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}
          >
            Clientes {productLabel}
          </h1>
          <p className="text-zinc-500">
            Gerencie todos os assinantes ativos e inativos de {productLabel}.
          </p>
        </div>
        <button
          onClick={() => {
            setEditClient(null);
            setIsFormOpen(true);
          }}
          className="px-4 py-2.5 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-nexus-orange/20"
        >
          <Plus size={20} /> Novo Cliente
        </button>
      </div>

      {/* Table Card */}
      <div
        className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'} border rounded-2xl overflow-hidden transition-all duration-300`}
      >
        <div
          className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex flex-wrap gap-4 items-center justify-between`}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                size={18}
              />
              <input
                type="text"
                placeholder="Pesquisar por clínica, responsável ou tenant ID..."
                className={`w-full border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-nexus-orange transition-all ${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
              />
            </div>
            <button
              className={`p-2 rounded-lg flex items-center gap-2 text-sm px-4 transition-colors ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'}`}
            >
              <Filter size={18} /> Filtros
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Total: {filteredClients.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead
              className={`${isDark ? 'bg-zinc-950/30 text-zinc-500' : 'bg-zinc-50 text-zinc-400'} border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} text-xs font-bold uppercase tracking-wider`}
            >
              <tr>
                <th className="px-6 py-4">Clínica / Tenant</th>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4 text-right">MRR</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}
            >
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className={`transition-colors cursor-pointer group ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-zinc-50'}`}
                  onClick={() => setSelectedClient(client)}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-semibold group-hover:text-nexus-orange transition-colors ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}
                      >
                        {client.company}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[150px]">
                        {client.tenant?.id || 'Sem Tenant'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-400">
                      {client.contactName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-md border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-600'}`}
                    >
                      {client.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-nexus-orange" />
                      <span className="text-xs font-medium text-zinc-500">
                        {!client.subscriptionExpiry || client.subscriptionExpiry === 'Sem vencimento'
                          ? 'Sem vencimento'
                          : formatDateLocal(client.subscriptionExpiry)}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-mono font-bold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}
                  >
                    R$ {(client.mrr || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    {/* Botão Reativar - v2.40.0 */}
                    {(client.status === ClientStatus.CANCELADO ||
                      client.status === ClientStatus.INADIMPLENTE) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClientToReactivate(client);
                          setIsReactivateModalOpen(true);
                        }}
                        className="p-2 text-zinc-500 hover:text-green-500 transition-colors"
                        title="Reativar Cliente"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditClient(client);
                        setIsFormOpen(true);
                      }}
                      className="p-2 text-zinc-500 hover:text-nexus-orange transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Excluir?')) handleDelete(client.id);
                      }}
                      className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          isDark={isDark}
          role={role}
          onClose={() => setSelectedClient(null)}
          onEdit={() => {
            setEditClient(selectedClient);
            setIsFormOpen(true);
          }}
          onDelete={() => handleDelete(selectedClient.id)}
          onImpersonate={onImpersonate}
        />
      )}

      {isFormOpen && (
        <ClientFormModal
          client={editClient}
          productType={product}
          isDark={isDark}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Modal de Reativação - v2.40.0 */}
      {isReactivateModalOpen && clientToReactivate && (
        <ReactivateClientModal
          isOpen={isReactivateModalOpen}
          onClose={() => {
            setIsReactivateModalOpen(false);
            setClientToReactivate(null);
          }}
          client={{
            id: clientToReactivate.id,
            company: clientToReactivate.company,
            contactName: clientToReactivate.contactName,
            status: clientToReactivate.status,
            planId: clientToReactivate.planId,
          }}
          plans={plansData.map((p: any) => ({
            id: p.id,
            name: p.name,
            priceMonthly: p.priceMonthly,
            product: p.product,
          }))}
        />
      )}
    </div>
  );
};
