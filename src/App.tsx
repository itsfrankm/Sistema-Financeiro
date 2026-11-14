import React from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import {
  LoginScreen,
  AccessManagementPanel,
} from './components/auth/LoginScreen';
import { AppShell } from './components/layout/AppShell';
import { WalletsAndCardsView } from './components/wallets/WalletsAndCardsView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { PlanningView } from './components/planning/PlanningView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';

const MainWorkspaceContent: React.FC = () => {
  const { currentUser, activeTab } = useFinance();

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      {activeTab === 'gerenciar_acessos' ? (
        <AccessManagementPanel />
      ) : activeTab === 'transacoes' ? (
        <TransactionsView />
      ) : activeTab === 'contas_cartoes' ? (
        <WalletsAndCardsView />
      ) : activeTab === 'orcamentos' || activeTab === 'metas' ? (
        <PlanningView />
      ) : activeTab === 'relatorios' ? (
        <ReportsView />
      ) : activeTab === 'configuracoes' ? (
        <SettingsView />
      ) : (
        <DashboardView />
      )}
    </AppShell>
  );
};

export function App() {
  return (
    <FinanceProvider>
      <MainWorkspaceContent />
    </FinanceProvider>
  );
}

export default App;
