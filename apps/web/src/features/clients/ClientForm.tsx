import { useState } from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Select,
  Loading,
} from '@/components/ui';
import { Client, ProductType, ClientStatus } from '@/types';

interface Plan {
  id: string;
  name: string;
  product: ProductType;
  price: number;
}

interface ClientFormProps {
  client?: Client | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClientFormData {
  contactName: string;      // ← Updated to match Prisma
  company: string;           // ← Updated to match Prisma
  cpfCnpj: string;           // ← Updated to match Prisma (combined field)
  email: string;
  phone: string;
  productType: ProductType | '';  // ← Updated to match Prisma
  planId: string;
  status: ClientStatus | '';
}

export function ClientForm({ client, onClose, onSuccess }: ClientFormProps) {
  const isEditing = !!client;

  const [formData, setFormData] = useState<ClientFormData>({
    contactName: client?.contactName || '',
    company: client?.company || '',
    cpfCnpj: client?.cpfCnpj || '',
    email: client?.email || '',
    phone: client?.phone || '',
    productType: client?.productType || '',
    planId: client?.planId || '',
    status: client?.status || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});

  const { data: plans, isLoading: isLoadingPlans } = useApiQuery<Plan[]>(
    ['plans'],
    '/plans'
  );

  const createMutation = useApiMutation('/clients', { method: 'POST' });
  const updateMutation = useApiMutation(
    client ? `/clients/${client.id}` : '',
    { method: 'PUT' }
  );

  const mutation = isEditing ? updateMutation : createMutation;

  // Filtrar planos pelo produto selecionado
  const filteredPlans = plans?.filter(
    (plan) => formData.productType === '' || plan.product === formData.productType
  );

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Se mudar o produto, limpar o plano selecionado
    if (field === 'productType') {
      setFormData((prev) => ({ ...prev, planId: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ClientFormData, string>> = {};

    if (!formData.contactName.trim()) {
      newErrors.contactName = 'Nome do responsável é obrigatório';
    }

    if (!formData.cpfCnpj.trim()) {
      newErrors.cpfCnpj = 'CPF/CNPJ é obrigatório';
    } else {
      const digits = formData.cpfCnpj.replace(/\D/g, '');
      if (digits.length !== 11 && digits.length !== 14) {
        newErrors.cpfCnpj = 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    if (!formData.productType) {
      newErrors.productType = 'Produto é obrigatório';
    }

    if (!formData.planId) {
      newErrors.planId = 'Plano é obrigatório';
    }

    if (isEditing && !formData.status) {
      newErrors.status = 'Status é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const payload = {
        contactName: formData.contactName,
        company: formData.company || null,
        cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
        email: formData.email,
        phone: formData.phone.replace(/\D/g, ''),
        productType: formData.productType,
        planId: formData.planId,
        ...(isEditing && { status: formData.status }),
      };

      await mutation.mutateAsync(payload);
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Editar Cliente' : 'Novo Cliente'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nome do Responsável"
              value={formData.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              error={errors.contactName}
              required
            />
            <Input
              label="Nome da Empresa"
              value={formData.company}
              onChange={(e) => handleChange('company', e.target.value)}
              helperText="Opcional"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="CPF/CNPJ"
              value={formData.cpfCnpj}
              onChange={(e) => handleChange('cpfCnpj', e.target.value)}
              error={errors.cpfCnpj}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              required
            />
            <div />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="E-mail"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              required
            />
            <Input
              label="Telefone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              error={errors.phone}
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Produto"
              value={formData.productType}
              onChange={(e) => handleChange('productType', e.target.value)}
              error={errors.productType}
              placeholder="Selecione o produto"
              options={[
                { value: ProductType.ONE_NEXUS, label: 'One Nexus' },
                { value: ProductType.LOCADORAS, label: 'Locadoras' },
              ]}
              required
            />
            {isLoadingPlans ? (
              <div className="flex items-center justify-center py-2">
                <Loading size="sm" />
              </div>
            ) : (
              <Select
                label="Plano"
                value={formData.planId}
                onChange={(e) => handleChange('planId', e.target.value)}
                error={errors.planId}
                placeholder="Selecione o plano"
                options={
                  filteredPlans?.map((plan) => ({
                    value: plan.id,
                    label: `${plan.name} - R$ ${plan.price.toFixed(2)}`,
                  })) || []
                }
                required
                disabled={!formData.productType}
              />
            )}
          </div>

          {isEditing && (
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              error={errors.status}
              options={[
                { value: ClientStatus.EM_TRIAL, label: 'Em Trial' },
                { value: ClientStatus.ATIVO, label: 'Ativo' },
                { value: ClientStatus.CANCELADO, label: 'Cancelado' },
                { value: ClientStatus.INADIMPLENTE, label: 'Inadimplente' },
              ]}
              required
            />
          )}
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={mutation.isPending}
          >
            {isEditing ? 'Salvar Alterações' : 'Criar Cliente'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
