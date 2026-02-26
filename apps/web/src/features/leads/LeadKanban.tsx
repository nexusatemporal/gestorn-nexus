import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Phone,
  Sparkles,
  Clock,
  X,
  User,
  Building2,
  XCircle,
  MessageSquare,
  Trash2,
  Edit2,
  Settings2,
  ChevronDown,
  TrendingUp,
  UserPlus,
  FileText,
  History,
  Send,
  ChevronUp,
  Briefcase
} from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import {
  useLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useAddInteraction,
  useFunnelStages,
  useCreateFunnelStage,
  useReorderFunnelStages,
  useDeleteFunnelStage,
  useVendedores,
  usePlans,
  useLeadOrigins,
} from './hooks/useLeads';
import type { Lead as ApiLead, FunnelStage } from './types';
import type { CreateLeadDto, UpdateLeadDto, ProductType } from './types';
import { LeadStatus } from './types';
import { CityCombobox } from './components/CityCombobox';
import { ConvertLeadModal } from './components/ConvertLeadModal';
import { LeadScoreBadge } from './components/LeadScoreBadge';
import { leadsApi } from './services/leads.api';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LEADS - Módulo Completo de Pipeline Comercial
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Baseado no modelo de referência gestor-nexus.zip/components/Leads.tsx
 * Implementa Kanban completo com drag-and-drop, gestão de leads, interações,
 * e conversão para clientes.
 */

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface Interaction {
  id: string;
  date: string;
  author: string;
  text: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  clinic: string;
  cnpj?: string;
  role: string;
  numberOfUnits?: number; // ✅ v2.35.0: Número de unidades (era 'units')
  stage: string;
  stageId?: string; // ✅ v2.30.0: UUID for stage relation
  status?: LeadStatus; // Campo para validação de bloqueio (GANHO não pode editar/excluir)
  score: number;
  phone: string;
  city: string;
  interestPlan: string;
  interestPlanId?: string; // ✅ v2.30.0: UUID for plan relation
  origin: string;
  originId?: string; // ✅ v2.30.0: UUID for origin relation
  assignedTo: string;
  vendedorId?: string; // ✅ v2.30.0: UUID for vendedor relation
  daysInStage: number;
  notes: string[];
  interactions: Interaction[];
  instagram?: string;
  facebook?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

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

const LOSS_REASONS = [
  "Preço muito elevado",
  "Falta de funcionalidades chave",
  "Escolheu o concorrente",
  "Projeto cancelado/adiado",
  "Sem retorno do lead",
  "Lead sem perfil (Qualificação)",
  "Outros"
];

// NOTA: VENDEDORES, PLANS, ORIGINS removidos - agora vêm do backend via hooks

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formata telefone para exibição no formato brasileiro
 * @param phone - Telefone com ou sem formatação (11 ou 10 dígitos)
 * @returns Telefone formatado: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
const formatPhoneForDisplay = (phone: string | undefined): string => {
  if (!phone) return '';
  const numbers = phone.replace(/\D/g, '');

  // 11 dígitos (celular): (XX) XXXXX-XXXX
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  // 10 dígitos (fixo): (XX) XXXX-XXXX
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return phone; // Retorna original se não tiver 10/11 dígitos
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS: Role Mapping (Portuguese ↔ Backend Enum)
// ═══════════════════════════════════════════════════════════════════════════

// ✅ v2.30.0: Map frontend role (português) to backend enum (ClientRole)
const mapRoleToApi = (role: string): string => {
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

// ✅ v2.30.0: REVERSE MAP - Backend enum to Portuguese (for displaying in modal)
const mapApiRoleToDisplay = (apiRole: string | undefined): string => {
  if (!apiRole) return ROLES[0]; // Default to first role
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
  return mapping[apiRole] || apiRole; // Return enum as-is if not found
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: RoleTag
// ═══════════════════════════════════════════════════════════════════════════

const RoleTag: React.FC<{ role: string }> = ({ role }) => {
  const roleColors: Record<string, string> = {
    "Sócio ou Fundador": "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    "Presidente ou CEO": "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "Diretor": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Gerente": "bg-green-500/10 text-green-500 border-green-500/20",
    "Recepcionista": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };
  const color = roleColors[role] || "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";

  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${color}`}>
      {role}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: LeadFormModal
// ═══════════════════════════════════════════════════════════════════════════

const LeadFormModal: React.FC<{
  lead: Lead | null;
  isDark: boolean;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  onDelete?: (id: string) => void;
  onConvert?: (lead: Lead) => void;
  onMarkLost?: (lead: Lead, reason: string) => void;
  stages: string[];
  vendedores: Array<{ id: string; name: string; email: string; role: string }>;
  plans: Array<{ id: string; name: string; code: string; product: string; priceMonthly?: number; isActive: boolean }>;
  leadOrigins: Array<{ id: string; name: string; description?: string; isActive: boolean }>;
}> = ({ lead, isDark, onClose, onSave, onDelete, onConvert, onMarkLost, stages, vendedores, plans, leadOrigins }) => {
  const [formData, setFormData] = useState<Partial<Lead>>(
    lead || {
      name: '', email: '', clinic: '', cnpj: '', role: ROLES[0], numberOfUnits: 1, stage: stages[0],
      score: 50, // ✅ v2.34.0: Default score (será substituído pelo score real da API)
      phone: '', city: '',
      interestPlan: plans[0]?.name || '',
      origin: leadOrigins[0]?.name || '',
      assignedTo: vendedores[0]?.name || '',
      daysInStage: 0, notes: [], interactions: [],
      instagram: '', facebook: ''
    }
  );
  const [newNote, setNewNote] = useState('');
  const [showLossReason, setShowLossReason] = useState(false);
  const addInteractionMutation = useAddInteraction();
  const isExistingLead = !!(lead?.id && lead.id.startsWith('cm'));
  const [selectedLossReason, setSelectedLossReason] = useState(LOSS_REASONS[0]);

  // Estado de erros de validação
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estado para alerta de CNPJ duplicado
  const [cnpjWarning, setCnpjWarning] = useState<{
    show: boolean;
    type: 'CLIENT' | 'LEAD' | null;
    record?: {
      id: string;
      name: string;
      cnpj: string;
      assignedTo: string;
    };
    message: string;
  }>({ show: false, type: null, message: '' });

  // ✅ v2.35.0: FIX - Sincronizar formData quando prop 'lead' mudar
  // Problema: useState só executa na montagem inicial. Se lead mudar (null → lead selecionado),
  // o formData não era atualizado, então campos como instagram/facebook ficavam vazios no modal de edição.
  useEffect(() => {
    if (lead) {
      // ✅ v2.37.2: Aplicar formatação de telefone ao carregar lead para edição
      setFormData({
        ...lead,
        phone: formatPhoneForDisplay(lead.phone), // Formata telefone para exibição
      });
    } else {
      // Modal de criação: valores padrão
      setFormData({
        name: '', email: '', clinic: '', cnpj: '', role: ROLES[0], numberOfUnits: 1, stage: stages[0],
        score: 50,
        phone: '', city: '',
        interestPlan: plans[0]?.name || '',
        origin: leadOrigins[0]?.name || '',
        assignedTo: vendedores[0]?.name || '',
        daysInStage: 0, notes: [], interactions: [],
        instagram: '', facebook: ''
      });
    }
  }, [lead]); // Reexecutar quando 'lead' mudar

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Nome completo
    if (!formData.name || formData.name.trim().length < 3) {
      newErrors.name = 'Nome deve ter no mínimo 3 caracteres';
    }

    // Email
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Telefone
    if (!formData.phone || formData.phone.trim().length < 10) {
      newErrors.phone = 'Telefone inválido (mínimo 10 dígitos)';
    }

    // Cargo
    if (!formData.role || formData.role.trim().length === 0) {
      newErrors.role = 'Cargo é obrigatório';
    }

    // Nome da clínica
    if (!formData.clinic || formData.clinic.trim().length < 2) {
      newErrors.clinic = 'Nome da clínica é obrigatório';
    }

    // CNPJ - v2.33.0: Validar 14 dígitos (após remover formatação)
    const cnpjNumbers = formData.cnpj ? formData.cnpj.replace(/\D/g, '') : '';
    if (cnpjNumbers.length !== 14) {
      newErrors.cnpj = 'CNPJ deve ter 14 dígitos';
    }

    // Número de unidades
    if (!formData.numberOfUnits || formData.numberOfUnits < 1) {
      newErrors.numberOfUnits = 'Número de unidades deve ser no mínimo 1';
    }

    // Plano de interesse
    if (!formData.interestPlan || formData.interestPlan.trim().length === 0) {
      newErrors.interestPlan = 'Selecione um plano de interesse';
    }

    // Vendedor responsável
    if (!formData.assignedTo || formData.assignedTo.trim().length === 0) {
      newErrors.assignedTo = 'Vendedor responsável é obrigatório';
    }

    // Origem do lead
    if (!formData.origin || formData.origin.trim().length === 0) {
      newErrors.origin = 'Origem do lead é obrigatória';
    }

    // ✅ v2.33.1: Bloquear se CNPJ duplicado
    if (cnpjWarning.show) {
      newErrors.cnpj = '⚠️ CNPJ já cadastrado no sistema';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ v2.33.0: Formatar CNPJ enquanto digita (xx.xxx.xxx/xxxx-xx)
  const formatCnpj = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Limita a 14 dígitos
    const limited = numbers.slice(0, 14);

    // Aplica máscara: xx.xxx.xxx/xxxx-xx
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    if (limited.length <= 12) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`;
  };

  // ✅ v2.37.0: Formatar Telefone/WhatsApp enquanto digita
  // Suporta celular (11 dígitos) e fixo (10 dígitos)
  const formatPhone = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Limita a 11 dígitos (celular) ou 10 (fixo)
    const limited = numbers.slice(0, 11);

    // Telefone com 10 dígitos (fixo): (XX) XXXX-XXXX
    if (limited.length <= 10) {
      if (limited.length <= 2) return limited;
      if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
    }

    // Telefone com 11 dígitos (celular): (XX) XXXXX-XXXX
    if (limited.length <= 2) return limited;
    if (limited.length <= 7) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  };

  // ✅ v2.33.1: Validação preventiva de CNPJ duplicado (SEM alerta visual)
  const handleCnpjBlur = async (cnpj: string | undefined) => {
    // Limpar warning anterior
    setCnpjWarning({ show: false, type: null, message: '' });

    // Extrair apenas números
    const cnpjNumbers = cnpj ? cnpj.replace(/\D/g, '') : '';

    // Validar apenas se CNPJ tiver 14 dígitos
    if (cnpjNumbers.length !== 14) {
      return;
    }

    try {
      // Enviar apenas números para backend
      const response = await leadsApi.checkDuplicateCnpj(cnpjNumbers);

      if (response.exists) {
        setCnpjWarning({
          show: true,
          type: response.type || null,
          record: response.record,
          message: '⚠️ CNPJ já cadastrado no sistema',
        });
      }
    } catch (error) {
      // Validação silenciosa - não mostrar erro ao usuário
    }
  };

  const handleAddInteraction = () => {
    if (!newNote.trim()) return;

    if (isExistingLead && lead?.id) {
      addInteractionMutation.mutate(
        { leadId: lead.id, content: newNote.trim() },
        {
          onSuccess: (data: any) => {
            const interaction: Interaction = {
              id: data.id,
              date: new Date(data.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
              author: data.user?.name || 'Eu',
              text: data.content,
            };
            setFormData({
              ...formData,
              interactions: [interaction, ...(formData.interactions || [])],
            });
            setNewNote('');
          },
        },
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar antes de salvar
    if (!validateForm()) {
      // Scroll to first error (opcional)
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    onSave({ ...formData, id: lead?.id || Date.now().toString() } as Lead);
  };

  const handleLostSubmit = () => {
    if (lead) {
      onMarkLost?.(lead, selectedLossReason);
      setShowLossReason(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-2xl'} border w-full max-w-6xl h-[92vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col`}>

        {/* Header */}
        <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30`}>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-nexus-orange/10 rounded-xl text-nexus-orange">
                <Briefcase size={24} />
             </div>
             <div>
                <h2 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-zinc-900'}`}>{lead ? 'Ficha do Lead' : 'Cadastrar Nova Oportunidade'}</h2>
                <p className="text-xs text-zinc-500 font-medium tracking-wide">ID: {formData.id || 'NOVO'}</p>
             </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-700 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"><X size={20}/></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Form Area */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
            <form id="leadForm" onSubmit={handleSubmit} className="space-y-10">

              {/* Seção 1: Dados Pessoais & Contato */}
              <section>
                <div className="flex items-center gap-2 mb-6 border-b border-zinc-800/10 dark:border-zinc-800 pb-2">
                  <User size={16} className="text-nexus-orange" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Responsável & Contato</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">
                      Nome Completo
                    </label>
                    <input
                      required
                      name="name"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.name
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.name}
                      onChange={e => {
                        setFormData({...formData, name: e.target.value});
                        if (errors.name) setErrors({...errors, name: ''});
                      }}
                      placeholder="Ex: João da Silva"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      name="email"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.email
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.email}
                      onChange={e => {
                        setFormData({...formData, email: e.target.value});
                        if (errors.email) setErrors({...errors, email: ''});
                      }}
                      placeholder="joao@clinica.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      required
                      name="phone"
                      type="tel"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.phone
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.phone}
                      onChange={e => {
                        // ✅ v2.37.0: Aplicar máscara automaticamente
                        const formatted = formatPhone(e.target.value);
                        setFormData({...formData, phone: formatted});
                        if (errors.phone) setErrors({...errors, phone: ''});
                      }}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.phone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Instagram</label>
                    <input className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`} value={formData.instagram || ''} onChange={e => setFormData({...formData, instagram: e.target.value})} placeholder="@usuario" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Facebook</label>
                    <input className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`} value={formData.facebook || ''} onChange={e => setFormData({...formData, facebook: e.target.value})} placeholder="usuario.facebook" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Cargo</label>
                    <select
                      required
                      name="role"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.role
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.role}
                      onChange={e => {
                        setFormData({...formData, role: e.target.value});
                        if (errors.role) setErrors({...errors, role: ''});
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {errors.role && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.role}
                      </p>
                    )}
                  </div>
                  <CityCombobox
                    value={formData.city || ''}
                    onChange={(value) => {
                      setFormData({ ...formData, city: value });
                    }}
                    isDark={isDark}
                  />
                </div>
              </section>

              {/* Seção 2: Dados da Empresa */}
              <section>
                <div className="flex items-center gap-2 mb-6 border-b border-zinc-800/10 dark:border-zinc-800 pb-2">
                  <Building2 size={16} className="text-nexus-orange" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Dados da Clínica / Empresa</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">
                      Nome da Clínica
                    </label>
                    <input
                      required
                      name="clinic"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.clinic
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.clinic}
                      onChange={e => {
                        setFormData({...formData, clinic: e.target.value});
                        if (errors.clinic) setErrors({...errors, clinic: ''});
                      }}
                      placeholder="Ex: Clínica Estética Bella Vita"
                    />
                    {errors.clinic && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.clinic}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">CNPJ</label>
                    <input
                      required
                      name="cnpj"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.cnpj
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.cnpj}
                      onChange={e => {
                        // ✅ v2.33.1: Aplicar máscara automaticamente
                        const formatted = formatCnpj(e.target.value);
                        setFormData({...formData, cnpj: formatted});
                        if (errors.cnpj) setErrors({...errors, cnpj: ''});
                        if (cnpjWarning.show) setCnpjWarning({ show: false, type: null, message: '' });
                      }}
                      onBlur={e => handleCnpjBlur(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      maxLength={18}
                    />
                    {errors.cnpj && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        {errors.cnpj}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Número de Unidades</label>
                    <input
                      required
                      type="number"
                      min="1"
                      name="numberOfUnits"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.numberOfUnits
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.numberOfUnits}
                      onChange={e => {
                        setFormData({...formData, numberOfUnits: parseInt(e.target.value) || 1});
                        if (errors.numberOfUnits) setErrors({...errors, numberOfUnits: ''});
                      }}
                    />
                    {errors.numberOfUnits && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.numberOfUnits}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Seção 3: Pipeline & Comercial */}
              <section>
                <div className="flex items-center gap-2 mb-6 border-b border-zinc-800/10 dark:border-zinc-800 pb-2">
                  <TrendingUp size={16} className="text-nexus-orange" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Informações Comerciais</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Estágio Atual</label>
                    <select
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                      value={formData.stage}
                      onChange={e => {
                        // ✅ CORREÇÃO v2.24.0: Interceptar mudança para "Ganho" e abrir modal de trava inteligente
                        if (e.target.value === 'Ganho' && lead?.id && onConvert) {
                          e.preventDefault();
                          onConvert({ ...formData, id: lead.id } as Lead);
                          return;
                        }
                        setFormData({...formData, stage: e.target.value});
                      }}
                    >
                      {stages.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="Ganho">Ganho (Convertido)</option>
                      <option value="Perdido">Perdido</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">
                      Interesse em Plano
                    </label>
                    <select
                      required
                      name="interestPlan"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.interestPlan
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.interestPlan}
                      onChange={e => {
                        setFormData({...formData, interestPlan: e.target.value});
                        if (errors.interestPlan) setErrors({...errors, interestPlan: ''});
                      }}
                    >
                      {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    {errors.interestPlan && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.interestPlan}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Vendedor Responsável</label>
                    <select
                      required
                      name="assignedTo"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.assignedTo
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.assignedTo}
                      onChange={e => {
                        setFormData({...formData, assignedTo: e.target.value});
                        if (errors.assignedTo) setErrors({...errors, assignedTo: ''});
                      }}
                    >
                      {vendedores.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                    {errors.assignedTo && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.assignedTo}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase ml-1">Origem do Lead</label>
                    <select
                      required
                      name="origin"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${
                        errors.origin
                          ? 'border-red-500 bg-red-500/5'
                          : isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'
                      }`}
                      value={formData.origin}
                      onChange={e => {
                        setFormData({...formData, origin: e.target.value});
                        if (errors.origin) setErrors({...errors, origin: ''});
                      }}
                    >
                      {leadOrigins.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                    </select>
                    {errors.origin && (
                      <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1">
                        <span>⚠️</span>
                        {errors.origin}
                      </p>
                    )}
                  </div>

                  {/* IA SCORE VISUAL */}
                  <div className={`p-4 rounded-2xl border flex flex-col justify-center gap-2 ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-nexus-orange">
                         <Sparkles size={16} className="animate-pulse" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Lead Score IA</span>
                      </div>
                      <span className={`text-xl font-black ${formData.score && formData.score > 70 ? 'text-green-500' : 'text-yellow-500'}`}>{formData.score}%</span>
                    </div>
                    <div className="w-full bg-zinc-700/30 h-2 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-1000 ${formData.score && formData.score > 70 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${formData.score}%` }}></div>
                    </div>
                    <p className="text-[9px] text-zinc-500 italic text-center">Baseado no perfil do sócio e volume de unidades.</p>
                  </div>
                </div>
              </section>
            </form>
          </div>

          {/* Sidebar: History & Notes */}
          <aside className={`w-[400px] border-l flex flex-col overflow-hidden ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-200'}`}>
            <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} bg-zinc-900/10`}>
              <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <History size={16} className="text-nexus-orange"/> Linha do Tempo
              </h3>
              <div className="space-y-3">
                <textarea
                  className={`w-full rounded-2xl p-4 text-xs border h-28 outline-none focus:ring-2 focus:ring-nexus-orange/20 transition-all resize-none shadow-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  placeholder="Descreva o que aconteceu no último contato..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddInteraction}
                  disabled={!isExistingLead || addInteractionMutation.isPending}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                    isExistingLead
                      ? 'bg-nexus-orange text-white hover:bg-nexus-orangeDark shadow-nexus-orange/10'
                      : 'bg-zinc-700 text-zinc-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Send size={14}/> {addInteractionMutation.isPending ? 'Salvando...' : 'Registrar Interação'}
                </button>
                {!isExistingLead && (
                  <p className="text-[10px] text-zinc-500 text-center">Salve o lead primeiro para registrar interações</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
               {(formData.interactions || []).length > 0 ? (
                 (formData.interactions || []).map(it => (
                    <div key={it.id} className={`p-4 rounded-2xl border relative animate-in slide-in-from-right-4 duration-300 ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-nexus-orange uppercase">{it.author}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{it.date}</span>
                      </div>
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{it.text}</p>
                    </div>
                  ))
               ) : (
                 <div className="flex flex-col items-center justify-center h-48 opacity-30 italic text-zinc-500 text-center">
                    <MessageSquare size={32} className="mb-2" />
                    <p className="text-xs">Nenhuma interação registrada ainda.</p>
                 </div>
               )}
            </div>
          </aside>
        </div>

        {/* Footer Actions */}
        <div className={`p-8 border-t flex flex-wrap gap-4 items-center justify-between ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
          <div className="flex gap-4">
            {lead && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (lead?.status === LeadStatus.GANHO) {
                      alert('❌ Não é possível excluir Lead convertido. Mova para PERDIDO primeiro.');
                      return;
                    }
                    onDelete?.(lead.id);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-all rounded-xl text-zinc-500 hover:text-red-500 bg-red-500/0 hover:bg-red-500/10"
                >
                  <Trash2 size={18}/> Excluir Lead
                </button>
                <button type="button" onClick={() => setShowLossReason(true)} className="flex items-center gap-2 px-4 py-2.5 text-zinc-500 hover:text-orange-500 font-bold text-sm transition-all bg-orange-500/0 hover:bg-orange-500/10 rounded-xl">
                  <XCircle size={18}/> Marcar Perdido
                </button>
              </>
            )}
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-zinc-500 text-sm font-bold hover:text-zinc-900 transition-colors">Cancelar</button>
            {lead && lead.stage !== 'Ganho' && (
              <button
                type="button"
                onClick={() => onConvert?.(lead)}
                className="px-8 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all shadow-xl shadow-green-600/20 flex items-center gap-2 active:scale-95"
              >
                <UserPlus size={18} /> Converter em Cliente
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (lead?.status === LeadStatus.GANHO) {
                  alert('❌ Não é possível editar Lead convertido. Mova para PERDIDO primeiro.');
                  return;
                }
                // Disparar submit do form manualmente
                const form = document.getElementById('leadForm') as HTMLFormElement;
                if (form) form.requestSubmit();
              }}
              className="px-10 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl bg-nexus-orange text-white hover:bg-nexus-orangeDark shadow-nexus-orange/20 active:scale-95"
            >
              {lead ? 'Salvar Ficha' : 'Criar Lead'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal para Motivo de Perda */}
      {showLossReason && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
           <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl`}>
             <div className="p-6 border-b dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-red-500 flex items-center gap-2"><XCircle size={18}/> Motivo da Perda</h3>
                <button onClick={() => setShowLossReason(false)} className="text-zinc-500"><X size={20}/></button>
             </div>
             <div className="p-6 space-y-4">
                <p className="text-xs text-zinc-500">Por que esta oportunidade não foi concretizada?</p>
                <select
                  className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-red-500/20 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
                  value={selectedLossReason}
                  onChange={e => setSelectedLossReason(e.target.value)}
                >
                  {LOSS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
             </div>
             <div className="p-6 pt-0 flex gap-3">
                <button onClick={() => setShowLossReason(false)} className="flex-1 py-2 text-zinc-500 text-sm font-bold">Cancelar</button>
                <button onClick={handleLostSubmit} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-600/20">Confirmar Perda</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: StageManager
// ═══════════════════════════════════════════════════════════════════════════

const StageManager: React.FC<{
  stages: string[];
  funnelStages: FunnelStage[];
  isDark: boolean;
  onClose: () => void;
  onSave: (stages: string[]) => void;
}> = ({ stages, funnelStages, isDark, onClose, onSave }) => {
  const [currentStages, setCurrentStages] = useState([...stages]);
  const [newStageName, setNewStageName] = useState('');

  // Mutations para CRUD de estágios
  const createMutation = useCreateFunnelStage();
  const deleteMutation = useDeleteFunnelStage();

  // CORREÇÃO: Sincronizar currentStages quando stages (prop) mudar
  useEffect(() => {
    setCurrentStages([...stages]);
  }, [stages]);

  const handleAdd = () => {
    if (!newStageName.trim()) {
      window.alert('⚠️ Digite um nome para o estágio.');
      return;
    }

    // Verificar se já existe estágio com esse nome (case-insensitive)
    const exists = funnelStages.some(
      s => s.name.toLowerCase() === newStageName.trim().toLowerCase()
    );

    if (exists) {
      window.alert('⚠️ Já existe um estágio com esse nome.');
      return;
    }

    // Calcular próxima ordem (maior ordem atual + 1)
    const maxOrder = Math.max(...funnelStages.map(s => s.order), 0);

    // Criar estágio via API
    createMutation.mutate(
      {
        name: newStageName.trim(),
        order: maxOrder + 1,
        color: '#FF7300', // Cor padrão Nexus orange
        isActive: true,
      },
      {
        onSuccess: () => {
          setNewStageName('');
          // currentStages será atualizado automaticamente via invalidateQueries
        },
        onError: () => {
          window.alert('❌ Erro ao adicionar estágio. Verifique se o nome já existe.');
        },
      }
    );
  };

  const handleRemove = (stageName: string) => {
    // Encontrar estágio no backend
    const stage = funnelStages.find(s => s.name === stageName);

    if (!stage) {
      window.alert('⚠️ Estágio não encontrado.');
      return;
    }

    // Verificar se há leads vinculados
    if (stage._count && stage._count.leads > 0) {
      window.alert(
        `⚠️ Não é possível remover estágio com ${stage._count.leads} lead(s) vinculado(s).\n\n` +
        `Mova os leads para outro estágio antes de remover.`
      );
      return;
    }

    // Confirmação do usuário
    if (!window.confirm(`🗑️ Tem certeza que deseja remover o estágio "${stageName}"?`)) {
      return;
    }

    // Deletar estágio via API
    deleteMutation.mutate(stage.id, {
      onSuccess: () => {
        // currentStages será atualizado automaticamente via invalidateQueries
      },
      onError: () => {
        window.alert('❌ Erro ao remover estágio. Pode haver leads vinculados.');
      },
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newStages = [...currentStages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    // Swap positions
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    setCurrentStages(newStages);
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95`}>
        <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex justify-between items-center`}>
          <h2 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'} flex items-center gap-2`}>
            <Settings2 size={18} className="text-nexus-orange" /> Configurar Pipeline
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"><X size={20}/></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex gap-2">
            <input
              placeholder="Nome do novo estágio..."
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300'}`}
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} className="p-2.5 bg-nexus-orange text-white rounded-xl hover:bg-nexus-orangeDark transition-all shadow-lg shadow-nexus-orange/20 active:scale-95">
              <Plus size={24}/>
            </button>
          </div>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
            {currentStages.map((stage, idx) => (
              <div key={stage} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isDark ? 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 hover:bg-white hover:shadow-sm'}`}>
                <div className="flex flex-col gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    className="text-zinc-500 hover:text-nexus-orange disabled:opacity-20 disabled:hover:text-zinc-500 transition-colors"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    disabled={idx === currentStages.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    className="text-zinc-500 hover:text-nexus-orange disabled:opacity-20 disabled:hover:text-zinc-500 transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span className={`text-sm font-bold flex-1 ${isDark ? 'text-zinc-100' : 'text-zinc-700'}`}>{stage}</span>
                <button onClick={() => handleRemove(stage)} className="text-zinc-400 hover:text-red-500 p-2 transition-colors">
                  <Trash2 size={18}/>
                </button>
              </div>
            ))}
            {currentStages.length === 0 && <p className="text-center py-10 text-zinc-500 italic text-xs">Nenhum estágio definido.</p>}
          </div>
        </div>
        <div className={`p-6 border-t flex gap-4 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
          <button onClick={onClose} className="flex-1 py-3 text-zinc-500 text-sm font-bold hover:text-zinc-900 transition-colors">Cancelar</button>
          <button onClick={() => onSave(currentStages)} className="flex-1 py-3 bg-nexus-orange text-white rounded-xl text-sm font-bold hover:bg-nexus-orangeDark transition-all shadow-lg shadow-nexus-orange/20 active:scale-95">Salvar Configurações</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS: Stage Utilities
// ═══════════════════════════════════════════════════════════════════════════

// NOTA: mapApiStatusToStage() foi REMOVIDO (v2.23.0)
// Motivo: Leads agora usam stageId do backend, não mapeamento hardcodado de status
// Agora enviamos stageId diretamente ao invés de status
// (FASE 2 - Integração com FunnelStages backend)

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: LeadKanban
// ═══════════════════════════════════════════════════════════════════════════

export function LeadKanban() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  // API Data
  const { data: apiLeads = [], isLoading } = useLeads();
  const { data: funnelStages = [] } = useFunnelStages();
  const { data: vendedores = [] } = useVendedores();
  const { data: plans = [] } = usePlans();
  const { data: leadOrigins = [] } = useLeadOrigins();
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const deleteMutation = useDeleteLead();
  // ✅ REMOVIDO v2.24.0: convertMutation não é mais usado (conversão via modal)
  const reorderMutation = useReorderFunnelStages();

  // Map API leads to frontend structure
  const leads: Lead[] = useMemo(() => {
    // Encontrar estágio padrão (fallback se lead não tiver stage)
    const defaultStage = funnelStages.find(s => s.isDefault) || funnelStages[0];

    return apiLeads.map((apiLead: ApiLead) => ({
      id: apiLead.id,
      name: apiLead.name,
      email: apiLead.email,
      clinic: apiLead.companyName || apiLead.name,
      cnpj: apiLead.cpfCnpj,
      // ✅ v2.30.0: Convert backend enum (CEO_PRESIDENTE) to Portuguese display (Presidente ou CEO)
      role: mapApiRoleToDisplay(apiLead.role),
      numberOfUnits: apiLead.numberOfUnits || 1, // ✅ v2.35.0: Número de unidades
      instagram: apiLead.instagram || '', // ✅ v2.37.0: FIX - Include Instagram field
      facebook: apiLead.facebook || '', // ✅ v2.37.0: FIX - Include Facebook field
      // ✅ CORREÇÃO v2.24.0: Priorizar status GANHO/PERDIDO sobre stage
      // Leads finais (GANHO/PERDIDO) usam campo status, não stageId
      stage: (apiLead as any).status === 'GANHO' ? 'Ganho' :
             (apiLead as any).status === 'PERDIDO' ? 'Perdido' :
             apiLead.stage?.name || defaultStage?.name || 'Novo',
      stageId: apiLead.stageId || defaultStage?.id, // ✅ Adicionar stageId para filtros
      score: apiLead.score || 0,
      phone: apiLead.phone,
      city: apiLead.city || 'N/A',
      // ✅ v2.30.0: Preserve IDs for dropdown matching in edit modal
      interestPlan: apiLead.interestPlan?.name || 'N/A',
      interestPlanId: apiLead.interestPlan?.id, // ✅ NEW: Preserve plan ID
      origin: typeof apiLead.origin === 'string' ? apiLead.origin : (apiLead.origin?.name || 'N/A'),
      originId: typeof apiLead.origin === 'object' ? apiLead.origin?.id : undefined, // ✅ NEW: Preserve origin ID
      assignedTo: apiLead.vendedor?.name || 'N/A',
      vendedorId: apiLead.vendedor?.id, // ✅ NEW: Preserve vendedor ID
      daysInStage: 0, // Calculado posteriormente se necessário
      notes: apiLead.notes ? [apiLead.notes] : [],
      interactions: (apiLead as any).interactions?.map((it: any) => ({
        id: it.id,
        date: new Date(it.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        author: it.user?.name || 'Sistema',
        text: it.content,
      })) || []
    }));
  }, [apiLeads, funnelStages]);

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGES: Carregar do backend via API (não mais localStorage)
  // ═══════════════════════════════════════════════════════════════════════════
  const stages = useMemo(() => {
    return funnelStages
      .filter(stage => stage.isActive)
      .sort((a, b) => a.order - b.order)
      .map(stage => stage.name);
  }, [funnelStages]);

  const [viewType, setViewType] = useState<'kanban' | 'list'>('kanban');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedLeadToConvert, setSelectedLeadToConvert] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.clinic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.cnpj && l.cnpj.includes(searchQuery))
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // v2.31.0: Helper function to dynamically get conversion-eligible stages
  // Shows conversion button in LAST 2 ACTIVE STAGES (instead of hardcoded names)
  // ═══════════════════════════════════════════════════════════════════════════
  const conversionEligibleStageIds = useMemo(() => {
    return funnelStages
      .filter(s => s.isActive) // Only active stages
      .sort((a, b) => b.order - a.order) // Sort by order descending (highest first)
      .slice(0, 2) // Take last 2 stages
      .map(s => s.id); // Return array of stage IDs
  }, [funnelStages]);

  const handleSaveLead = (lead: Lead) => {
    // ✅ v2.30.0: mapRoleToApi() and mapApiRoleToDisplay() moved to top of file

    // Infer product type from plan name
    const inferProductType = (planName: string): ProductType => {
      if (planName.toLowerCase().includes('one nexus')) {
        return 'ONE_NEXUS' as ProductType;
      }
      if (planName.toLowerCase().includes('locadoras')) {
        return 'LOCADORAS' as ProductType;
      }
      return 'ONE_NEXUS' as ProductType; // Default
    };

    // Map names to UUIDs for backend
    const vendedorId = vendedores.find(v => v.name === lead.assignedTo)?.id;
    const planId = plans.find(p => p.name === lead.interestPlan)?.id;
    const originId = leadOrigins.find(o => o.name === lead.origin)?.id;

    // Check if it's a create or update
    // New leads have temporary IDs (timestamp numbers) or no ID
    // Real API leads have CUIDs starting with 'cm'
    const isNewLead = !lead.id || !lead.id.startsWith('cm');

    if (isNewLead) {
      // CREATE
      const payload: CreateLeadDto = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone || '',
        cpfCnpj: lead.cnpj,
        companyName: lead.clinic,
        city: lead.city,
        role: mapRoleToApi(lead.role) as any,
        numberOfUnits: lead.numberOfUnits || 1, // ✅ v2.35.0: Número de unidades
        interestProduct: inferProductType(lead.interestPlan),
        notes: lead.notes.join('\n'),
        // Enviar apenas 'origin' (string) para CREATE - backend vai buscar/criar LeadOrigin
        origin: lead.origin,
        // ✅ v2.30.0: FIX #2 - Include vendedorId and interestPlanId so backend doesn't default to currentUserId
        vendedorId: vendedorId, // Send selected vendedor UUID (not undefined)
        interestPlanId: planId, // Send selected plan UUID (not undefined)
        // ✅ v2.35.0: FIX - Include instagram and facebook fields
        instagram: lead.instagram || undefined,
        facebook: lead.facebook || undefined,
      };

      createMutation.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          setSelectedLead(null);
        },
        onError: (error: any) => {
          alert(`Erro ao criar lead: ${error.response?.data?.message || 'Erro desconhecido'}`);
        },
      });
    } else {
      // UPDATE
      const stage = funnelStages.find(s => s.name === lead.stage);

      const payload: UpdateLeadDto = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        cpfCnpj: lead.cnpj,
        companyName: lead.clinic,
        city: lead.city,
        role: mapRoleToApi(lead.role) as any,
        numberOfUnits: lead.numberOfUnits || 1, // ✅ v2.35.0: Número de unidades
        interestProduct: inferProductType(lead.interestPlan),
        notes: lead.notes.join('\n'),
        stageId: stage?.id,
        // ✅ CORREÇÃO: Enviar UUIDs ao invés de strings
        vendedorId: vendedorId,
        interestPlanId: planId,
        originId: originId,
        // ✅ v2.35.0: FIX - Include instagram and facebook fields
        instagram: lead.instagram || undefined,
        facebook: lead.facebook || undefined,
      };

      updateMutation.mutate(
        { id: lead.id, payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setSelectedLead(null);
          },
          onError: (error: any) => {
            alert(`Erro ao atualizar lead: ${error.response?.data?.message || 'Erro desconhecido'}`);
          },
        }
      );
    }
  };

  const handleDeleteLead = (id: string) => {
    if (confirm('Tem certeza que deseja remover este lead definitivamente?')) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          setIsModalOpen(false);
          setSelectedLead(null);
        },
      });
    }
  };

  // ✅ REMOVIDO v2.24.0: handleConvertLead() não é mais usado
  // Conversão agora sempre usa modal de trava inteligente (ConvertLeadModal)

  const handleMarkLost = (lead: Lead, reason: string) => {
    updateMutation.mutate(
      {
        id: lead.id,
        payload: {
          status: 'PERDIDO' as any,
          notes: `MARCADO COMO PERDIDO. Motivo: ${reason}`,
        },
      },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setSelectedLead(null);
        },
      }
    );
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');

    // FASE 2: Buscar stageId do backend ao invés de usar mapping hardcoded
    const stage = funnelStages.find(s => s.name === targetStage);

    if (!stage) {
      return;
    }

    // Enviar stageId diretamente ao invés de status
    updateMutation.mutate({
      id: leadId,
      payload: { stageId: stage.id },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nexus-orange mx-auto mb-4"></div>
          <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Pipeline Comercial</h1>
          <p className="text-zinc-500 font-medium">Gerenciamento de leads e oportunidades da Nexus Atemporal.</p>
        </div>
        <div className="flex gap-4">
           <button
             onClick={() => setIsStageManagerOpen(true)}
             className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border-zinc-200 text-zinc-500 hover:text-nexus-orange shadow-sm'}`}
             title="Configurar Pipeline"
           >
             <Settings2 size={20} />
           </button>
           <div className={`flex border rounded-xl p-1 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
             <button onClick={() => setViewType('kanban')} className={`p-2 rounded-lg transition-all ${viewType === 'kanban' ? 'bg-nexus-orange text-white shadow-sm' : 'text-zinc-500 hover:text-nexus-orange'}`} title="Vista Kanban"><LayoutGrid size={18} /></button>
             <button onClick={() => setViewType('list')} className={`p-2 rounded-lg transition-all ${viewType === 'list' ? 'bg-nexus-orange text-white shadow-sm' : 'text-zinc-500 hover:text-nexus-orange'}`} title="Vista em Lista"><ListIcon size={18} /></button>
           </div>
           <button
            onClick={() => { setSelectedLead(null); setIsModalOpen(true); }}
            className="px-5 py-2.5 bg-nexus-orange hover:bg-nexus-orangeDark text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xl shadow-nexus-orange/20 transition-all active:scale-95"
          >
            <Plus size={22} /> Novo Lead
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-4 border p-4 rounded-2xl transition-all ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
        <div className="relative max-w-md flex-1">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
           <input
              type="text"
              placeholder="Buscar por nome, clínica ou CNPJ..."
              className={`w-full border-none rounded-xl py-2.5 pl-12 text-sm focus:ring-2 focus:ring-nexus-orange/20 outline-none transition-all ${isDark ? 'bg-zinc-800 text-white placeholder:text-zinc-500' : 'bg-zinc-100 text-zinc-900'}`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
           />
        </div>
        <div className="hidden lg:flex items-center gap-6 ml-auto pr-4">
           <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Leads em Prospecção</p>
              <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{leads.filter(l => l.stage !== 'Ganho' && l.stage !== 'Perdido').length}</p>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {viewType === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-6 h-full items-start scroll-smooth scrollbar-thin">
            {stages.map(stage => (
              <div key={stage} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, stage)} className="min-w-[320px] w-[320px] flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-black text-xs uppercase tracking-widest ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{stage}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'}`}>
                      {filteredLeads.filter(l => l.stage === stage).length}
                    </span>
                  </div>
                </div>
                <div className={`flex-1 border border-dashed rounded-3xl p-3 space-y-3 overflow-y-auto transition-colors scrollbar-thin ${isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  {filteredLeads.filter(l => l.stage === stage).map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={e => handleDragStart(e, lead.id)}
                      onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                      className={`${isDark ? 'bg-zinc-800 border-zinc-700 hover:border-nexus-orange/50' : 'bg-white border-zinc-200 hover:border-nexus-orange shadow-sm'} p-5 rounded-2xl transition-all cursor-grab active:cursor-grabbing group shadow-md animate-in slide-in-from-top-4 duration-300 border`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="overflow-hidden flex-1">
                          <span className={`font-bold text-sm block group-hover:text-nexus-orange transition-colors truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{lead.name}</span>
                          <span className="text-[10px] text-zinc-500 font-medium truncate block">{lead.clinic}</span>
                        </div>
                        <LeadScoreBadge score={lead.score} showTooltip={false} />
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <RoleTag role={lead.role} />
                      </div>

                      {lead.cnpj && (
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] text-zinc-500 font-medium">
                          <FileText size={12} className="text-zinc-600"/> {lead.cnpj}
                        </div>
                      )}

                      <div className={`flex flex-col gap-2 mt-4 border-t pt-4 ${isDark ? 'border-zinc-700' : 'border-zinc-100'}`}>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-bold"><Phone size={12} className="text-nexus-orange"/> {lead.phone}</div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex flex-col">
                             <span className="text-[9px] text-zinc-400 font-bold uppercase">Resp: {lead.assignedTo.split(' ')[0]}</span>
                             <span className="text-[9px] text-zinc-500 flex items-center gap-1 font-medium mt-0.5"><Clock size={10} /> {lead.daysInStage} dias</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* v2.31.0: Dynamic conversion button - shows in LAST 2 ACTIVE STAGES or if score >= 60 */}
                            {(lead.score >= 60 || (lead.stageId && conversionEligibleStageIds.includes(lead.stageId))) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const apiLead = apiLeads.find((l: ApiLead) => l.id === lead.id);

                                  // ✅ v2.29.0: Enriquecer apiLead com fallback local para interestPlanId
                                  const enrichedLead = {
                                    ...apiLead,
                                    interestPlanId: apiLead?.interestPlanId ||
                                                    plans.find(p => p.name === lead.interestPlan)?.id,
                                    interestPlan: apiLead?.interestPlan ||
                                                  plans.find(p => p.name === lead.interestPlan),
                                  };

                                  setSelectedLeadToConvert(enrichedLead);
                                  setIsConvertModalOpen(true);
                                }}
                                className="px-2 py-1 text-[9px] font-bold bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors flex items-center gap-1"
                                title="Converter em Cliente"
                              >
                                Converter
                              </button>
                            )}
                            <img src={`https://picsum.photos/seed/${lead.assignedTo}/32/32`} className="w-6 h-6 rounded-full ring-2 ring-nexus-orange/30" title={lead.assignedTo} alt={lead.assignedTo} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredLeads.filter(l => l.stage === stage).length === 0 && (
                     <div className="flex items-center justify-center h-24 text-[10px] text-zinc-500 italic opacity-40">Sem leads nesta fase</div>
                  )}
                </div>
              </div>
            ))}

            {/* Coluna Ganhos */}
            <div className="min-w-[280px] w-[280px] flex flex-col gap-4 opacity-50">
               <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-green-600 px-3">Ganhos (Convertidos)</h3>
               <div className={`flex-1 border border-dashed rounded-3xl p-3 space-y-3 overflow-y-auto scrollbar-thin ${isDark ? 'bg-green-900/5 border-green-900/10' : 'bg-green-50 border-green-200'}`}>
                  {filteredLeads.filter(l => l.stage === 'Ganho').map(lead => (
                    <div key={lead.id} onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }} className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} p-3 rounded-xl cursor-pointer hover:border-green-500 transition-all shadow-sm border`}>
                       <p className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-zinc-900'}`}>{lead.name}</p>
                       <p className="text-[9px] text-zinc-500">{lead.clinic}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* Coluna Perdidos */}
            <div className="min-w-[280px] w-[280px] flex flex-col gap-4 opacity-50">
               <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-red-600 px-3">Perdidos</h3>
               <div className={`flex-1 border border-dashed rounded-3xl p-3 space-y-3 overflow-y-auto scrollbar-thin ${isDark ? 'bg-red-900/5 border-red-900/10' : 'bg-red-50 border-red-200'}`}>
                  {filteredLeads.filter(l => l.stage === 'Perdido').map(lead => (
                    <div key={lead.id} onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }} className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} p-3 rounded-xl cursor-pointer hover:border-red-500 transition-all shadow-sm border`}>
                       <p className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-zinc-900'}`}>{lead.name}</p>
                       <p className="text-[9px] text-zinc-500">{lead.clinic}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        ) : (
          <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'} border rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-4 duration-500`}>
            <table className="w-full text-left border-collapse">
              <thead className={`${isDark ? 'bg-zinc-950/30 text-zinc-500' : 'bg-zinc-50 text-zinc-400'} border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} text-[10px] font-bold uppercase tracking-widest`}>
                <tr>
                  <th className="px-6 py-4">Lead / Cargo</th>
                  <th className="px-6 py-4">Clínica / CNPJ</th>
                  <th className="px-6 py-4">Estágio</th>
                  <th className="px-6 py-4 text-center">Score</th>
                  <th className="px-6 py-4">Vendedor</th>
                  <th className="px-6 py-4 text-right pr-10">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                {filteredLeads.map(lead => (
                  <tr key={lead.id} onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }} className={`transition-colors cursor-pointer group ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-zinc-50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-sm font-bold group-hover:text-nexus-orange transition-colors ${isDark ? 'text-white' : 'text-zinc-900'}`}>{lead.name}</span>
                        <div className="flex"><RoleTag role={lead.role} /></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-zinc-500 font-bold">{lead.clinic}</span>
                        <span className="text-[10px] text-zinc-400 font-mono tracking-tighter">{lead.cnpj || 'CNPJ NÃO INFORMADO'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        lead.stage === 'Ganho' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                        lead.stage === 'Perdido' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                        isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                      }`}>{lead.stage}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`font-black text-xs inline-flex items-center gap-1 ${lead.score > 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                        <Sparkles size={12} /> {lead.score}%
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={`https://picsum.photos/seed/${lead.assignedTo}/24/24`} className="w-5 h-5 rounded-full ring-2 ring-zinc-800 shadow-sm" alt={lead.assignedTo} />
                        <span className="text-sm text-zinc-500 font-medium">{lead.assignedTo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right pr-10">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2.5 text-zinc-400 hover:text-nexus-orange transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><Edit2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <LeadFormModal
          lead={selectedLead}
          isDark={isDark}
          stages={stages}
          vendedores={vendedores}
          plans={plans}
          leadOrigins={leadOrigins}
          onClose={() => { setIsModalOpen(false); setSelectedLead(null); }}
          onSave={handleSaveLead}
          onDelete={handleDeleteLead}
          onConvert={(lead) => {
            // ✅ CORREÇÃO v2.24.0: Abrir modal de trava inteligente ao invés de conversão simples
            const apiLead = apiLeads.find((l: ApiLead) => l.id === lead.id);
            setSelectedLeadToConvert(apiLead);
            setIsConvertModalOpen(true);
            setIsModalOpen(false); // Fechar modal de edição
          }}
          onMarkLost={handleMarkLost}
        />
      )}

      {isStageManagerOpen && (
        <StageManager
          stages={stages}
          funnelStages={funnelStages}
          isDark={isDark}
          onClose={() => setIsStageManagerOpen(false)}
          onSave={(newStages) => {
            // FASE 2: Reordenar estágios via API
            // Mapear nomes dos estágios para IDs e nova ordem
            const reorderPayload = newStages
              .map((stageName, index) => {
                const stage = funnelStages.find(s => s.name === stageName);
                if (!stage) {
                  return null;
                }
                return { id: stage.id, order: index + 1 };
              })
              .filter(Boolean) as { id: string; order: number }[];

            // Verificar se houve mudança de ordem
            if (reorderPayload.length === 0) {
              setIsStageManagerOpen(false);
              return;
            }

            // Chamar API de reordenação
            reorderMutation.mutate(
              { stages: reorderPayload },
              {
                onSuccess: () => {
                  setIsStageManagerOpen(false);
                },
                onError: () => {
                  window.alert('❌ Erro ao salvar pipeline. Tente novamente.');
                },
              }
            );
          }}
        />
      )}

      {/* Convert Lead Modal */}
      {selectedLeadToConvert && (
        <ConvertLeadModal
          isOpen={isConvertModalOpen}
          onClose={() => {
            setIsConvertModalOpen(false);
            setSelectedLeadToConvert(null);
          }}
          lead={selectedLeadToConvert}
        />
      )}
    </div>
  );
}
