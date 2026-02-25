import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/useApi';
import { DashboardStats, ProductType, GenerateInsightsResponseDto, InsightSeverity } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUIStore } from '@/stores/useUIStore';
import { ExpandableActivityCard } from './components/ExpandableActivityCard';
import { fetchPaginatedLeads, fetchPaginatedClients, fetchPaginatedPayments } from '@/services/api';
import {
  Users,
  TrendingUp,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  UserPlus,
  Clock,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ✅ v2.51.0: Removido PERIOD_OPTIONS - Dashboard não tem mais filtro de tempo global

const PRODUCT_OPTIONS = [
  { value: '', label: 'Todos os produtos' },
  { value: ProductType.ONE_NEXUS, label: 'One Nexus' },
  { value: ProductType.LOCADORAS, label: 'Locadoras' },
];

// Colors for plan charts (fixed by plan name)
const PLAN_COLORS: Record<string, string> = {
  'One Nexus Basic': '#a1a1aa',       // Zinc-400 (cinza claro)
  'One Nexus Pro': '#71717a',         // Zinc-500 (cinza médio)
  'One Nexus Enterprise': '#FF7300',  // Nexus Orange (destaque)
  'Locadoras Gold': '#D93D00',        // Vermelho alaranjado
  'Locadoras Standard': '#4B4B4D',    // Cinza escuro
};

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: React.ElementType;
  subValue?: string;
  isDark: boolean;
}

function MetricCard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  subValue,
  isDark,
}: MetricCardProps) {
  return (
    <div
      className={`${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
      } border p-6 rounded-2xl transition-all duration-300`}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-2.5 rounded-xl text-nexus-orange ${
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          }`}
        >
          <Icon size={24} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trendUp
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-zinc-500 text-sm font-medium">{title}</p>
      <h3
        className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}
      >
        {value}
      </h3>
      {subValue && <p className="text-xs text-zinc-400 mt-2">{subValue}</p>}
    </div>
  );
}

export function Dashboard() {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();
  const [product, setProduct] = useState('');
  const [mrrGraphPeriod, setMrrGraphPeriod] = useState<6 | 12>(12); // ✅ v2.50.2: Filtro próprio do gráfico MRR

  // ✅ v2.51.0: Query principal (MoM - Month over Month)
  const { data: stats, isLoading } = useApiQuery<DashboardStats>(
    ['dashboard-stats', product],
    `/dashboard/stats${product ? `?product=${product}` : ''}`,
    {
      refetchInterval: 3 * 60 * 1000, // ✅ v2.50.3: Polling a cada 3 minutos
      staleTime: 2 * 60 * 1000, // Considera stale após 2 minutos
    },
  );

  // ✅ v2.50.2: Query separada para gráfico MRR (não afetada por filtros globais)
  const { data: mrrGraphData } = useApiQuery<DashboardStats['revenueOverTime']>(
    ['dashboard-mrr-graph', mrrGraphPeriod, product],
    `/dashboard/stats${product ? `?product=${product}` : ''}`,
    {
      select: (data: any) => data.revenueOverTime || [],
    },
  );

  // ✅ v2.51.0: Query de insights de IA (MoM)
  const {
    data: insights,
    isLoading: insightsLoading,
  } = useApiQuery<GenerateInsightsResponseDto>(
    ['dashboard-insights', product],
    `/dashboard/insights${product ? `?product=${product}` : ''}`,
    {
      staleTime: 30 * 60 * 1000, // 30 minutes
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-nexus-orange border-r-transparent"></div>
          <p className={`mt-4 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Carregando dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  // Preparar dados para gráficos
  const revenueOverTimeData = (mrrGraphData || []).map((item) => ({
    month: format(new Date(item.month), 'MMM/yy', { locale: ptBR }),
    mrr: item.revenue,
  }));

  // ✅ v2.50.5: Ordenação customizada dos planos
  const PLAN_ORDER = [
    'One Nexus Enterprise',
    'One Nexus Pro',
    'One Nexus Basic',
    'Locadoras Gold',
    'Locadoras Standard',
  ];

  const clientsByPlanData = (stats.clientsByPlan || [])
    .map((item) => ({
      name: item.plan,
      value: item.count,
      color: PLAN_COLORS[item.plan] || '#71717a', // Fallback: zinc-500
    }))
    .sort((a, b) => {
      const indexA = PLAN_ORDER.indexOf(a.name);
      const indexB = PLAN_ORDER.indexOf(b.name);
      // Se não encontrado no array, coloca no final
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Dashboard
          </h1>
          <p className="text-zinc-500">Bem-vindo de volta! Aqui está o resumo de hoje.</p>
        </div>
        {/* ✅ v2.51.0: Apenas filtro de produto (removido filtro de tempo global) */}
        <div className="flex gap-2">
          {PRODUCT_OPTIONS.length > 2 && (
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className={`text-xs rounded-lg px-4 py-2 outline-none border ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  : 'bg-zinc-200 hover:bg-zinc-300 border-zinc-300 text-zinc-800'
              } transition-colors`}
            >
              {PRODUCT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total de Clientes"
          value={stats.kpis.totalClients}
          trend={stats.kpis.totalClientsTrend}
          trendUp={stats.kpis.totalClientsTrendUp}
          icon={Users}
          subValue={`${stats.kpis.activeClients} ativos`}
          isDark={isDark}
        />
        <MetricCard
          title="MRR Consolidado"
          value={formatCurrency(stats.kpis.mrr)}
          trend={stats.kpis.mrrTrend}
          trendUp={stats.kpis.mrrTrendUp}
          icon={TrendingUp}
          subValue="Monthly Recurring Revenue"
          isDark={isDark}
        />
        <MetricCard
          title="Leads em Aberto"
          value={stats.kpis.totalLeads}
          trend={stats.kpis.totalLeadsTrend || `${stats.kpis.conversionRate}%`}
          trendUp={stats.kpis.totalLeadsTrendUp ?? stats.kpis.conversionRate > 50}
          icon={Briefcase}
          subValue={`${stats.kpis.conversionRate}% de conversão`}
          isDark={isDark}
        />
        <MetricCard
          title="Inadimplência"
          value={stats.kpis.overduePayments}
          trend={stats.kpis.overduePaymentsTrend}
          trendUp={stats.kpis.overduePaymentsTrendUp}
          icon={AlertCircle}
          subValue="Pagamentos vencidos"
          isDark={isDark}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IA Insights - v2.49.0: Real AI-powered insights */}
        <div
          className={`lg:col-span-2 border p-6 rounded-2xl relative overflow-hidden group transition-all duration-300 ${
            isDark
              ? 'bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700'
              : 'bg-white border-zinc-200 shadow-sm'
          }`}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-nexus-orange">
                  <Sparkles size={20} />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Insights da IA
                  </span>
                </div>
                {/* ✅ v2.53.0: Cache badge */}
                {insights?.metadata?.cached && (
                  <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    <Clock size={10} />
                    <span>
                      {(() => {
                        const cachedAt = insights.metadata.cachedAt
                          ? new Date(insights.metadata.cachedAt)
                          : new Date();
                        const now = new Date();
                        const diffMinutes = Math.floor(
                          (now.getTime() - cachedAt.getTime()) / 60000
                        );
                        return diffMinutes === 0
                          ? 'Agora'
                          : diffMinutes === 1
                          ? 'há 1 min'
                          : `há ${diffMinutes} min`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['dashboard-insights'] });
                }}
                disabled={insightsLoading}
                className="text-xs text-zinc-500 hover:text-nexus-orange transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={insightsLoading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
            <h2
              className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-zinc-900'}`}
            >
              Nexus Intel
            </h2>

            {insightsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`${
                      isDark ? 'bg-zinc-950/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
                    } p-4 rounded-xl border flex items-start gap-4`}
                  >
                    {/* ✅ v2.53.0: Skeleton com animação profissional (pattern Stripe) */}
                    <div className="w-2 h-2 mt-2 rounded-full bg-zinc-700 animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div
                        className={`h-4 ${
                          isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                        } rounded w-3/4 animate-pulse`}
                      ></div>
                      <div
                        className={`h-3 ${
                          isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                        } rounded w-full animate-pulse`}
                      ></div>
                      <div
                        className={`h-3 ${
                          isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                        } rounded w-5/6 animate-pulse`}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {insights?.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`${
                      isDark ? 'bg-zinc-950/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
                    } p-4 rounded-xl border flex items-start gap-4`}
                  >
                    <div
                      className={`w-2 h-2 mt-2 rounded-full ${
                        insight.severity === InsightSeverity.CRITICAL
                          ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : insight.severity === InsightSeverity.WARNING
                          ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                          : insight.severity === InsightSeverity.SUCCESS
                          ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : 'bg-nexus-orange shadow-[0_0_8px_rgba(255,115,0,0.5)]'
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p
                        className={`font-semibold text-sm ${
                          isDark ? 'text-zinc-200' : 'text-zinc-900'
                        }`}
                      >
                        {insight.title}
                      </p>
                      <p className="text-zinc-500 text-xs mt-1">{insight.description}</p>
                      {insight.actionable && (
                        <p className="text-nexus-orange text-xs mt-2 font-medium">
                          → {insight.actionable}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Distribution Chart */}
        <div
          className={`border p-6 rounded-2xl transition-all duration-300 ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
          }`}
        >
          <h3
            className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-zinc-900'}`}
          >
            Distribuição por Plano
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientsByPlanData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {clientsByPlanData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#18181b' : '#fff',
                    border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {clientsByPlanData.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: p.color }}
                  ></div>
                  <span className="text-zinc-500">{p.name}</span>
                </div>
                <span
                  className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-900'}`}
                >
                  {p.value} clientes
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main MRR Chart */}
      <div
        className={`border p-6 rounded-2xl transition-all duration-300 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
        }`}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Evolução do MRR
            </h3>
            <p className="text-zinc-500 text-xs">
              Crescimento anual de receita recorrente
            </p>
          </div>
          {/* ✅ v2.50.2: Filtro de período próprio do gráfico */}
          <div className="flex gap-2">
            {[
              { value: 6, label: '6 meses' },
              { value: 12, label: '12 meses' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMrrGraphPeriod(opt.value as 6 | 12)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  mrrGraphPeriod === opt.value
                    ? 'bg-nexus-orange text-white font-semibold'
                    : isDark
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          {revenueOverTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueOverTimeData}>
                <defs>
                  <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7300" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF7300" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? '#27272a' : '#f1f1f1'}
                />
                <XAxis
                  dataKey="month"
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#18181b' : '#fff',
                    border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7',
                    borderRadius: '12px',
                  }}
                  itemStyle={{ color: '#FF7300' }}
                  formatter={(value: any) => [formatCurrency(value), 'MRR']}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="#FF7300"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorMrr)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              Sem dados de receita
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities - v2.48.0 (Expandable Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads Card */}
        <ExpandableActivityCard
          title="Leads Recentes"
          icon={Briefcase}
          initialItems={stats.recentActivity.recentLeads}
          fetchMore={fetchPaginatedLeads}
          renderItem={(lead) => (
            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <p className={`font-semibold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                {lead.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-500">{lead.origin}</span>
                <span className="text-xs text-zinc-400">•</span>
                <span className="text-xs text-zinc-400">
                  {format(new Date(lead.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            </div>
          )}
          emptyMessage="Nenhum lead recente"
          viewAllLabel="Ver todos os leads"
          isDark={isDark}
        />

        {/* Clients Card */}
        <ExpandableActivityCard
          title="Novos Clientes"
          icon={UserPlus}
          initialItems={stats.recentActivity.recentClients}
          fetchMore={fetchPaginatedClients}
          renderItem={(client) => (
            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <p className={`font-semibold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                {client.responsibleName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    client.productType === ProductType.ONE_NEXUS
                      ? 'bg-nexus-orange/10 text-nexus-orange'
                      : 'bg-[#D93D00]/10 text-[#D93D00]'
                  }`}
                >
                  {client.planName}
                </span>
                <span className="text-xs text-zinc-400">•</span>
                <span className="text-xs text-zinc-400">
                  {format(new Date(client.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            </div>
          )}
          emptyMessage="Nenhum cliente recente"
          viewAllLabel="Ver todos os clientes"
          isDark={isDark}
        />

        {/* Payments Card */}
        <ExpandableActivityCard
          title="Próximos Vencimentos"
          icon={Clock}
          initialItems={stats.recentActivity.upcomingPayments}
          fetchMore={fetchPaginatedPayments}
          renderItem={(payment) => (
            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <p className={`font-semibold text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                {payment.clientName}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-zinc-500">{formatCurrency(payment.amount)}</span>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Calendar size={12} />
                  {payment.dueDate
                    ? format(new Date(payment.dueDate), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Sem data'}
                </div>
              </div>
            </div>
          )}
          emptyMessage="Nenhum pagamento próximo"
          viewAllLabel="Ver todos os vencimentos"
          isDark={isDark}
        />
      </div>
    </div>
  );
}
