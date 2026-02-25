import React, { useState, useEffect } from 'react';
import { BarChart3, Download, AlertTriangle, Sparkles, X, Check, Edit, AlertCircle, Clock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { useUIStore } from '@/stores/useUIStore';
import { useMetrics, useMrrHistory, useArrHistory, useAgingReport, useTransactions, useOverdueClients, useUpcomingDueDates, useCreateTransaction, useUpdateTransaction, useMarkAsPaid, useDeleteTransaction, useClients } from './hooks/useFinance';
import { CATEGORY_LABELS, STATUS_LABELS, type TransactionCategory, type TransactionStatus, type Transaction } from './types';
import { formatDateLocal } from '@/utils/formatters';
import { ClientFinanceModal } from './components/ClientFinanceModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Finance: React.FC = () => {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [productFilter, setProductFilter] = useState<'ALL' | 'ONE_NEXUS' | 'LOCADORAS'>('ALL');
  const [mrrPeriod, setMrrPeriod] = useState<6 | 12 | 24 | 999>(6);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: '',
    dueDate: '', // v2.43.0: Campo de vencimento
    category: 'SUBSCRIPTION' as TransactionCategory,
    status: 'PENDING' as TransactionStatus,
    clientId: '' as string,
    productType: '' as 'ONE_NEXUS' | 'LOCADORAS' | '',
    isRecurring: false
  });
  // ✅ Filtros minimalistas APENAS para a tabela de transações
  const [filters, setFilters] = useState({
    category: '' as TransactionCategory | '',
    status: '' as TransactionStatus | '',
    sortByDate: '' as 'asc' | 'desc' | '',
    sortByAmount: '' as 'asc' | 'desc' | '',
  });

  const { data: metrics, isLoading: metricsLoading } = useMetrics(
    productFilter !== 'ALL' ? productFilter : undefined
  );
  const { data: mrrHistory = [] } = useMrrHistory(
    mrrPeriod,
    productFilter !== 'ALL' ? productFilter : undefined
  );
  const { data: arrHistory = [] } = useArrHistory(
    productFilter !== 'ALL' ? productFilter : undefined
  );
  const { data: agingReport } = useAgingReport(
    productFilter !== 'ALL' ? productFilter : undefined
  );
  const { data: transactions = [] } = useTransactions({
    ...(productFilter !== 'ALL' && { productType: productFilter }),
    ...(filters.category && { category: filters.category }),
    ...(filters.status && { status: filters.status }),
    ...(filters.sortByDate && { sortByDate: filters.sortByDate }),
    ...(filters.sortByAmount && { sortByAmount: filters.sortByAmount }),
  });
  const { data: overdueClients = [] } = useOverdueClients();
  const { data: upcomingDueDates = [] } = useUpcomingDueDates();
  const { data: clients = [] } = useClients();

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const markPaidMutation = useMarkAsPaid();
  const deleteMutation = useDeleteTransaction();

  // DEBUG: Log dos dados do gráfico
  useEffect(() => {
    console.log('[Finance] MRR History dados:', mrrHistory);
    console.log('[Finance] MRR History length:', mrrHistory?.length);
    console.log('[Finance] ARR History dados:', arrHistory);
  }, [mrrHistory, arrHistory]);

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setForm({
        description: transaction.description,
        amount: transaction.amount.toString(),
        date: transaction.date,
        dueDate: transaction.dueDate || '', // v2.43.0: Incluir dueDate
        category: transaction.category,
        status: transaction.status,
        clientId: transaction.clientId || '',
        productType: transaction.productType || '',
        isRecurring: transaction.isRecurring || false,
      });
    } else {
      setEditingTransaction(null);
      setForm({ description: '', amount: '', date: '', dueDate: '', category: 'SUBSCRIPTION', status: 'PENDING', clientId: '', productType: '', isRecurring: false });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // v2.43.0: Validar dueDate para categoria SUBSCRIPTION
    if (form.category === 'SUBSCRIPTION' && form.isRecurring && !form.dueDate) {
      alert('Data de vencimento é obrigatória para assinaturas recorrentes');
      return;
    }

    const payload = {
      description: form.description,
      amount: parseFloat(form.amount),
      type: 'INCOME',
      category: form.category,
      date: form.date,
      // v2.43.0: Incluir dueDate apenas para SUBSCRIPTION
      dueDate: (form.category === 'SUBSCRIPTION' && form.dueDate) ? form.dueDate : null,
      status: form.status,
      clientId: form.clientId || null,
      productType: form.productType || null,
      isRecurring: form.isRecurring,
    };

    if (editingTransaction) {
      await updateMutation.mutateAsync({ id: editingTransaction.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    setIsModalOpen(false);
    setEditingTransaction(null);
    setForm({ description: '', amount: '', date: '', dueDate: '', category: 'SUBSCRIPTION', status: 'PENDING', clientId: '', productType: '', isRecurring: false });
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('Nenhuma transação para exportar');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const productLabel = productFilter === 'ALL' ? 'Todos os Produtos' : productFilter === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras';

    // ========== SEÇÃO 1: MÉTRICAS PRINCIPAIS ==========
    const metricsSection = [
      `=== MÉTRICAS PRINCIPAIS (Data: ${today} | Produto: ${productLabel}) ===`,
      '',
      'Métrica,Valor,Variação',
      `MRR,${metrics?.mrr.formatted || 'R$ 0'},${metrics?.mrr.trend || '0%'}`,
      `ARR,${metrics?.arr.formatted || 'R$ 0'},${metrics?.arr.trend || '0%'}`,
      `NEW MRR,${metrics?.newMrr.formatted || 'R$ 0'},${metrics?.newMrr.trend || '0%'}`,
      `CHURN MRR,${metrics?.churnMrr.formatted || 'R$ 0'},${metrics?.churnMrr.trend || '0%'}`,
      `CHURN RATE,${metrics?.churnRate.formatted || '0%'},${metrics?.churnRate.trend || '0%'}`,
      `INADIMPLÊNCIA,${metrics?.inadimplencia.formatted || 'R$ 0'},${metrics?.inadimplencia.trend || '0%'}`,
      `YTD,${metrics?.ytd.formatted || 'R$ 0'},-`,
      '',
    ];

    // ========== SEÇÃO 2: ALERTAS ==========
    const alertsSection = [
      '=== ALERTAS ===',
      '',
    ];

    // Clientes Inadimplentes
    if (overdueClients.length > 0) {
      alertsSection.push('--- Clientes Inadimplentes ---');
      alertsSection.push('Cliente,Valor em Atraso,Produto,Dias em Atraso,Transações');
      overdueClients.forEach((client: any) => {
        alertsSection.push(`"${client.clientName}",${client.overdueAmountFormatted},${client.productType === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras'},${client.maxDaysOverdue},${client.transactionCount}`);
      });
      alertsSection.push('');
    }

    // Vencimentos Próximos (7 dias)
    if (upcomingDueDates.length > 0) {
      alertsSection.push('--- Vencimentos Próximos (7 dias) ---');
      alertsSection.push('Cliente,Produto,Descrição,Valor,Vencimento,Dias Restantes,Categoria');
      upcomingDueDates.forEach((due: any) => {
        alertsSection.push(`"${due.clientName}",${due.productType ? (due.productType === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras') : 'N/A'},"${due.description}",${due.amountFormatted},${due.dueDateFormatted},${due.daysRemaining},${due.categoryLabel}`);
      });
      alertsSection.push('');
    }

    if (overdueClients.length === 0 && upcomingDueDates.length === 0) {
      alertsSection.push('Nenhum alerta no momento.');
      alertsSection.push('');
    }

    // ========== SEÇÃO 3: TRANSAÇÕES ==========
    const transactionsSection = [
      '=== TRANSAÇÕES ===',
      '',
      'Cliente,Produto,Vendedor,Descrição,Valor,Data,Vencimento,Status,Categoria,Recorrente',
      ...transactions.map(t => [
        `"${t.client}"`,
        t.productTypeLabel || 'N/A',
        t.vendedor || 'N/A',
        `"${t.description}"`,
        t.amountFormatted,
        t.dateFormatted,
        t.dueDateFormatted || 'N/A',
        t.statusLabel,
        t.categoryLabel,
        t.isRecurring ? 'Sim' : 'Não',
      ].join(','))
    ];

    // Montar CSV completo
    const csvContent = [
      ...metricsSection,
      ...alertsSection,
      ...transactionsSection
    ].join('\n');

    // Criar Blob e fazer download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `financeiro-gestor-nexus-${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (transactions.length === 0) {
      alert('Nenhuma transação para exportar');
      return;
    }

    const doc = new jsPDF();
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR');
    const timeStr = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const productLabel = productFilter === 'ALL' ? 'Todos os Produtos' : productFilter === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras';

    // ========== CABEÇALHO ==========
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO FINANCEIRO - GESTOR NEXUS', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${dateStr} ${timeStr} | Produto: ${productLabel}`, 14, 28);

    // Linha separadora
    doc.setDrawColor(255, 115, 0); // Nexus orange
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    // ========== RESUMO EXECUTIVO ==========
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', 14, 40);

    const metricsData = [
      ['MRR', metrics?.mrr.formatted || 'R$ 0', metrics?.mrr.trend || '0%'],
      ['ARR', metrics?.arr.formatted || 'R$ 0', metrics?.arr.trend || '0%'],
      ['NEW MRR', metrics?.newMrr.formatted || 'R$ 0', metrics?.newMrr.trend || '0%'],
      ['CHURN MRR', metrics?.churnMrr.formatted || 'R$ 0', metrics?.churnMrr.trend || '0%'],
      ['CHURN RATE', metrics?.churnRate.formatted || '0%', metrics?.churnRate.trend || '0%'],
      ['INADIMPLÊNCIA', metrics?.inadimplencia.formatted || 'R$ 0', metrics?.inadimplencia.trend || '0%'],
      ['YTD', metrics?.ytd.formatted || 'R$ 0', '-'],
    ];

    autoTable(doc, {
      startY: 44,
      head: [['Métrica', 'Valor', 'Variação']],
      body: metricsData,
      theme: 'grid',
      headStyles: { fillColor: [255, 115, 0], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'center' }
      }
    });

    let yPos = (doc as any).lastAutoTable.finalY + 10;

    // ========== ALERTAS ==========
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ALERTAS', 14, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (overdueClients.length > 0 || upcomingDueDates.length > 0) {
      if (overdueClients.length > 0) {
        const totalOverdue = overdueClients.reduce((sum: number, client: any) => {
          const value = parseFloat(client.overdueAmountFormatted.replace(/[^\d,]/g, '').replace(',', '.'));
          return sum + value;
        }, 0);
        doc.text(`• ${overdueClients.length} clientes inadimplentes (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOverdue)})`, 14, yPos);
        yPos += 5;
      }
      if (upcomingDueDates.length > 0) {
        const totalUpcoming = upcomingDueDates.reduce((sum: number, due: any) => {
          const value = parseFloat(due.amountFormatted.replace(/[^\d,]/g, '').replace(',', '.'));
          return sum + value;
        }, 0);
        doc.text(`• ${upcomingDueDates.length} vencimentos nos próximos 7 dias (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalUpcoming)})`, 14, yPos);
        yPos += 5;
      }
    } else {
      doc.text('• Nenhum alerta no momento', 14, yPos);
      yPos += 5;
    }

    yPos += 5;

    // ========== TRANSAÇÕES ==========
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TRANSAÇÕES (${transactions.length} registros)`, 14, yPos);

    const transactionsData = transactions.slice(0, 100).map(t => [
      t.client.substring(0, 20),
      (t.productTypeLabel || 'N/A').substring(0, 8),
      t.amountFormatted,
      t.dateFormatted,
      t.statusLabel
    ]);

    autoTable(doc, {
      startY: yPos + 4,
      head: [['Cliente', 'Produto', 'Valor', 'Data', 'Status']],
      body: transactionsData,
      theme: 'striped',
      headStyles: { fillColor: [255, 115, 0], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' }
      }
    });

    // ========== RODAPÉ ==========
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150);
      doc.text(`Gerado em ${dateStr} às ${timeStr} | Gestor Nexus v2.14.0 | Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }

    // Download
    const filename = `relatorio-financeiro-${today.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const metricCards = metrics ? [
    { label: 'MRR', ...metrics.mrr },
    { label: 'YTD', ...metrics.ytd, hideTrend: true },
    { label: 'New MRR', ...metrics.newMrr },
    { label: 'Churn MRR', ...metrics.churnMrr },
    { label: 'Churn Rate', ...metrics.churnRate },
    { label: 'Inadimplência', ...metrics.inadimplencia },
    { label: 'ARR', ...metrics.arr },
  ] : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Financeiro Consolidado</h1>
          <p className="text-zinc-500">Controle de receitas, métricas de crescimento e cobranças.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value as any)}
            className={`px-4 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
          >
            <option value="ALL">Todos os Produtos</option>
            <option value="ONE_NEXUS">One Nexus</option>
            <option value="LOCADORAS">Locadoras</option>
          </select>
          <button onClick={handleExportCSV} className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border ${isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}>
            <Download size={18} /> Exportar CSV
          </button>
          <button onClick={handleExportPDF} className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border ${isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}>
            <Download size={18} /> Exportar PDF
          </button>
          <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-nexus-orange text-white rounded-lg text-sm font-semibold hover:bg-nexus-orangeDark transition-all active:scale-95 shadow-lg shadow-nexus-orange/20">
            Nova Transação
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {metricsLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`border p-4 rounded-xl animate-pulse ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
              <div className="h-3 bg-zinc-700 rounded w-20 mb-3" />
              <div className="h-6 bg-zinc-700 rounded w-24" />
            </div>
          ))
        ) : metricCards.map((m, i) => (
          <div key={i} className={`border p-4 rounded-xl relative overflow-hidden group transition-all ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
            {m.ai && <Sparkles size={24} className="absolute -top-1 -right-1 text-nexus-orange/20" />}
            <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5">
              {m.label} {m.ai && <Sparkles size={10} className="text-nexus-orange animate-pulse" />}
            </p>
            <div className="flex items-end justify-between mt-2">
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{m.formatted}</span>
              {!(m as any).hideTrend && m.trend && (
                <span className={`text-[10px] font-bold ${m.up ? 'text-green-500' : 'text-red-500'}`}>{m.trend}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`border p-6 rounded-2xl ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Breakdown do MRR</h3>
            <div className="flex gap-2">
              {[
                { label: '6M', value: 6 as const },
                { label: '1A', value: 12 as const },
                { label: '2A', value: 24 as const },
                { label: 'Tudo', value: 999 as const }
              ].map(period => (
                <button
                  key={period.value}
                  onClick={() => setMrrPeriod(period.value)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    mrrPeriod === period.value
                      ? 'bg-nexus-orange text-white'
                      : isDark
                        ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {mrrPeriod === 999 ? (
                // MODO ANUAL: Apenas ARR
                <AreaChart data={arrHistory}>
                  <defs>
                    <linearGradient id="arrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#f1f1f1'} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fff', border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7', borderRadius: '12px' }}
                    formatter={(value: number | undefined) => `R$ ${Math.abs(value || 0).toLocaleString('pt-BR')}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="arr"
                    stroke="#ea580c"
                    fill="url(#arrGradient)"
                    name="ARR"
                  />
                </AreaChart>
              ) : (
                // MODO MENSAL: Breakdown (new, expansion, churn)
                <AreaChart data={mrrHistory}>
                  <defs>
                    <linearGradient id="newFin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#f1f1f1'} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fff', border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7', borderRadius: '12px' }}
                    formatter={(value: number | undefined) => `R$ ${Math.abs(value || 0).toLocaleString('pt-BR')}`}
                  />
                  <Legend />
                  {/* TODAS empilhadas com stackId="1" */}
                  {/* 1. Base: MRR acumulado (laranja) */}
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stackId="1"
                    stroke="#ea580c"
                    fill="url(#newFin)"
                    name="MRR"
                  />
                  {/* 2. Meio: Expansion (cinza) */}
                  <Area
                    type="monotone"
                    dataKey="expansion"
                    stackId="1"
                    stroke="#71717a"
                    fill="#71717a"
                    fillOpacity={0.6}
                    name="expansion"
                  />
                  {/* 3. Topo: Churn (linha separada - não empilha) */}
                  <Area
                    type="monotone"
                    dataKey="churn"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.1}
                    name="churn"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`border p-6 rounded-2xl ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Aging Report</h3>
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <AlertTriangle size={14} className="text-yellow-500" /> Total: {agingReport?.totalFormatted || 'R$ 0'}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingReport?.data || []} layout="vertical" maxBarSize={50}>
                <XAxis type="number" hide />
                <YAxis dataKey="range" type="category" stroke="#a1a1aa" fontSize={12} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  cursor={{ fill: isDark ? '#27272a' : '#f8f8f8' }}
                  contentStyle={{
                    backgroundColor: isDark ? '#27272a' : '#ffffff',
                    border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '14px',
                  }}
                  labelStyle={{
                    color: isDark ? '#f4f4f5' : '#18181b',
                    fontWeight: 600,
                  }}
                  itemStyle={{
                    color: isDark ? '#a1a1aa' : '#71717a',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {(agingReport?.data || []).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#FF7300' : i === 1 ? '#D93D00' : '#4B4B4D'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={`mt-6 p-4 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-nexus-orange/10 text-nexus-orange rounded-lg"><BarChart3 size={18} /></div>
              <div>
                <p className={`text-sm font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Previsão IA</p>
                <p className="text-xs text-zinc-500">Estimamos aumento de 18% no MRR baseado no fluxo atual.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas: Pendências e Vencimentos Próximos */}
      {(overdueClients.length > 0 || upcomingDueDates.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clientes com Pendências */}
          {overdueClients.length > 0 && (
            <div className={`border p-6 rounded-2xl ${isDark ? 'bg-red-950/20 border-red-900/50' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="text-red-500" size={20} />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Clientes com Pendências ({overdueClients.length})
                </h3>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {overdueClients.slice(0, 10).map((client: any) => (
                  <div key={client.clientId} className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <button
                          onClick={() => setSelectedClient({ id: client.clientId, name: client.clientName })}
                          className={`font-bold hover:text-nexus-orange ${isDark ? 'text-white' : 'text-zinc-900'}`}
                        >
                          {client.clientName}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-nexus-orange/10 text-nexus-orange font-bold">
                            {client.productType === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras'}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {client.transactionCount} transação{client.transactionCount > 1 ? 'ões' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-500 font-bold">{client.overdueAmountFormatted}</div>
                        <div className="text-xs text-zinc-500 mt-1">{client.maxDaysOverdue} dias em atraso</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vencimentos Próximos (7 dias) */}
          {upcomingDueDates.length > 0 && (
            <div className={`border p-6 rounded-2xl ${isDark ? 'bg-yellow-950/20 border-yellow-900/50' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-yellow-500" size={20} />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Vencimentos Próximos - 7 dias ({upcomingDueDates.length})
                </h3>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {upcomingDueDates.slice(0, 10).map((due: any) => (
                  <div key={due.id} className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <button
                          onClick={() => due.clientId && setSelectedClient({ id: due.clientId, name: due.clientName })}
                          className={`font-bold hover:text-nexus-orange ${isDark ? 'text-white' : 'text-zinc-900'}`}
                        >
                          {due.clientName}
                        </button>
                        <div className="text-xs text-zinc-500 mt-1">{due.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {due.productType && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-nexus-orange/10 text-nexus-orange font-bold">
                              {due.productType === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras'}
                            </span>
                          )}
                          <span className="text-xs text-zinc-500">{due.categoryLabel}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{due.amountFormatted}</div>
                        <div className="text-xs text-yellow-600 font-bold mt-1">
                          {due.dueDateFormatted} ({due.daysRemaining}d)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
        <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <h3 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>Últimas Transações</h3>

          {/* Filtros Minimalistas */}
          <div className="flex gap-3 items-center flex-wrap">
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value as any })}
              className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
            >
              <option value="">Todas Categorias</option>
              <option value="SUBSCRIPTION">Assinatura</option>
              <option value="SETUP">Setup</option>
              <option value="SUPPORT">Suporte</option>
              <option value="CONSULTING">Consultoria</option>
              <option value="OTHER">Outros</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
            >
              <option value="">Todos Status</option>
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>

            <select
              value={filters.sortByDate}
              onChange={(e) => setFilters({ ...filters, sortByDate: e.target.value as any })}
              className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
            >
              <option value="">Ordenar: Data</option>
              <option value="desc">Mais recentes primeiro</option>
              <option value="asc">Mais antigos primeiro</option>
            </select>

            <select
              value={filters.sortByAmount}
              onChange={(e) => setFilters({ ...filters, sortByAmount: e.target.value as any })}
              className={`px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
            >
              <option value="">Ordenar: Valor</option>
              <option value="desc">Maior valor primeiro</option>
              <option value="asc">Menor valor primeiro</option>
            </select>

            <button
              onClick={() => setFilters({ category: '', status: '', sortByDate: '', sortByAmount: '' })}
              className="text-sm text-nexus-orange hover:underline font-semibold"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className={`${isDark ? 'bg-zinc-950/30 text-zinc-500' : 'bg-zinc-50 text-zinc-400'} text-xs font-bold uppercase`}>
            <tr>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Vencimento</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
            {transactions.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-500">Nenhuma transação</td></tr>
            ) : transactions.map(t => (
              <tr key={t.id} className={`${isDark ? 'hover:bg-zinc-800/20' : 'hover:bg-zinc-50'}`}>
                <td className={`px-6 py-4 text-sm font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {t.clientId ? (
                    <div>
                      <button
                        onClick={() => setSelectedClient({ id: t.clientId!, name: t.client })}
                        className="hover:text-nexus-orange underline decoration-dotted"
                      >
                        {t.client}
                      </button>
                      {t.clientContactName && (
                        <span className="text-xs text-zinc-500 block">
                          {t.clientContactName}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>{t.client}</span>
                  )}
                </td>
                <td className={`px-6 py-4 text-sm font-mono font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{t.amountFormatted}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{t.dateFormatted}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">
                  {t.dueDate ? formatDateLocal(t.dueDate) : '-'}
                </td>
                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.statusColor}`}>{t.statusLabel}</span></td>
                <td className="px-6 py-4 text-xs text-zinc-400">{t.categoryLabel}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleOpenModal(t)} className="p-1 text-blue-500 hover:bg-blue-500/10 rounded" title="Editar">
                      <Edit size={16} />
                    </button>
                    {t.status === 'PENDING' && (
                      <button onClick={() => markPaidMutation.mutate(t.id)} className="p-1 text-green-500 hover:bg-green-500/10 rounded" title="Pagar">
                        <Check size={16} />
                      </button>
                    )}
                    <button onClick={() => {
                      if (window.confirm('Tem certeza de que deseja excluir esta transação? Esta ação não pode ser desfeita.')) {
                        deleteMutation.mutate(t.id);
                      }
                    }} className="p-1 text-red-500 hover:bg-red-500/10 rounded" title="Excluir">
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border w-full max-w-lg rounded-2xl`}>
            <form onSubmit={handleSubmit}>
              <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex justify-between items-center`}>
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
                </h2>
                <button type="button" onClick={() => {
                  setIsModalOpen(false);
                  setEditingTransaction(null);
                  setForm({ description: '', amount: '', date: '', dueDate: '', category: 'SUBSCRIPTION', status: 'PENDING', clientId: '', productType: '', isRecurring: false });
                }} className="text-zinc-500"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase">Cliente (opcional)</label>
                  <select
                    className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`}
                    value={form.clientId}
                    onChange={e => setForm({...form, clientId: e.target.value, productType: e.target.value ? (clients.find(c => c.id === e.target.value)?.productType || '') : form.productType})}
                  >
                    <option value="">Transação avulsa (sem cliente)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.company} ({client.productType === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras'})
                      </option>
                    ))}
                  </select>
                </div>
                {!form.clientId && (
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Produto *</label>
                    <select
                      required
                      className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`}
                      value={form.productType}
                      onChange={e => setForm({...form, productType: e.target.value as 'ONE_NEXUS' | 'LOCADORAS'})}
                    >
                      <option value="">Selecione um produto</option>
                      <option value="ONE_NEXUS">One Nexus</option>
                      <option value="LOCADORAS">Locadoras</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase">Descrição</label>
                  <input required className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Valor (R$)</label>
                    <input required type="number" step="0.01" className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Data</label>
                    <input required type="date" className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`} value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Categoria</label>
                    <select className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`} value={form.category} onChange={e => setForm({...form, category: e.target.value as TransactionCategory})}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Status</label>
                    <select className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`} value={form.status} onChange={e => setForm({...form, status: e.target.value as TransactionStatus})}>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                {/* v2.43.0: Campo de Vencimento - Aparece APENAS para categoria Assinatura */}
                {form.category === 'SUBSCRIPTION' && (
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">
                      Data de Vencimento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className={`w-full mt-1 rounded-lg px-4 py-2 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-300'}`}
                      required={form.category === 'SUBSCRIPTION'}
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Data do próximo vencimento da assinatura
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isRecurring" checked={form.isRecurring} onChange={e => setForm({...form, isRecurring: e.target.checked})} className="rounded" />
                  <label htmlFor="isRecurring" className="text-sm text-zinc-400">Recorrente (MRR)</label>
                </div>
              </div>
              <div className={`p-6 border-t flex gap-4 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                <button type="button" onClick={() => {
                  setIsModalOpen(false);
                  setEditingTransaction(null);
                  setForm({ description: '', amount: '', date: '', dueDate: '', category: 'SUBSCRIPTION', status: 'PENDING', clientId: '', productType: '', isRecurring: false });
                }} className="flex-1 py-2 text-zinc-500 text-sm font-bold">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 py-2 bg-nexus-orange text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : editingTransaction ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Cliente */}
      {selectedClient && (
        <ClientFinanceModal
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          onClose={() => setSelectedClient(null)}
        />
      )}

    </div>
  );
};
