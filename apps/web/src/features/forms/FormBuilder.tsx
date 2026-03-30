import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Link2, Code2,
  GripVertical, Trash2, Eye, Copy, ExternalLink,
  ChevronUp, ChevronDown,
  Plus, Settings2, Type, Mail, Phone, Hash, MapPin, FileText,
  Calendar, Globe, List, CheckSquare, CircleDot, EyeOff, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCreateForm, useUpdateForm, useForm } from './hooks/useForms';
import { FormFieldDef, FormPurpose, VendorAssignmentMode, CreateFormPayload, FieldType } from './services/forms.api';
import { useUIStore } from '@/stores/useUIStore';
import { useUsers } from '@/features/settings/hooks/useUsers';
import { cn } from '@/utils/cn';
import { nanoid } from 'nanoid';

// ── Icone por tipo de campo
const FIELD_TYPE_ICON: Record<FieldType, typeof Type> = {
  text: Type,
  email: Mail,
  phone: Phone,
  cnpj: Hash,
  cep: MapPin,
  select: List,
  textarea: FileText,
  number: Hash,
  state: MapPin,
  date: Calendar,
  url: Globe,
  radio: CircleDot,
  checkbox: CheckSquare,
  heading: Minus,
  hidden: EyeOff,
};

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Texto',
  email: 'Email',
  phone: 'Telefone',
  cnpj: 'CPF/CNPJ',
  cep: 'CEP',
  select: 'Dropdown',
  textarea: 'Texto Longo',
  number: 'Numero',
  state: 'Estado (UF)',
  date: 'Data',
  url: 'URL / Link',
  radio: 'Escolha Unica',
  checkbox: 'Multipla Escolha',
  heading: 'Titulo / Secao',
  hidden: 'Campo Oculto',
};

// ── Campos "inteligentes" pre-configurados (TODOS com required: false)
const SMART_FIELDS: Omit<FormFieldDef, 'id' | 'order'>[] = [
  { type: 'text',     label: 'Nome Completo',    placeholder: 'Ex: Joao Silva',           required: false, mappedTo: 'name' },
  { type: 'email',    label: 'Email',             placeholder: 'seu@email.com',            required: false, mappedTo: 'email' },
  { type: 'phone',    label: 'WhatsApp',          placeholder: '(11) 99999-9999',          required: false, mappedTo: 'phone' },
  { type: 'text',     label: 'Nome da Empresa',   placeholder: 'Ex: Clinica Saude Total',  required: false, mappedTo: 'companyName' },
  { type: 'text',     label: 'Cidade',            placeholder: 'Ex: Sao Paulo',            required: false, mappedTo: 'city' },
  { type: 'cnpj',     label: 'CPF / CNPJ',        placeholder: '00.000.000/0001-00',       required: false, mappedTo: 'cpfCnpj' },
  { type: 'cep',      label: 'CEP',               placeholder: '00000-000',                required: false },
  { type: 'state',    label: 'Estado',            placeholder: 'Selecione o estado',       required: false },
  {
    type: 'select',
    label: 'Cargo',
    required: false,
    mappedTo: 'role',
    options: ['CEO / Presidente', 'Socio ou Fundador', 'Diretor', 'Gerente', 'Coordenador', 'Outro'],
  },
  { type: 'textarea', label: 'Mensagem',          placeholder: 'Sua mensagem...',          required: false, mappedTo: 'notes' },
  { type: 'date',     label: 'Data de Interesse', placeholder: 'Selecione a data',         required: false },
  { type: 'url',      label: 'Site / Instagram',  placeholder: 'https://...',              required: false },
];

const STEPS = ['Informacoes', 'Campos', 'Configuracoes', 'Publicar'];

const PUBLIC_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}`
  : 'https://gestornx.nexusatemporal.com';

interface FormState {
  name: string;
  description: string;
  purpose: FormPurpose;
  productType: string;
  fields: FormFieldDef[];
  successMessage: string;
  vendorAssignmentMode: VendorAssignmentMode;
  defaultVendedorId: string;
  roundRobinVendedorIds: string[];
  slug: string;
  isActive: boolean;
}

const DEFAULT_STATE: FormState = {
  name: '',
  description: '',
  purpose: 'CAMPAIGN',
  productType: 'ONE_NEXUS',
  fields: [],
  successMessage: 'Obrigado! Entraremos em contato em breve.',
  vendorAssignmentMode: 'CREATOR',
  defaultVendedorId: '',
  roundRobinVendedorIds: [],
  slug: '',
  isActive: true,
};

// ── Tipos de campos disponiveis para "Campo Personalizado"
const CUSTOM_FIELD_TYPES: { value: FieldType; label: string; hasOptions?: boolean }[] = [
  { value: 'text', label: 'Texto Curto' },
  { value: 'textarea', label: 'Texto Longo' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Data' },
  { value: 'url', label: 'URL / Link' },
  { value: 'select', label: 'Dropdown (Selecao)', hasOptions: true },
  { value: 'radio', label: 'Escolha Unica (Radio)', hasOptions: true },
  { value: 'checkbox', label: 'Multipla Escolha (Checkbox)', hasOptions: true },
  { value: 'cnpj', label: 'CPF / CNPJ' },
  { value: 'cep', label: 'CEP' },
  { value: 'state', label: 'Estado (UF)' },
  { value: 'heading', label: 'Titulo / Divisor de Secao' },
  { value: 'hidden', label: 'Campo Oculto' },
];

export function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [slugTouched, setSlugTouched] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const createMutation = useCreateForm();
  const updateMutation = useUpdateForm(id || '');
  const { data: existingForm } = useForm(id || '');
  const { data: users = [] } = useUsers({ isActive: true });
  const vendedores = users.filter((u: any) => ['VENDEDOR', 'GESTOR', 'SUPERADMIN'].includes(u.role));

  // Carrega form para edicao
  useEffect(() => {
    if (existingForm && isEdit) {
      setForm({
        name: existingForm.name,
        description: existingForm.description || '',
        purpose: existingForm.purpose,
        productType: existingForm.productType || 'ONE_NEXUS',
        fields: existingForm.fields || [],
        successMessage: existingForm.successMessage || DEFAULT_STATE.successMessage,
        vendorAssignmentMode: existingForm.vendorAssignmentMode,
        defaultVendedorId: existingForm.defaultVendedorId || '',
        roundRobinVendedorIds: existingForm.roundRobinVendedorIds || [],
        slug: existingForm.slug,
        isActive: existingForm.isActive,
      });
      setSlugTouched(true);
    }
  }, [existingForm, isEdit]);

  // Auto-gera slug do nome
  useEffect(() => {
    if (!slugTouched && form.name) {
      const slug = form.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
      setForm(prev => ({ ...prev, slug }));
    }
  }, [form.name, slugTouched]);

  const isAlreadyAdded = (sf: Omit<FormFieldDef, 'id' | 'order'>) =>
    form.fields.some(f => f.label === sf.label && f.type === sf.type);

  const addField = (sf: Omit<FormFieldDef, 'id' | 'order'>) => {
    if (isAlreadyAdded(sf)) { toast.info('Campo ja adicionado'); return; }
    const newField: FormFieldDef = { ...sf, id: nanoid(8), order: form.fields.length };
    setForm(prev => ({ ...prev, fields: [...prev.fields, newField] }));
  };

  const addCustomField = (field: FormFieldDef) => {
    setForm(prev => ({ ...prev, fields: [...prev.fields, field] }));
    setShowCustomModal(false);
  };

  const removeField = (fieldId: string) => {
    if (expandedFieldId === fieldId) setExpandedFieldId(null);
    setForm(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId).map((f, i) => ({ ...f, order: i })),
    }));
  };

  const moveField = (fieldId: string, dir: 'up' | 'down') => {
    setForm(prev => {
      const idx = prev.fields.findIndex(f => f.id === fieldId);
      if (idx === -1) return prev;
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.fields.length - 1) return prev;
      const newFields = [...prev.fields];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      [newFields[idx], newFields[target]] = [newFields[target], newFields[idx]];
      return { ...prev, fields: newFields.map((f, i) => ({ ...f, order: i })) };
    });
  };

  const updateField = (fieldId: string, updates: Partial<FormFieldDef>) => {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f),
    }));
  };

  const canNext = useMemo(() => {
    if (step === 0) return form.name.trim().length >= 3;
    if (step === 1) return form.fields.length >= 1;
    return true;
  }, [step, form]);

  const handleSave = async () => {
    const payload: CreateFormPayload = {
      name: form.name,
      description: form.description || undefined,
      purpose: form.purpose,
      productType: form.productType as any,
      fields: form.fields,
      successMessage: form.successMessage,
      vendorAssignmentMode: form.vendorAssignmentMode,
      defaultVendedorId: form.defaultVendedorId || undefined,
      roundRobinVendedorIds: form.roundRobinVendedorIds.length ? form.roundRobinVendedorIds : undefined,
      isActive: form.isActive,
      slug: form.slug || undefined,
    };

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate('/forms');
    } catch {
      // erro ja tratado no hook
    }
  };

  const formUrl = `${PUBLIC_BASE}/f/${form.slug || 'meu-formulario'}`;
  const embedCode = `<iframe src="${formUrl}?embed=true" width="100%" height="600" frameborder="0" style="border-radius:12px;border:none;"></iframe>`;

  const inputCls = cn(
    'w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors',
    isDark
      ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-nexus-orange'
      : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-nexus-orange',
  );

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900')}>
      {/* Header */}
      <div className={cn('sticky top-0 z-10 px-3 md:px-6 py-3 md:py-4 border-b flex items-center gap-3 md:gap-4', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
        <button
          onClick={() => navigate('/forms')}
          className={cn('p-2 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">{isEdit ? 'Editar Formulario' : 'Criar Formulario'}</h1>
          {form.name && <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{form.name}</p>}
        </div>

        {/* Step indicators */}
        <div className="hidden md:flex items-center gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => i < step || canNext ? setStep(i) : null}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                i === step
                  ? 'bg-nexus-orange text-white'
                  : i < step
                  ? isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                  : isDark ? 'text-zinc-600' : 'text-zinc-400',
              )}
            >
              {i < step ? <Check size={11} /> : <span className="w-4 text-center">{i + 1}</span>}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <div className={cn('grid gap-6', step === 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto')}>

          {/* --- STEP 0: Informacoes Basicas --- */}
          {step === 0 && (
            <div className={cn('rounded-2xl border p-4 md:p-6 space-y-4 md:space-y-5', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
              <h2 className="font-semibold text-base">Informacoes Basicas</h2>

              <div>
                <label className="block text-sm font-medium mb-1.5">Nome do Formulario *</label>
                <input
                  className={inputCls}
                  placeholder="Ex: Campanha One Nexus Janeiro 2026"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Descricao <span className={cn('font-normal', isDark ? 'text-zinc-500' : 'text-zinc-400')}>(opcional)</span></label>
                <textarea
                  className={cn(inputCls, 'resize-none h-20')}
                  placeholder="Descreva brevemente o objetivo deste formulario..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Finalidade *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'CAMPAIGN' as FormPurpose, label: 'Campanha / WhatsApp', desc: 'Gera um link direto para compartilhar', icon: Link2 },
                    { value: 'EMBED' as FormPurpose, label: 'Site / LP / Embed', desc: 'Gera codigo para incorporar na pagina', icon: Code2 },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, purpose: opt.value }))}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        form.purpose === opt.value
                          ? 'border-nexus-orange bg-nexus-orange/5'
                          : isDark ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-200 hover:border-zinc-300',
                      )}
                    >
                      <opt.icon size={20} className={form.purpose === opt.value ? 'text-nexus-orange' : isDark ? 'text-zinc-400' : 'text-zinc-500'} />
                      <p className="font-medium text-sm mt-2">{opt.label}</p>
                      <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- STEP 1: Campos (painel esquerdo) --- */}
          {step === 1 && (
            <>
              {/* Campos disponiveis */}
              <div className={cn('rounded-2xl border p-5 space-y-4', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-sm">Campos Disponiveis</h2>
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      Clique para adicionar ao formulario
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCustomModal(true)}
                    className="flex items-center gap-1.5 text-xs bg-nexus-orange/10 text-nexus-orange px-3 py-1.5 rounded-lg hover:bg-nexus-orange/20 transition-colors font-medium"
                  >
                    <Plus size={13} />
                    Personalizado
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SMART_FIELDS.map(sf => {
                    const added = isAlreadyAdded(sf);
                    const Icon = FIELD_TYPE_ICON[sf.type];
                    return (
                      <button
                        key={sf.label}
                        onClick={() => addField(sf)}
                        disabled={added}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all text-xs',
                          added
                            ? isDark ? 'border-zinc-700 bg-zinc-800/50 text-zinc-600' : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                            : isDark ? 'border-zinc-700 hover:border-nexus-orange hover:bg-nexus-orange/5' : 'border-zinc-200 hover:border-nexus-orange hover:bg-orange-50',
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={13} className={added ? 'opacity-40' : 'text-nexus-orange'} />
                          <span className="font-medium">{sf.label}</span>
                          {added && <Check size={11} className="ml-auto text-green-500" />}
                        </div>
                        <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {FIELD_TYPE_LABEL[sf.type]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <p className={cn('text-xs font-medium mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    Campos no formulario: {form.fields.length}
                  </p>
                  {form.fields.length === 0 && (
                    <p className={cn('text-xs', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                      Adicione pelo menos 1 campo para continuar
                    </p>
                  )}
                </div>
              </div>

              {/* Campos adicionados + Preview */}
              <div className="space-y-4">
                {form.fields.length > 0 && (
                  <div className={cn('rounded-2xl border p-5 space-y-2', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
                    <h2 className="font-semibold text-sm mb-3">Campos Adicionados</h2>
                    {form.fields.map((field, idx) => {
                      const isExpanded = expandedFieldId === field.id;
                      const Icon = FIELD_TYPE_ICON[field.type];
                      return (
                        <div key={field.id} className={cn('rounded-xl border transition-all', isDark ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-100 bg-zinc-50')}>
                          {/* Header do campo */}
                          <div className="flex items-center gap-2 p-3">
                            <GripVertical size={14} className="text-zinc-400 flex-shrink-0" />
                            <Icon size={14} className="text-nexus-orange flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium truncate', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                                {field.label}
                              </p>
                              <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                                {FIELD_TYPE_LABEL[field.type]}
                              </span>
                            </div>
                            <button
                              onClick={() => updateField(field.id, { required: !field.required })}
                              className={cn('text-xs px-2 py-0.5 rounded-full border transition-colors flex-shrink-0',
                                field.required
                                  ? 'border-nexus-orange text-nexus-orange bg-nexus-orange/10'
                                  : isDark ? 'border-zinc-600 text-zinc-500' : 'border-zinc-300 text-zinc-400',
                              )}
                            >
                              {field.required ? 'Obrig.' : 'Opc.'}
                            </button>
                            <button
                              onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}
                              className={cn('p-1 rounded transition-colors', isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200')}
                              title="Configuracoes do campo"
                            >
                              <Settings2 size={14} className={isExpanded ? 'text-nexus-orange' : ''} />
                            </button>
                            <button onClick={() => moveField(field.id, 'up')} disabled={idx === 0} className="p-1 rounded disabled:opacity-30">
                              <ChevronUp size={14} />
                            </button>
                            <button onClick={() => moveField(field.id, 'down')} disabled={idx === form.fields.length - 1} className="p-1 rounded disabled:opacity-30">
                              <ChevronDown size={14} />
                            </button>
                            <button onClick={() => removeField(field.id)} className="p-1 rounded text-red-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Painel expandido de configuracoes */}
                          {isExpanded && (
                            <FieldSettings
                              field={field}
                              isDark={isDark}
                              inputCls={inputCls}
                              onChange={(updates) => updateField(field.id, updates)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mini preview */}
                <FormPreview form={form} isDark={isDark} />
              </div>
            </>
          )}

          {/* --- STEP 2: Configuracoes --- */}
          {step === 2 && (
            <div className={cn('rounded-2xl border p-4 md:p-6 space-y-4 md:space-y-5', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
              <h2 className="font-semibold text-base">Configuracoes do Formulario</h2>

              <div>
                <label className="block text-sm font-medium mb-1.5">Produto de Interesse</label>
                <select
                  className={inputCls}
                  value={form.productType}
                  onChange={e => setForm(p => ({ ...p, productType: e.target.value }))}
                >
                  <option value="ONE_NEXUS">One Nexus (CRM clinicas)</option>
                  <option value="LOCADORAS">Nexloc (Locadoras)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Atribuicao de Leads</label>
                <div className="space-y-2">
                  {[
                    { value: 'CREATOR', label: 'Quem criou o formulario', desc: 'Todos os leads vao para voce' },
                    { value: 'FIXED', label: 'Vendedor fixo', desc: 'Escolha um vendedor especifico' },
                    { value: 'ROUND_ROBIN', label: 'Round-robin', desc: 'Distribuicao rotativa entre vendedores' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, vendorAssignmentMode: opt.value as VendorAssignmentMode }))}
                      className={cn(
                        'w-full p-3 rounded-xl border-2 text-left transition-all',
                        form.vendorAssignmentMode === opt.value
                          ? 'border-nexus-orange bg-nexus-orange/5'
                          : isDark ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-200 hover:border-zinc-300',
                      )}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Seletor vendedor fixo */}
                {form.vendorAssignmentMode === 'FIXED' && (
                  <div className="mt-3">
                    <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      Selecionar vendedor
                    </label>
                    <select
                      className={inputCls}
                      value={form.defaultVendedorId}
                      onChange={e => setForm(p => ({ ...p, defaultVendedorId: e.target.value }))}
                    >
                      <option value="">-- Selecione um vendedor --</option>
                      {vendedores.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Seletor round-robin */}
                {form.vendorAssignmentMode === 'ROUND_ROBIN' && (
                  <div className="mt-3">
                    <label className={cn('block text-xs font-medium mb-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      Vendedores na rotacao ({form.roundRobinVendedorIds.length} selecionados)
                    </label>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {vendedores.map((u: any) => {
                        const selected = form.roundRobinVendedorIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={cn(
                              'flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors',
                              selected
                                ? 'border-nexus-orange bg-nexus-orange/5'
                                : isDark ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-200 hover:border-zinc-300',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                setForm(p => ({
                                  ...p,
                                  roundRobinVendedorIds: selected
                                    ? p.roundRobinVendedorIds.filter(id => id !== u.id)
                                    : [...p.roundRobinVendedorIds, u.id],
                                }));
                              }}
                              className="accent-orange-500 w-4 h-4"
                            />
                            <span className="text-sm">{u.name}</span>
                            <span className={cn('text-xs ml-auto', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{u.role}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Mensagem de Sucesso</label>
                <textarea
                  className={cn(inputCls, 'resize-none h-20')}
                  placeholder="Mensagem exibida apos o envio..."
                  value={form.successMessage}
                  onChange={e => setForm(p => ({ ...p, successMessage: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* --- STEP 3: Publicar --- */}
          {step === 3 && (
            <div className="space-y-4">
              <div className={cn('rounded-2xl border p-6 space-y-4', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
                <h2 className="font-semibold text-base">Publicar Formulario</h2>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Slug / URL
                    <span className={cn('ml-2 font-normal text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      (identificador unico na URL)
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm px-3 py-2.5 rounded-l-xl border border-r-0 flex-shrink-0', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-400')}>
                      /f/
                    </span>
                    <input
                      className={cn(inputCls, 'rounded-l-none')}
                      value={form.slug}
                      onChange={e => { setSlugTouched(true); setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })); }}
                      placeholder="meu-formulario"
                    />
                  </div>
                </div>

                {/* Link direto */}
                <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-100 bg-zinc-50')}>
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-nexus-orange" />
                    <p className="text-sm font-medium">Link Direto</p>
                  </div>
                  <p className={cn('text-xs font-mono break-all', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {formUrl}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(formUrl); toast.success('Link copiado!'); }}
                      className="flex items-center gap-1.5 text-xs bg-nexus-orange/10 text-nexus-orange px-3 py-1.5 rounded-lg hover:bg-nexus-orange/20 transition-colors"
                    >
                      <Copy size={12} /> Copiar Link
                    </button>
                    <button
                      onClick={() => window.open(formUrl, '_blank')}
                      className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors', isDark ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300')}
                    >
                      <ExternalLink size={12} /> Visualizar
                    </button>
                  </div>
                </div>

                {/* Embed */}
                <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-100 bg-zinc-50')}>
                  <div className="flex items-center gap-2">
                    <Code2 size={16} className="text-purple-400" />
                    <p className="text-sm font-medium">Codigo Embed (iFrame)</p>
                  </div>
                  <pre className={cn('text-xs font-mono p-3 rounded-lg overflow-x-auto', isDark ? 'bg-zinc-900 text-zinc-400' : 'bg-white text-zinc-500 border border-zinc-200')}>
                    {embedCode}
                  </pre>
                  <button
                    onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Codigo embed copiado!'); }}
                    className="flex items-center gap-1.5 text-xs bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                  >
                    <Copy size={12} /> Copiar Codigo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 max-w-6xl">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/forms')}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors', isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600')}
          >
            <ArrowLeft size={16} />
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canNext && setStep(s => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-nexus-orange hover:bg-orange-600 text-white transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proximo
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-nexus-orange hover:bg-orange-600 text-white transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {isEdit ? 'Salvar Alteracoes' : 'Publicar Formulario'}
            </button>
          )}
        </div>
      </div>

      {/* Modal campo personalizado */}
      {showCustomModal && (
        <CustomFieldModal
          isDark={isDark}
          inputCls={inputCls}
          existingCount={form.fields.length}
          onAdd={addCustomField}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  );
}

// ─── Painel de configuracoes expandido do campo ───
function FieldSettings({
  field,
  isDark,
  inputCls,
  onChange,
}: {
  field: FormFieldDef;
  isDark: boolean;
  inputCls: string;
  onChange: (updates: Partial<FormFieldDef>) => void;
}) {
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type);
  const hasPlaceholder = !['heading', 'hidden', 'checkbox', 'radio'].includes(field.type);
  const hasMinMax = ['text', 'textarea', 'number', 'url'].includes(field.type);
  const isHeading = field.type === 'heading';
  const isHidden = field.type === 'hidden';

  const [optionInput, setOptionInput] = useState('');

  const addOption = () => {
    const val = optionInput.trim();
    if (!val) return;
    if (field.options?.includes(val)) { toast.info('Opcao ja existe'); return; }
    onChange({ options: [...(field.options || []), val] });
    setOptionInput('');
  };

  const removeOption = (opt: string) => {
    onChange({ options: (field.options || []).filter(o => o !== opt) });
  };

  return (
    <div className={cn('border-t px-4 py-4 space-y-3', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
      {/* Label */}
      <div>
        <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          {isHeading ? 'Titulo da Secao' : 'Label do Campo'}
        </label>
        <input
          className={inputCls}
          value={field.label}
          onChange={e => onChange({ label: e.target.value })}
        />
      </div>

      {/* Description / Help text */}
      <div>
        <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          {isHeading ? 'Subtitulo' : 'Texto de ajuda'} <span className="font-normal">(opcional)</span>
        </label>
        <input
          className={inputCls}
          placeholder={isHeading ? 'Subtitulo da secao...' : 'Ex: Preencha conforme seu documento'}
          value={field.description || ''}
          onChange={e => onChange({ description: e.target.value || undefined })}
        />
      </div>

      {/* Placeholder */}
      {hasPlaceholder && (
        <div>
          <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Placeholder</label>
          <input
            className={inputCls}
            placeholder="Texto de exemplo dentro do campo"
            value={field.placeholder || ''}
            onChange={e => onChange({ placeholder: e.target.value || undefined })}
          />
        </div>
      )}

      {/* Default value (para hidden) */}
      {isHidden && (
        <div>
          <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Valor Padrao</label>
          <input
            className={inputCls}
            placeholder="Valor enviado automaticamente"
            value={field.defaultValue || ''}
            onChange={e => onChange({ defaultValue: e.target.value || undefined })}
          />
        </div>
      )}

      {/* Options (select, radio, checkbox) */}
      {hasOptions && (
        <div>
          <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            Opcoes ({(field.options || []).length})
          </label>
          <div className="space-y-1.5 mb-2">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={cn('flex-1 text-xs px-3 py-1.5 rounded-lg', isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600')}>
                  {opt}
                </span>
                <button onClick={() => removeOption(opt)} className="p-1 text-red-400 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={cn(inputCls, 'flex-1')}
              placeholder="Nova opcao..."
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
            />
            <button
              onClick={addOption}
              className="px-3 py-2 rounded-xl bg-nexus-orange/10 text-nexus-orange text-xs font-medium hover:bg-nexus-orange/20 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Min/Max length */}
      {hasMinMax && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Min. caracteres</label>
            <input
              type="number"
              className={inputCls}
              placeholder="0"
              value={field.minLength ?? ''}
              onChange={e => onChange({ minLength: e.target.value ? parseInt(e.target.value) : undefined })}
            />
          </div>
          <div>
            <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Max. caracteres</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Sem limite"
              value={field.maxLength ?? ''}
              onChange={e => onChange({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
            />
          </div>
        </div>
      )}

      {/* Half width toggle + Required toggle */}
      {!isHeading && (
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.halfWidth || false}
              onChange={e => onChange({ halfWidth: e.target.checked || undefined })}
              className="accent-orange-500 w-3.5 h-3.5"
            />
            <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Meia largura</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={e => onChange({ required: e.target.checked })}
              className="accent-orange-500 w-3.5 h-3.5"
            />
            <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Obrigatorio</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Modal para criar campo personalizado ───
function CustomFieldModal({
  isDark,
  inputCls,
  existingCount,
  onAdd,
  onClose,
}: {
  isDark: boolean;
  inputCls: string;
  existingCount: number;
  onAdd: (field: FormFieldDef) => void;
  onClose: () => void;
}) {
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [label, setLabel] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');

  const hasOptions = ['select', 'radio', 'checkbox'].includes(fieldType);

  const addOption = () => {
    const val = optionInput.trim();
    if (!val || options.includes(val)) return;
    setOptions(prev => [...prev, val]);
    setOptionInput('');
  };

  const handleAdd = () => {
    if (!label.trim()) { toast.error('Informe o label do campo'); return; }
    if (hasOptions && options.length < 2) { toast.error('Adicione pelo menos 2 opcoes'); return; }

    const field: FormFieldDef = {
      id: nanoid(8),
      type: fieldType,
      label: label.trim(),
      placeholder: placeholder || undefined,
      required: false,
      order: existingCount,
      options: hasOptions ? options : undefined,
    };

    onAdd(field);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className={cn(
        'fixed z-50 inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full max-w-full md:max-w-md rounded-t-2xl md:rounded-2xl border p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:fade-in duration-300',
        isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200',
      )}>
        <div className="flex justify-center md:hidden mb-3">
          <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
        </div>
        <h3 className="font-bold text-base mb-4">Campo Personalizado</h3>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Tipo do Campo *</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {CUSTOM_FIELD_TYPES.map(ct => {
                const Icon = FIELD_TYPE_ICON[ct.value];
                return (
                  <button
                    key={ct.value}
                    onClick={() => setFieldType(ct.value)}
                    className={cn(
                      'flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-all text-left',
                      fieldType === ct.value
                        ? 'border-nexus-orange bg-nexus-orange/10 text-nexus-orange'
                        : isDark ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300',
                    )}
                  >
                    <Icon size={12} />
                    <span className="truncate">{ct.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Label *</label>
            <input
              className={inputCls}
              placeholder="Ex: Quantidade de funcionarios"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          {/* Placeholder */}
          {!['heading', 'hidden', 'checkbox', 'radio'].includes(fieldType) && (
            <div>
              <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Placeholder</label>
              <input
                className={inputCls}
                placeholder="Texto de exemplo"
                value={placeholder}
                onChange={e => setPlaceholder(e.target.value)}
              />
            </div>
          )}

          {/* Options */}
          {hasOptions && (
            <div>
              <label className={cn('block text-xs font-medium mb-1.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                Opcoes * ({options.length})
              </label>
              <div className="space-y-1 mb-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={cn('flex-1 text-xs px-3 py-1.5 rounded-lg', isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600')}>{opt}</span>
                    <button onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={cn(inputCls, 'flex-1')}
                  placeholder="Nova opcao..."
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                />
                <button onClick={addOption} className="px-3 py-2 rounded-xl bg-nexus-orange/10 text-nexus-orange text-xs font-medium hover:bg-nexus-orange/20">
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium', isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-nexus-orange hover:bg-orange-600 text-white transition-colors"
          >
            Adicionar Campo
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Mini preview do form ───
function FormPreview({ form, isDark }: { form: FormState; isDark: boolean }) {
  if (form.fields.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
      <div className={cn('px-4 py-3 border-b flex items-center gap-2', isDark ? 'border-zinc-800' : 'border-zinc-100')}>
        <Eye size={14} className="text-nexus-orange" />
        <span className="text-xs font-medium">Preview</span>
      </div>
      <div className="p-5 space-y-3">
        {form.name && <h3 className="font-bold text-sm">{form.name}</h3>}
        {form.description && <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{form.description}</p>}

        <div className={cn('grid gap-3', 'grid-cols-1 md:grid-cols-2')}>
          {form.fields.slice(0, 6).map(field => {
            if (field.type === 'heading') {
              return (
                <div key={field.id} className="col-span-2 pt-2">
                  <p className={cn('text-xs font-bold', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{field.label}</p>
                  {field.description && <p className={cn('text-xs mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{field.description}</p>}
                  <div className={cn('border-b mt-1.5', isDark ? 'border-zinc-700' : 'border-zinc-200')} />
                </div>
              );
            }
            if (field.type === 'hidden') return null;
            const colSpan = field.halfWidth ? '' : 'col-span-2';
            return (
              <div key={field.id} className={colSpan}>
                <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  {field.label}{field.required && <span className="text-nexus-orange ml-0.5">*</span>}
                </label>
                {field.description && (
                  <p className={cn('text-xs mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{field.description}</p>
                )}
                {field.type === 'textarea' ? (
                  <div className={cn('w-full h-14 rounded-lg border text-xs px-3 py-2', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-400')}>
                    {field.placeholder}
                  </div>
                ) : field.type === 'select' ? (
                  <div className={cn('w-full rounded-lg border text-xs px-3 py-2', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-400')}>
                    {field.placeholder || 'Selecione...'}
                  </div>
                ) : field.type === 'radio' ? (
                  <div className="space-y-1">
                    {(field.options || []).slice(0, 3).map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-full border', isDark ? 'border-zinc-600' : 'border-zinc-300')} />
                        <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{opt}</span>
                      </div>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <div className="space-y-1">
                    {(field.options || []).slice(0, 3).map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-sm border', isDark ? 'border-zinc-600' : 'border-zinc-300')} />
                        <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{opt}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn('w-full rounded-lg border text-xs px-3 py-2', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-400')}>
                    {field.placeholder}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {form.fields.filter(f => f.type !== 'hidden').length > 6 && (
          <p className={cn('text-xs text-center', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
            +{form.fields.filter(f => f.type !== 'hidden').length - 6} campo(s)...
          </p>
        )}
        <div className="w-full bg-nexus-orange text-white text-xs font-medium py-2.5 rounded-lg text-center mt-3">
          Enviar
        </div>
      </div>
    </div>
  );
}
