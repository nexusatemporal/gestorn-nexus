import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Dashboard } from '@/features/dashboard';
import { ClientsList, ClientDetails } from '@/features/clients';
import { ProductType, UserRole } from '@/types';
import { LeadKanban } from '@/features/leads';
import { PaymentsDashboard } from '@/features/payments';
import { CalendarView } from '@/features/calendar/components';
import { Finance } from '@/features/finance';
import SalesAI from '@/pages/SalesAI/SalesAI';
import { Settings } from '@/features/settings';
import { useUIStore } from '@/stores/useUIStore';
import { useAuth } from '@/contexts/AuthContext';
import { Login } from '@/pages/Login/Login';

function App() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const userRole = (user?.role as UserRole) || UserRole.VENDEDOR;

  if (isLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <div className="w-8 h-8 border-2 border-nexus-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      {!isAuthenticated ? (
        <Login />
      ) : (
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientsList product={ProductType.ONE_NEXUS} role={userRole} />} />
            <Route path="/clients/:id" element={<ClientDetails />} />
            <Route path="/clients-locadoras" element={<ClientsList product={ProductType.LOCADORAS} role={userRole} />} />
            <Route path="/leads" element={<LeadKanban />} />
            <Route path="/payments" element={<PaymentsDashboard />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/sales-ai" element={<SalesAI />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </div>
  );
}

export default App;
