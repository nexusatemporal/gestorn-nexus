import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Loading,
  DataTable,
  Column,
} from '@/components/ui';
import { Client, ClientStatus, ProductType, Payment } from '@/types';
import { formatCPF, formatCNPJ, formatPhone, formatDate, formatCurrency } from '@/utils/formatters';
import { ClientForm } from './ClientForm';
import { ClientModulesTab } from './components/ClientModulesTab';

const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  [ClientStatus.EM_TRIAL]: 'Em Trial',
  [ClientStatus.ATIVO]: 'Ativo',
  [ClientStatus.CANCELADO]: 'Cancelado',
  [ClientStatus.INADIMPLENTE]: 'Inadimplente',
};

const CLIENT_STATUS_VARIANTS: Record<ClientStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  [ClientStatus.EM_TRIAL]: 'info',
  [ClientStatus.ATIVO]: 'success',
  [ClientStatus.CANCELADO]: 'default',
  [ClientStatus.INADIMPLENTE]: 'danger',
};

const PRODUCT_LABELS: Record<ProductType, string> = {
  [ProductType.ONE_NEXUS]: 'One Nexus',
  [ProductType.LOCADORAS]: 'Locadoras',
};

export function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'payments' | 'modules'>('info');

  const { data: client, isLoading, refetch } = useApiQuery<Client>(
    ['clients', id],
    `/clients/${id}`
  );

  const { data: payments } = useApiQuery<Payment[]>(
    ['payments', 'client', id],
    `/payments?clientId=${id}`
  );

  const cancelMutation = useApiMutation(`/clients/${id}/cancel`, { method: 'POST' });
  const reactivateMutation = useApiMutation(`/clients/${id}/reactivate`, { method: 'POST' });

  const handleEdit = () => {
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    refetch();
    setIsFormOpen(false);
  };

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar este cliente?')) return;

    try {
      await cancelMutation.mutateAsync({});
      toast.success('Cliente cancelado com sucesso');
      refetch();
    } catch (error) {
      toast.error('Erro ao cancelar cliente');
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateMutation.mutateAsync({});
      toast.success('Cliente reativado com sucesso');
      refetch();
    } catch (error) {
      toast.error('Erro ao reativar cliente');
    }
  };

  if (isLoading) {
    return <Loading fullScreen text="Carregando cliente..." />;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Cliente não encontrado</h2>
        <Button onClick={() => navigate('/clients')}>Voltar para lista</Button>
      </div>
    );
  }

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'dueDate',
      label: 'Vencimento',
      sortable: true,
      render: (payment) => <span>{formatDate(payment.dueDate)}</span>,
    },
    {
      key: 'amount',
      label: 'Valor',
      sortable: true,
      render: (payment) => <span className="font-medium">{formatCurrency(payment.amount)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (payment) => {
        const variants = {
          PENDING: 'warning',
          PAID: 'success',
          OVERDUE: 'danger',
          CANCELLED: 'default',
        } as const;
        const labels = {
          PENDING: 'Pendente',
          PAID: 'Pago',
          OVERDUE: 'Vencido',
          CANCELLED: 'Cancelado',
        };
        return (
          <Badge variant={variants[payment.status as keyof typeof variants]} size="sm">
            {labels[payment.status as keyof typeof labels]}
          </Badge>
        );
      },
    },
    {
      key: 'gateway',
      label: 'Gateway',
      render: (payment) => <span className="text-sm">{payment.gateway}</span>,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-0">
      {/* Header — responsivo: empilha no mobile */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/clients')}
            leftIcon={<span>←</span>}
          >
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-gray-900">{client.contactName}</h1>
              {client.company && (
                <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-gray-600">{client.company}</p>
              )}
            </div>
            <Badge variant={CLIENT_STATUS_VARIANTS[client.status]}>
              {CLIENT_STATUS_LABELS[client.status]}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3">
          {client.status === ClientStatus.CANCELADO && (
            <Button
              variant="primary"
              onClick={handleReactivate}
              isLoading={reactivateMutation.isPending}
            >
              Reativar
            </Button>
          )}
          {client.status !== ClientStatus.CANCELADO && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                isLoading={cancelMutation.isPending}
              >
                <span className="hidden md:inline">Cancelar Cliente</span>
                <span className="md:hidden">Cancelar</span>
              </Button>
              <Button variant="primary" onClick={handleEdit}>
                Editar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2 px-2 md:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-2 px-2 md:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pagamentos ({payments?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`py-2 px-2 md:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'modules'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Módulos
          </button>
        </nav>
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
          <Card variant="bordered">
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Informações do Cliente</h3>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Nome do Responsável</dt>
                  <dd className="mt-1 text-sm text-gray-900">{client.contactName}</dd>
                </div>
                {client.company && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nome da Empresa</dt>
                    <dd className="mt-1 text-sm text-gray-900">{client.company}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">CPF/CNPJ</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {client.cpfCnpj.length === 11 ? formatCPF(client.cpfCnpj) : formatCNPJ(client.cpfCnpj)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">E-mail</dt>
                  <dd className="mt-1 text-sm text-gray-900">{client.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Telefone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatPhone(client.phone)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Informações de Assinatura</h3>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Produto</dt>
                  <dd className="mt-1">
                    <Badge variant="primary" size="sm">
                      {PRODUCT_LABELS[client.productType]}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <Badge variant={CLIENT_STATUS_VARIANTS[client.status]} size="sm">
                      {CLIENT_STATUS_LABELS[client.status]}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Data de Cadastro</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(client.createdAt)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'payments' && (
        <Card variant="bordered">
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Histórico de Pagamentos</h3>
          </CardHeader>
          <CardBody className="p-0">
            {payments && payments.length > 0 ? (
              <>
                {/* Mobile: card view */}
                <div className="md:hidden divide-y divide-gray-100">
                  {payments.map((payment) => {
                    const statusVariants = { PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'default' } as const;
                    const statusLabels = { PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Vencido', CANCELLED: 'Cancelado' };
                    return (
                      <div key={payment.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDate(payment.dueDate)}{payment.gateway ? ` · ${payment.gateway}` : ''}</p>
                        </div>
                        <Badge variant={statusVariants[payment.status as keyof typeof statusVariants]} size="sm">
                          {statusLabels[payment.status as keyof typeof statusLabels]}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: table view */}
                <div className="hidden md:block">
                  <DataTable
                    data={payments}
                    columns={paymentColumns}
                    keyExtractor={(payment) => payment.id}
                  />
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-gray-500">
                Nenhum pagamento registrado
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'modules' && id && (
        <Card variant="bordered">
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Módulos One Nexus</h3>
          </CardHeader>
          <CardBody>
            <ClientModulesTab clientId={id} />
          </CardBody>
        </Card>
      )}

      {isFormOpen && (
        <ClientForm client={client} onClose={() => setIsFormOpen(false)} onSuccess={handleFormSuccess} />
      )}
    </div>
  );
}
