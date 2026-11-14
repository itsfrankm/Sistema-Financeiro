import React, { useState } from 'react';
import {
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  PieChart,
  FileBarChart2,
  Settings,
  ShieldCheck,
  Plus,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  EyeOff,
  LogOut,
  Calendar,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { AppTab } from '../../types/finance';
import { formatMonthYearDisplay, shiftYearMonth } from '../../lib/utils';
import { TransactionModal } from '../transactions/TransactionModal';

interface NavItemConfig {
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const DESKTOP_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Visão Geral',
    shortLabel: 'Início',
    icon: LayoutDashboard,
  },
  {
    id: 'transacoes',
    label: 'Lançamentos',
    shortLabel: 'Extrato',
    icon: ArrowLeftRight,
  },
  {
    id: 'contas_cartoes',
    label: 'Contas & Cartões',
    shortLabel: 'Contas',
    icon: CreditCard,
  },
  {
    id: 'orcamentos',
    label: 'Planejamento',
    shortLabel: 'Planejamento',
    icon: PieChart,
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    shortLabel: 'Relatórios',
    icon: FileBarChart2,
  },
  {
    id: 'configuracoes',
    label: 'Personalização',
    shortLabel: 'Personalizar',
    icon: Settings,
  },
  {
    id: 'gerenciar_acessos',
    label: 'Gerenciar Acessos',
    shortLabel: 'Acessos',
    icon: ShieldCheck,
    adminOnly: true,
  },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    logout,
    activeTab,
    setActiveTab,
    selectedMonth,
    setSelectedMonth,
    userSettings,
    toggleHideValues,
    setIsQuickTransactionOpen,
  } = useFinance();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const visibleNavItems = DESKTOP_NAV_ITEMS.filter(
    (item) => !item.adminOnly || currentUser?.role === 'admin'
  );

  const handleOpenQuickModal = () => {
    setIsQuickTransactionOpen(true);
  };

  const rawName = (
    userSettings.nome_exibicao ||
    currentUser?.nome_exibicao ||
    'Franklin'
  ).replace(/\s*\(Admin\)$/i, '');

  const cleanDisplayName =
    rawName === 'Franklin Miguel' || rawName === 'Franklin Pessoal'
      ? 'Franklin'
      : rawName;

  const userInitials = cleanDisplayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-app-bg text-app-text">
      {/* =====================================================================
          VISÃO WEB / DESKTOP (>= 768px): SIDEBAR FIXA E RECOLHÍVEL À ESQUERDA
          ===================================================================== */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 z-30 surface-card border-r border-app-border transition-all duration-300 ${
          isSidebarCollapsed ? 'md:w-20' : 'md:w-72'
        }`}
      >
        {/* Topo da Sidebar: Logo Executiva + Botão Recolher */}
        <div
          className={`p-4 flex border-b border-app-border ${
            isSidebarCollapsed
              ? 'flex-col items-center gap-3'
              : 'items-center justify-between'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl theme-badge-subtle flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-base tracking-tight truncate leading-none">
                  Gestor Financeiro
                </h1>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            title={isSidebarCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu Lateral'}
            className="p-2 rounded-xl surface-elevated hover:border-app-primary text-app-muted hover:text-app-text shrink-0 transition-colors"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Botão "Lançamento" (Dinâmico conforme a paleta ativa, fosco e elegante) */}
        <div className="p-4 pb-2">
          <button
            type="button"
            onClick={handleOpenQuickModal}
            title="Lançamento"
            className={`w-full py-2.5 rounded-xl font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors btn-primary-theme ${
              isSidebarCollapsed ? 'px-0' : 'px-4'
            }`}
          >
            {isSidebarCollapsed ? (
              <Plus className="w-4 h-4 stroke-[2.25]" />
            ) : (
              <span>Lançamento</span>
            )}
          </button>
        </div>

        {/* Abas de Navegação Desktop */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isSidebarCollapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'sidebar-nav-active font-semibold'
                    : 'border border-transparent text-app-muted hover:text-app-text hover:bg-app-elevated/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!isSidebarCollapsed && item.adminOnly && (
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-md badge-amber-executive">
                    Admin
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar: Card de Usuário Sóbrio e Elegante */}
        <div className="p-3.5 border-t border-app-border">
          <div
            className={`flex items-center ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between gap-2.5'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {userSettings.avatar_url ? (
                <img
                  src={userSettings.avatar_url}
                  alt={cleanDisplayName}
                  className="w-9 h-9 rounded-full object-cover border border-app-border shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full theme-badge-subtle flex items-center justify-center font-semibold text-xs shrink-0">
                  {userInitials}
                </div>
              )}

              {!isSidebarCollapsed && (
                <div className="min-w-0 flex flex-col items-start gap-1">
                  <p className="text-sm font-semibold text-app-text truncate leading-none">
                    {cleanDisplayName}
                  </p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium theme-badge-subtle leading-none">
                    {currentUser?.role === 'admin' ? 'Administrador' : 'Membro'}
                  </span>
                </div>
              )}
            </div>

            {!isSidebarCollapsed && (
              <button
                type="button"
                onClick={logout}
                title="Encerrar Sessão"
                className="p-2 rounded-lg text-app-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          CONTAINER PRINCIPAL + HEADER SUPERIOR LIMPO
          ===================================================================== */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 pb-24 md:pb-8 ${
          isSidebarCollapsed ? 'md:pl-20' : 'md:pl-72'
        }`}
      >
        {/* HEADER SUPERIOR LIMPO (Título + Botão de Privacidade) */}
        <header className="sticky top-0 z-20 backdrop-blur-md bg-app-bg/90 border-b border-app-border px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Identificação Mobile / Título da Aba */}
          <div className="flex items-center gap-3">
            <div className="md:hidden w-9 h-9 rounded-xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center text-violet-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                {DESKTOP_NAV_ITEMS.find((i) => i.id === activeTab)?.label ?? 'Visão Geral'}
              </h2>
            </div>
          </div>

          {/* Controle de Privacidade ("Olhinho") + Atalhos Mobile */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleHideValues}
              title={
                userSettings.ocultar_valores
                  ? 'Mostrar Valores Monetários'
                  : 'Modo Privacidade: Ocultar Valores (R$ ••••••)'
              }
              className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                userSettings.ocultar_valores
                  ? 'badge-amber-executive'
                  : 'surface-elevated border-app-border text-app-text hover:border-violet-500/40'
              }`}
            >
              {userSettings.ocultar_valores ? (
                <>
                  <EyeOff className="w-4 h-4 text-amber-executive" />
                  <span className="hidden lg:inline">R$ ••••••</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-violet-400" />
                  <span className="hidden lg:inline">Valores Visíveis</span>
                </>
              )}
            </button>

            {/* Botão Admin Acessos Mobile */}
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('gerenciar_acessos')}
                title="Gerenciar Acessos Multi-Tenant"
                className={`md:hidden p-2 rounded-xl transition-colors ${
                  activeTab === 'gerenciar_acessos'
                    ? 'sidebar-nav-active'
                    : 'surface-elevated text-app-muted'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            {/* Logout Mobile */}
            <button
              type="button"
              onClick={logout}
              title="Sair"
              className="md:hidden surface-elevated p-2 rounded-xl text-app-muted hover:text-rose-400"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Área Principal da Aba Ativa */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* =====================================================================
          VISÃO MOBILE (< 768px): BOTTOM NAVIGATION BAR + BOTÃO CENTRAL (+)
          ===================================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 surface-card border-t border-app-border px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-violet-400 font-semibold' : 'text-app-muted'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Visão Geral</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transacoes')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
            activeTab === 'transacoes' ? 'text-violet-400 font-semibold' : 'text-app-muted'
          }`}
        >
          <ArrowLeftRight className="w-5 h-5" />
          <span>Lançamentos</span>
        </button>

        {/* BOTÃO CENTRAL FLUTUANTE (+) DINÂMICO CONFORME A PALETA */}
        <div className="relative -top-5">
          <button
            type="button"
            onClick={handleOpenQuickModal}
            aria-label="Novo Lançamento"
            className="w-13 h-13 p-3.5 rounded-2xl btn-primary-theme shadow-md flex items-center justify-center active:scale-95 transition-all border-2 border-app-bg"
          >
            <Plus className="w-6 h-6 stroke-[2.25]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('contas_cartoes')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
            activeTab === 'contas_cartoes' ? 'text-violet-400 font-semibold' : 'text-app-muted'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span>Contas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orcamentos')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
            activeTab === 'orcamentos' ? 'text-violet-400 font-semibold' : 'text-app-muted'
          }`}
        >
          <PieChart className="w-5 h-5" />
          <span>Planejamento</span>
        </button>
      </nav>

      {/* =====================================================================
          MODAL CENTRALIZADO (WEB) / BOTTOM SHEET (MOBILE) DE LANÇAMENTOS
          ===================================================================== */}
      <TransactionModal />
    </div>
  );
};
