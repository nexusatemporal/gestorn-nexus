import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formsApi, FormFieldDef } from '@/features/forms/services/forms.api';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface PublicFormData {
  id: string;
  name: string;
  description?: string | null;
  purpose: string;
  productType?: string | null;
  fields: FormFieldDef[];
  successMessage?: string | null;
  isActive: boolean;
}

// ─── Validações ──────────────────────────────────────────────────────────────

function validateCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(n[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(n[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const calc = (s: string, weights: number[]) =>
    s.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digit = (r: number) => (r % 11 < 2 ? 0 : 11 - (r % 11));
  const d1 = digit(calc(n.slice(0, 12), weights1));
  const d2 = digit(calc(n.slice(0, 13), weights2));
  return d1 === parseInt(n[12]) && d2 === parseInt(n[13]);
}

function validateCpfCnpj(raw: string): boolean {
  const n = raw.replace(/\D/g, '');
  if (n.length === 11) return validateCPF(n);
  if (n.length === 14) return validateCNPJ(n);
  return false;
}

// ─── Máscaras ────────────────────────────────────────────────────────────────

function maskPhone(raw: string): string {
  const n = raw.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function maskCpfCnpj(raw: string): string {
  const n = raw.replace(/\D/g, '').slice(0, 14);
  if (n.length <= 11) {
    // CPF
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
    return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
  }
  // CNPJ
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function maskCep(raw: string): string {
  const n = raw.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 5) return n;
  return `${n.slice(0, 5)}-${n.slice(5)}`;
}

// ─── Estados brasileiros ─────────────────────────────────────────────────────

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

// ─── Componente principal ────────────────────────────────────────────────────

export function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';
  // ?fields=id1,id2,id3 — designer pode filtrar campos no embed
  const embedFields = searchParams.get('fields')?.split(',').filter(Boolean) || [];

  const [form, setForm] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Estado para autocomplete de UF
  const [stateQuery, setStateQuery] = useState<Record<string, string>>({});
  const [stateOpen, setStateOpen] = useState<Record<string, boolean>>({});
  const stateRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ─── Carregar form ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    formsApi.getPublic(slug)
      .then((data) => {
        if (!data.isActive) { setInactive(true); setLoading(false); return; }
        setForm(data as PublicFormData);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  // ─── Fechar dropdown estado ao clicar fora ──────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      Object.keys(stateRefs.current).forEach((fid) => {
        if (stateRefs.current[fid] && !stateRefs.current[fid]!.contains(e.target as Node)) {
          setStateOpen((p) => ({ ...p, [fid]: false }));
        }
      });
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Campos visíveis ────────────────────────────────────────────────────
  const visibleFields = (() => {
    if (!form) return [];
    const sorted = [...form.fields].sort((a, b) => a.order - b.order);
    const filtered = embedFields.length === 0 ? sorted : sorted.filter((f) => embedFields.includes(f.id));
    return filtered.filter((f) => f.type !== 'hidden');
  })();

  // Campos ocultos (hidden) - enviados automaticamente com defaultValue
  const hiddenFields = (() => {
    if (!form) return [];
    return form.fields.filter((f) => f.type === 'hidden');
  })();

  // ─── Handlers ───────────────────────────────────────────────────────────

  function set(id: string, val: string) {
    setValues((p) => ({ ...p, [id]: val }));
    if (errors[id]) setErrors((p) => ({ ...p, [id]: '' }));
  }

  async function handleCepBlur(raw: string) {
    const cep = raw.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { setCepLoading(false); return; }

      // Auto-preencher campos mapeados para city e state
      setValues((prev) => {
        const next = { ...prev };
        form?.fields.forEach((f) => {
          if (f.mappedTo === 'city' && data.localidade) next[f.id] = data.localidade;
          if (f.type === 'state' && data.uf) {
            next[f.id] = data.uf;
            setStateQuery((q) => ({ ...q, [f.id]: data.uf }));
          }
          // Campo notes pode receber endereço completo
          if (f.type === 'textarea' && f.mappedTo === 'notes') {
            const addr = [data.logradouro, data.bairro, data.localidade, data.uf]
              .filter(Boolean).join(', ');
            if (addr && !next[f.id]) next[f.id] = addr;
          }
        });
        return next;
      });
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }

  function validate(): boolean {
    if (!form) return false;
    const newErrors: Record<string, string> = {};
    visibleFields.forEach((f) => {
      if (f.type === 'heading') return;
      const val = values[f.id] || '';
      if (f.required && !val.trim()) {
        newErrors[f.id] = 'Campo obrigatório';
      } else if (val.trim()) {
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          newErrors[f.id] = 'Email inválido';
        }
        if (f.type === 'phone' && val.replace(/\D/g, '').length < 10) {
          newErrors[f.id] = 'Telefone inválido (mín. 10 dígitos)';
        }
        if (f.type === 'cnpj' && !validateCpfCnpj(val)) {
          newErrors[f.id] = 'CPF/CNPJ inválido';
        }
        if (f.type === 'cep' && val.replace(/\D/g, '').length !== 8) {
          newErrors[f.id] = 'CEP deve ter 8 dígitos';
        }
        if (f.type === 'url' && !/^https?:\/\/.+/i.test(val) && !val.startsWith('www.')) {
          newErrors[f.id] = 'URL inválida (comece com http:// ou https://)';
        }
        if (f.minLength && val.length < f.minLength) {
          newErrors[f.id] = `Mínimo ${f.minLength} caracteres`;
        }
        if (f.maxLength && val.length > f.maxLength) {
          newErrors[f.id] = `Máximo ${f.maxLength} caracteres`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !slug) return;
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Incluir campos hidden com defaultValue
      const submitData = { ...values };
      hiddenFields.forEach((f) => {
        if (f.defaultValue) submitData[f.id] = f.defaultValue;
      });
      await formsApi.submit(slug, submitData);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Estados de tela ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <Wrapper isEmbed={isEmbed}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#FF7300]" />
        </div>
      </Wrapper>
    );
  }

  if (notFound) {
    return (
      <Wrapper isEmbed={isEmbed}>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <AlertCircle size={48} className="text-red-400" />
          <h2 className="text-lg font-bold text-white">Formulário não encontrado</h2>
          <p className="text-zinc-400 text-sm">O link pode estar incorreto ou expirado.</p>
        </div>
      </Wrapper>
    );
  }

  if (inactive) {
    return (
      <Wrapper isEmbed={isEmbed}>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <AlertCircle size={48} className="text-yellow-400" />
          <h2 className="text-lg font-bold text-white">Formulário pausado</h2>
          <p className="text-zinc-400 text-sm">Este formulário não está aceitando submissões no momento.</p>
        </div>
      </Wrapper>
    );
  }

  if (submitted) {
    return (
      <Wrapper isEmbed={isEmbed}>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Enviado!</h2>
          <p className="text-zinc-300 text-sm max-w-sm">
            {form?.successMessage || 'Obrigado! Entraremos em contato em breve.'}
          </p>
        </div>
      </Wrapper>
    );
  }

  // ─── Form ────────────────────────────────────────────────────────────────

  return (
    <Wrapper isEmbed={isEmbed}>
      {/* Logo — apenas modo normal */}
      {!isEmbed && (
        <div className="flex justify-center mb-8">
          <img
            src="/logos/logo-dark.png"
            alt="Nexus Atemporal"
            className="h-10 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Título */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-2xl font-bold text-white">{form?.name}</h1>
        {form?.description && (
          <p className="mt-1 text-zinc-400 text-xs md:text-sm leading-relaxed">{form.description}</p>
        )}
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {visibleFields.map((field) => {
            const colSpan = field.halfWidth ? '' : 'col-span-2';
            return (
              <div key={field.id} className={colSpan}>
                <FieldRenderer
                  field={field}
                  value={values[field.id] || ''}
                  error={errors[field.id]}
                  cepLoading={cepLoading}
                  stateQuery={stateQuery[field.id] || ''}
                  stateOpen={stateOpen[field.id] || false}
                  stateRef={(el) => { stateRefs.current[field.id] = el; }}
                  onChange={(v) => set(field.id, v)}
                  onCepBlur={(v) => handleCepBlur(v)}
                  onStateQueryChange={(q) => setStateQuery((p) => ({ ...p, [field.id]: q }))}
                  onStateOpenChange={(o) => setStateOpen((p) => ({ ...p, [field.id]: o }))}
                />
              </div>
            );
          })}
        </div>

        {submitError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-6 rounded-xl bg-[#FF7300] hover:bg-orange-600 text-white font-semibold text-sm transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Enviando...' : 'Enviar →'}
        </button>
      </form>
    </Wrapper>
  );
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function Wrapper({ children, isEmbed }: { children: React.ReactNode; isEmbed: boolean }) {
  if (isEmbed) {
    return (
      <div className="bg-transparent min-h-screen p-3 md:p-6">
        <div className="max-w-lg mx-auto w-full">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-zinc-950 flex items-start justify-center px-3 md:px-4 py-6 md:py-16">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-8 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ─── Renderizador de campo ────────────────────────────────────────────────────

interface FieldProps {
  field: FormFieldDef;
  value: string;
  error?: string;
  cepLoading?: boolean;
  stateQuery: string;
  stateOpen: boolean;
  stateRef: (el: HTMLDivElement | null) => void;
  onChange: (v: string) => void;
  onCepBlur: (v: string) => void;
  onStateQueryChange: (q: string) => void;
  onStateOpenChange: (o: boolean) => void;
}

function FieldRenderer({
  field, value, error, cepLoading,
  stateQuery, stateOpen, stateRef,
  onChange, onCepBlur, onStateQueryChange, onStateOpenChange,
}: FieldProps) {
  const inputClass = `
    w-full bg-zinc-800 border rounded-xl px-4 py-3 text-white text-base md:text-sm
    placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-colors
    ${error
      ? 'border-red-500 focus:ring-red-500/40'
      : 'border-zinc-700 focus:ring-[#FF7300]/40 focus:border-[#FF7300]'}
  `;

  const filteredEstados = ESTADOS.filter((uf) =>
    uf.toLowerCase().includes(stateQuery.toLowerCase()),
  );

  // HEADING (divisor de secao)
  if (field.type === 'heading') {
    return (
      <div className="pt-3 pb-1">
        <h3 className="text-base font-bold text-white">{field.label}</h3>
        {field.description && (
          <p className="text-zinc-400 text-xs mt-0.5">{field.description}</p>
        )}
        <div className="border-b border-zinc-700 mt-2" />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
        {field.label}
        {field.required && <span className="text-[#FF7300] ml-1">*</span>}
      </label>
      {field.description && (
        <p className="text-zinc-500 text-xs mb-1.5">{field.description}</p>
      )}

      {/* SELECT */}
      {field.type === 'select' && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass + ' cursor-pointer bg-zinc-800'}
        >
          <option value="" disabled>
            {field.placeholder || 'Selecione...'}
          </option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {/* RADIO */}
      {field.type === 'radio' && (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                value === opt
                  ? 'border-[#FF7300] bg-[#FF7300]/5'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
                className="accent-orange-500 w-4 h-4"
              />
              <span className="text-sm text-white">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {/* CHECKBOX (multipla escolha - armazena como string separada por virgula) */}
      {field.type === 'checkbox' && (
        <div className="space-y-2">
          {(field.options || []).map((opt) => {
            const selected = value.split(',').filter(Boolean).includes(opt);
            return (
              <label
                key={opt}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selected
                    ? 'border-[#FF7300] bg-[#FF7300]/5'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = value.split(',').filter(Boolean);
                    const next = selected
                      ? current.filter((v) => v !== opt)
                      : [...current, opt];
                    onChange(next.join(','));
                  }}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-sm text-white">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* TEXTAREA */}
      {field.type === 'textarea' && (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass + ' resize-none'}
          maxLength={field.maxLength}
        />
      )}

      {/* ESTADO (autocomplete) */}
      {field.type === 'state' && (
        <div className="relative" ref={stateRef}>
          <input
            type="text"
            value={stateQuery || value}
            onChange={(e) => {
              onStateQueryChange(e.target.value);
              onStateOpenChange(true);
            }}
            onFocus={() => onStateOpenChange(true)}
            placeholder={field.placeholder || 'Ex: SP'}
            className={inputClass}
            autoComplete="off"
          />
          {stateOpen && filteredEstados.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-xl py-1 shadow-xl max-h-48 overflow-y-auto">
              {filteredEstados.map((uf) => (
                <li
                  key={uf}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(uf);
                    onStateQueryChange(uf);
                    onStateOpenChange(false);
                  }}
                  className="px-4 py-2 text-sm text-white hover:bg-zinc-700 cursor-pointer"
                >
                  {uf}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* CEP */}
      {field.type === 'cep' && (
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(maskCep(e.target.value))}
            onBlur={(e) => onCepBlur(e.target.value)}
            placeholder={field.placeholder || '00000-000'}
            maxLength={9}
            className={inputClass + ' pr-10'}
          />
          {cepLoading && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" />
          )}
        </div>
      )}

      {/* PHONE */}
      {field.type === 'phone' && (
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(maskPhone(e.target.value))}
          placeholder={field.placeholder || '(11) 99999-9999'}
          maxLength={15}
          className={inputClass}
        />
      )}

      {/* CPF/CNPJ */}
      {field.type === 'cnpj' && (
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(maskCpfCnpj(e.target.value))}
          placeholder={field.placeholder || 'CPF ou CNPJ'}
          maxLength={18}
          className={inputClass}
        />
      )}

      {/* NUMBER */}
      {field.type === 'number' && (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {/* DATE */}
      {field.type === 'date' && (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass + ' cursor-pointer'}
        />
      )}

      {/* URL */}
      {field.type === 'url' && (
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || 'https://...'}
          className={inputClass}
          autoComplete="url"
        />
      )}

      {/* EMAIL */}
      {field.type === 'email' && (
        <input
          type="email"
          inputMode="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || 'email@exemplo.com'}
          className={inputClass}
          autoComplete="email"
        />
      )}

      {/* TEXT (default) */}
      {field.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
          autoComplete={field.mappedTo === 'name' ? 'name' : undefined}
          maxLength={field.maxLength}
        />
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
