import { useState } from 'react';
import { useApiQuery } from '@/hooks/useApi';
import {
  Card,
  CardHeader,
  CardBody,
  DataTable,
  Column,
  Badge,
  Select,
  Loading,
  EmptyState,
  Pagination,
} from '@/components/ui';
import { Payment, PaymentStatus, PaymentGateway } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface PaymentStats {
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  countPaid: number;
  countPending: number;
  countOverdue: number;
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pendente',
  [PaymentStatus.PAID]: 'Pago',
  [PaymentStatus.OVERDUE]: 'Vencido',
  [PaymentStatus.CANCELLED]: 'Cancelado',
  [PaymentStatus.REFUNDED]: 'Reembolsado',
};

const STATUS_VARIANTS: Record<PaymentStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  [PaymentStatus.PENDING]: 'warning',
  [PaymentStatus.PAID]: 'success',
  [PaymentStatus.OVERDUE]: 'danger',
  [PaymentStatus.CANCELLED]: 'default',
  [PaymentStatus.REFUNDED]: 'info' as any,
};

const GATEWAY_LABELS: Record<PaymentGateway, string> = {
  [PaymentGateway.ASAAS]: 'Asaas',
  [PaymentGateway.ABACATEPAY]: 'AbacatePay',
  [PaymentGateway.MANUAL]: 'Manual',
};

export function PaymentsDashboard() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [gatewayFilter, setGatewayFilter] = useState<PaymentGateway | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: payments, isLoading: isLoadingPayments } = useApiQuery<Payment[]>(
    ['payments'],
    '/payments'
  );

  const { data: stats, isLoading: isLoadingStats } = useApiQuery<PaymentStats>(
    ['payments', 'stats'],
    '/payments/stats'
  );

  // Filtros
  const filteredPayments = (payments || []).filter((payment) => {
    const matchesStatus = statusFilter === '' || payment.status === statusFilter;
    const matchesGateway = gatewayFilter === '' || payment.gateway === gatewayFilter;
    return matchesStatus && matchesGateway;
  });

  // Paginação
  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

  const columns: Column<Payment>[] = [
    {
      key: 'dueDate',
      label: 'Vencimento',
      sortable: true,
      render: (payment) => (
        <div className="text-sm">
          <div className="font-medium">{formatDate(payment.dueDate)}</div>
          {payment.paidAt && (
            <div className="text-xs text-gray-500">Pago: {formatDate(payment.paidAt)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'client',
      label: 'Cliente',
      sortable: true,
      render: (payment) => (
        <div className="text-sm">
          <div className="font-medium">{payment.client?.contactName || 'N/A'}</div>
          {payment.client?.company && (
            <div className="text-xs text-gray-500">{payment.client.company}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Valor',
      sortable: true,
      render: (payment) => (
        <span className="font-medium text-gray-900">{formatCurrency(payment.amount)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (payment) => (
        <Badge variant={STATUS_VARIANTS[payment.status]} size="sm">
          {STATUS_LABELS[payment.status]}
        </Badge>
      ),
    },
    {
      key: 'gateway',
      label: 'Gateway',
      sortable: true,
      render: (payment) => <span className="text-sm">{GATEWAY_LABELS[payment.gateway]}</span>,
    },
    {
      key: 'externalId',
      label: 'ID Externo',
      render: (payment) => (
        <span className="text-xs font-mono text-gray-600">
          {payment.externalId || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
        <p className="mt-1 text-sm text-gray-600">
          Acompanhe pagamentos e métricas financeiras
        </p>
      </div>

      {/* Cards de Métricas */}
      {isLoadingStats ? (
        <Loading text="Carregando estatísticas..." />
      ) : stats ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card variant="elevated">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pagos no Mês</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">
                    {formatCurrency(stats.totalPaid)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{stats.countPaid} pagamentos</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
                  ✓
                </div>
              </div>
            </CardBody>
          </Card>

          <Card variant="elevated">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pendentes</p>
                  <p className="mt-1 text-2xl font-bold text-yellow-600">
                    {formatCurrency(stats.totalPending)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{stats.countPending} pagamentos</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-2xl">
                  ⏳
                </div>
              </div>
            </CardBody>
          </Card>

          <Card variant="elevated">
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Vencidos</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">
                    {formatCurrency(stats.totalOverdue)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{stats.countOverdue} pagamentos</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
                  ⚠️
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* Lista de Pagamentos */}
      <Card variant="bordered">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-900">Pagamentos Recentes</h3>
            <div className="flex gap-3">
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | '')}
                options={[
                  { value: '', label: 'Todos os status' },
                  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
              <Select
                placeholder="Gateway"
                value={gatewayFilter}
                onChange={(e) => setGatewayFilter(e.target.value as PaymentGateway | '')}
                options={[
                  { value: '', label: 'Todos os gateways' },
                  ...Object.entries(GATEWAY_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {isLoadingPayments ? (
            <Loading text="Carregando pagamentos..." />
          ) : filteredPayments.length === 0 && (statusFilter || gatewayFilter) ? (
            <EmptyState
              title="Nenhum pagamento encontrado"
              description="Tente ajustar os filtros"
            />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              title="Nenhum pagamento registrado"
              description="Os pagamentos aparecerão aqui quando forem criados"
            />
          ) : (
            <>
              <DataTable
                data={paginatedPayments}
                columns={columns}
                keyExtractor={(payment) => payment.id}
              />
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
