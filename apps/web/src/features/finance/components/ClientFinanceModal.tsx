import React from 'react';
import { X, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { useClientTransactions } from '../hooks/useFinance';

interface ClientFinanceModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export const ClientFinanceModal: React.FC<ClientFinanceModalProps> = ({ clientId, clientName, onClose }) => {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const { data, isLoading } = useClientTransactions(clientId);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border w-full max-w-4xl rounded-2xl p-8`}>
          <div className="text-center text-zinc-500">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { client, totals, upcoming, transactions } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border w-full max-w-4xl rounded-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex justify-between items-start`}>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Histórico Financeiro
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {clientName}
              {client?.productType && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-nexus-orange/10 text-nexus-orange">
                  {client.productType === 'ONE_NEXUS' ? 'One Nexus' : 'Locadoras'}
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Totals Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`border p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">Total Pago</p>
                  <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    {totals.paidFormatted}
                  </p>
                </div>
                <TrendingUp className={`${isDark ? 'text-green-400' : 'text-green-600'}`} size={32} />
              </div>
            </div>

            <div className={`border p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">Total Pendente</p>
                  <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    {totals.pendingFormatted}
                  </p>
                </div>
                <Clock className={`${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} size={32} />
              </div>
            </div>

            <div className={`border p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">Total Vencido</p>
                  <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {totals.overdueFormatted}
                  </p>
                </div>
                <TrendingDown className={`${isDark ? 'text-red-400' : 'text-red-600'}`} size={32} />
              </div>
            </div>
          </div>

          {/* Próximos Vencimentos */}
          {upcoming.length > 0 && (
            <div className={`border p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-500" size={18} />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Próximos Vencimentos (7 dias)
                </h3>
              </div>
              <div className="space-y-2">
                {upcoming.map((u: any) => (
                  <div key={u.id} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">
                      {u.dueDateFormatted} - {u.description}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {u.amountFormatted}
                      </span>
                      <span className="text-xs text-blue-500 font-bold">
                        {u.daysRemaining}d
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Transações */}
          <div>
            <h3 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Histórico de Transações ({transactions.length})
            </h3>
            <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <table className="w-full text-left text-sm">
                <thead className={`${isDark ? 'bg-zinc-950/30 text-zinc-500' : 'bg-zinc-50 text-zinc-400'} text-xs font-bold uppercase`}>
                  <tr>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Categoria</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        Nenhuma transação
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t: any) => (
                      <tr key={t.id} className={`${isDark ? 'hover:bg-zinc-800/20' : 'hover:bg-zinc-50'}`}>
                        <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {t.description}
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                          {t.amountFormatted}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{t.dateFormatted}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.statusColor}`}>
                            {t.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{t.categoryLabel}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
          <button onClick={onClose} className="w-full py-2 bg-nexus-orange text-white rounded-lg font-bold hover:bg-nexus-orangeDark transition-all">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
