import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Account,
  AppTab,
  AuthUserAccount,
  Budget,
  Category,
  CreditCard,
  FinanceDatabaseState,
  FinancialGoal,
  LoginAttemptRecord,
  Rule503020,
  ThemeColor,
  ThemeMode,
  Transaction,
  TransactionStatus,
  UserRole,
  UserSettings,
} from '../types/finance';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { generateId } from '../lib/utils';
import {
  cloudCheckUsernameAvailable,
  cloudDeleteAccount,
  cloudDeleteBudget,
  cloudDeleteCategory,
  cloudDeleteCreditCard,
  cloudDeleteGoal,
  cloudDeleteTransactions,
  cloudGetLockoutStatus,
  cloudRegisterLoginAttempt,
  cloudReplaceFullWorkspace,
  cloudResolveLoginEmail,
  cloudUpsertAccounts,
  cloudUpsertBudget,
  cloudUpsertCategory,
  cloudUpsertCreditCard,
  cloudUpsertGoal,
  cloudUpsertTransactions,
  cloudUpsertUserSettings,
  createCloudUniqueId,
  loadCloudUserWorkspace,
  normalizeThemeColor,
  recalculateAccountsBalance,
  remapStateIdsForUser,
} from '../lib/supabaseFinance';

const STORAGE_PREFIX = '@FinancesPro:db:v1';
const USERS_STORAGE_KEY = '@FinancesPro:auth:users:v1';
const ATTEMPTS_STORAGE_KEY = '@FinancesPro:auth:attempts:v1';
const SESSION_USER_KEY = '@FinancesPro:session:userId';
const SESSION_TAB_KEY = '@FinancesPro:activeTab';
const SESSION_MONTH_KEY = '@FinancesPro:selectedMonth';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

const DEFAULT_ADMIN_ID = 'usr_admin_01';
const DEFAULT_MEMBER_ID = 'usr_franklin_02';

// Helper determinístico de hash para nunca expor senhas em texto puro
export function encodePasswordHash(plain: string): string {
  let h1 = 0xdeadbeef ^ plain.length;
  let h2 = 0x41c6ce57 ^ plain.length;
  for (let i = 0, ch; i < plain.length; i++) {
    ch = plain.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `bf$${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function verifyPasswordHash(plainInput: string, storedHash: string): boolean {
  if (storedHash.startsWith('bf$')) {
    return encodePasswordHash(plainInput) === storedHash;
  }
  // Compatibilidade caso exista hash legado salvo anteriormente no storage
  return plainInput === storedHash || encodePasswordHash(plainInput) === storedHash;
}

// Perfis fechados pré-configurados no banco (Sem exposição no frontend)
export const INITIAL_AUTH_USERS: AuthUserAccount[] = [
  {
    id: DEFAULT_ADMIN_ID,
    username: 'admin',
    email: 'admin@financespro.com',
    nome_exibicao: 'Franklin Miguel (Admin)',
    role: 'admin',
    senha_hash: encodePasswordHash('Admin@2026'),
    ativo: true,
    criado_em: '2026-01-10T10:00:00.000Z',
    ultimo_acesso: null,
  },
  {
    id: DEFAULT_MEMBER_ID,
    username: 'franklin',
    email: 'franklin@financespro.com',
    nome_exibicao: 'Franklin Pessoal',
    role: 'member',
    senha_hash: encodePasswordHash('Finance@2026'),
    ativo: true,
    criado_em: '2026-02-15T14:30:00.000Z',
    ultimo_acesso: null,
  },
  {
    id: 'usr_familia_03',
    username: 'familia',
    email: 'familia@financespro.com',
    nome_exibicao: 'Planejamento Familiar',
    role: 'member',
    senha_hash: encodePasswordHash('Familia@2026'),
    ativo: true,
    criado_em: '2026-03-01T09:00:00.000Z',
    ultimo_acesso: null,
  },
];

// Helper para obter o mês/ano atual no formato YYYY-MM
function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ============================================================================
// CATEGORIAS PADRÃO PRÉ-POPULADAS (REGRA 50-30-20)
// ============================================================================
export function createDefaultCategories(userId: string): Category[] {
  return [
    // Receitas
    {
      id: 'cat_rec_salario',
      user_id: userId,
      nome: 'Salário & Pró-labore',
      tipo: 'receita',
      icone: 'Briefcase',
      cor: '#10b981',
      regra_50_30_20: 'futuro_20',
    },
    {
      id: 'cat_rec_freelance',
      user_id: userId,
      nome: 'Projetos & Freelance',
      tipo: 'receita',
      icone: 'Laptop',
      cor: '#34d399',
      regra_50_30_20: 'futuro_20',
    },
    {
      id: 'cat_rec_rendimentos',
      user_id: userId,
      nome: 'Dividendos & Rendimentos',
      tipo: 'receita',
      icone: 'TrendingUp',
      cor: '#8b5cf6',
      regra_50_30_20: 'futuro_20',
    },

    // 50% — Essenciais (Necessidades Básicas)
    {
      id: 'cat_ess_moradia',
      user_id: userId,
      nome: 'Moradia & Condomínio',
      tipo: 'despesa',
      icone: 'Home',
      cor: '#8b5cf6',
      regra_50_30_20: 'essencial_50',
    },
    {
      id: 'cat_ess_mercado',
      user_id: userId,
      nome: 'Supermercado & Feira',
      tipo: 'despesa',
      icone: 'ShoppingCart',
      cor: '#6366f1',
      regra_50_30_20: 'essencial_50',
    },
    {
      id: 'cat_ess_transporte',
      user_id: userId,
      nome: 'Transporte & Combustível',
      tipo: 'despesa',
      icone: 'Car',
      cor: '#3b82f6',
      regra_50_30_20: 'essencial_50',
    },
    {
      id: 'cat_ess_saude',
      user_id: userId,
      nome: 'Saúde & Farmácia',
      tipo: 'despesa',
      icone: 'HeartPulse',
      cor: '#ec4899',
      regra_50_30_20: 'essencial_50',
    },
    {
      id: 'cat_ess_contas',
      user_id: userId,
      nome: 'Energia, Água & Internet',
      tipo: 'despesa',
      icone: 'Zap',
      cor: '#06b6d4',
      regra_50_30_20: 'essencial_50',
    },

    // 30% — Estilo de Vida (Desejos Pessoais)
    {
      id: 'cat_est_restaurantes',
      user_id: userId,
      nome: 'Restaurantes & Delivery',
      tipo: 'despesa',
      icone: 'Utensils',
      cor: '#f59e0b',
      regra_50_30_20: 'estilo_vida_30',
    },
    {
      id: 'cat_est_lazer',
      user_id: userId,
      nome: 'Lazer, Viagens & Eventos',
      tipo: 'despesa',
      icone: 'Compass',
      cor: '#f97316',
      regra_50_30_20: 'estilo_vida_30',
    },
    {
      id: 'cat_est_assinaturas',
      user_id: userId,
      nome: 'Streaming & Assinaturas',
      tipo: 'despesa',
      icone: 'Tv',
      cor: '#a855f7',
      regra_50_30_20: 'estilo_vida_30',
    },
    {
      id: 'cat_est_compras',
      user_id: userId,
      nome: 'Compras & Vestuário',
      tipo: 'despesa',
      icone: 'ShoppingBag',
      cor: '#d946ef',
      regra_50_30_20: 'estilo_vida_30',
    },

    // 20% — Futuro & Liberdade Financeira (Investimentos, Reserva e Educação)
    {
      id: 'cat_fut_investimentos',
      user_id: userId,
      nome: 'Aportes & Investimentos',
      tipo: 'despesa',
      icone: 'PiggyBank',
      cor: '#10b981',
      regra_50_30_20: 'futuro_20',
    },
    {
      id: 'cat_fut_educacao',
      user_id: userId,
      nome: 'Educação, Cursos & Livros',
      tipo: 'despesa',
      icone: 'GraduationCap',
      cor: '#14b8a6',
      regra_50_30_20: 'futuro_20',
    },
  ];
}

export const DEFAULT_CATEGORIES: Category[] = createDefaultCategories(DEFAULT_ADMIN_ID);

// ============================================================================
// DADOS INICIAIS DE DEMONSTRAÇÃO (MULTI-TENANT POR USER_ID)
// ============================================================================
function createInitialDemoState(
  userId = DEFAULT_ADMIN_ID,
  displayName = 'Franklin Oliveira'
): FinanceDatabaseState {
  const mesAtual = getCurrentYearMonth();
  const isMember = userId === DEFAULT_MEMBER_ID;

  const accounts: Account[] = [
    {
      id: 'acc_nubank',
      user_id: userId,
      nome: 'Nubank Ultravioleta',
      tipo: 'corrente',
      saldo_inicial: isMember ? 2500 : 4200,
      saldo_atual: isMember ? 6820 : 9410.1,
      cor: '#8b5cf6',
      incluir_na_soma_geral: true,
    },
    {
      id: 'acc_itau',
      user_id: userId,
      nome: 'Itaú Personalité',
      tipo: 'poupanca',
      saldo_inicial: isMember ? 5000 : 8500,
      saldo_atual: isMember ? 5000 : 8500,
      cor: '#f59e0b',
      incluir_na_soma_geral: true,
    },
    {
      id: 'acc_btg',
      user_id: userId,
      nome: 'BTG Pactual Investimentos',
      tipo: 'investimento',
      saldo_inicial: isMember ? 12000 : 24000,
      saldo_atual: isMember ? 13500 : 21500,
      cor: '#10b981',
      incluir_na_soma_geral: true,
    },
    {
      id: 'acc_carteira',
      user_id: userId,
      nome: 'Carteira Física',
      tipo: 'dinheiro_fisico',
      saldo_inicial: 350,
      saldo_atual: 350,
      cor: '#71717a',
      incluir_na_soma_geral: false,
    },
  ];

  const creditCards: CreditCard[] = [
    {
      id: 'cc_nubank_uv',
      user_id: userId,
      account_id: 'acc_nubank',
      nome_cartao: 'Nubank Ultravioleta Black',
      limite_total: 18000,
      dia_fechamento: 5,
      dia_vencimento: 12,
      cor: '#8b5cf6',
    },
    {
      id: 'cc_itau_black',
      user_id: userId,
      account_id: 'acc_itau',
      nome_cartao: 'Itaú Mastercard Black',
      limite_total: 25000,
      dia_fechamento: 18,
      dia_vencimento: 25,
      cor: '#f59e0b',
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx_demo_1',
      user_id: userId,
      account_id: 'acc_nubank',
      credit_card_id: null,
      category_id: 'cat_rec_salario',
      descricao: 'Salário Mensal Tech Lead',
      valor: isMember ? 8500 : 11500,
      tipo: 'receita',
      natureza: 'fixa',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pago',
      data_vencimento: `${mesAtual}-05`,
      data_pagamento: `${mesAtual}-05`,
    },
    {
      id: 'tx_demo_2',
      user_id: userId,
      account_id: 'acc_nubank',
      credit_card_id: null,
      category_id: 'cat_rec_freelance',
      descricao: 'Consultoria Arquitetura Front-end',
      valor: 2800,
      tipo: 'receita',
      natureza: 'variavel',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pago',
      data_vencimento: `${mesAtual}-12`,
      data_pagamento: `${mesAtual}-12`,
    },
    {
      id: 'tx_demo_3',
      user_id: userId,
      account_id: 'acc_nubank',
      credit_card_id: null,
      category_id: 'cat_ess_moradia',
      descricao: 'Aluguel + Condomínio',
      valor: 2950,
      tipo: 'despesa',
      natureza: 'fixa',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pago',
      data_vencimento: `${mesAtual}-10`,
      data_pagamento: `${mesAtual}-10`,
    },
    {
      id: 'tx_demo_4',
      user_id: userId,
      account_id: 'acc_nubank',
      credit_card_id: null,
      category_id: 'cat_ess_mercado',
      descricao: 'Compras Supermercado Mensal',
      valor: 1420,
      tipo: 'despesa',
      natureza: 'variavel',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pago',
      data_vencimento: `${mesAtual}-14`,
      data_pagamento: `${mesAtual}-14`,
    },
    {
      id: 'tx_demo_5',
      user_id: userId,
      account_id: 'acc_nubank',
      credit_card_id: null,
      category_id: 'cat_ess_contas',
      descricao: 'Energia Elétrica + Fibra 1Gbps',
      valor: 389.9,
      tipo: 'despesa',
      natureza: 'fixa',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pago',
      data_vencimento: `${mesAtual}-15`,
      data_pagamento: `${mesAtual}-15`,
    },
    {
      id: 'tx_demo_6',
      user_id: userId,
      account_id: null,
      credit_card_id: 'cc_nubank_uv',
      category_id: 'cat_est_restaurantes',
      descricao: 'Jantar Especial & Gastronomia',
      valor: 640,
      tipo: 'despesa',
      natureza: 'variavel',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pendente',
      data_vencimento: `${mesAtual}-12`,
      data_pagamento: null,
    },
    {
      id: 'tx_demo_7',
      user_id: userId,
      account_id: null,
      credit_card_id: 'cc_nubank_uv',
      category_id: 'cat_est_compras',
      descricao: 'Monitor Ultrawide Dell 34"',
      valor: 450,
      tipo: 'despesa',
      natureza: 'parcelada',
      parcela_atual: 1,
      total_parcelas: 10,
      grupo_parcelamento_id: 'grp_monitor_01',
      status: 'pendente',
      data_vencimento: `${mesAtual}-12`,
      data_pagamento: null,
    },
    {
      id: 'tx_demo_7b',
      user_id: userId,
      account_id: null,
      credit_card_id: 'cc_nubank_uv',
      category_id: 'cat_est_compras',
      descricao: 'Monitor Ultrawide Dell 34"',
      valor: 450,
      tipo: 'despesa',
      natureza: 'parcelada',
      parcela_atual: 2,
      total_parcelas: 10,
      grupo_parcelamento_id: 'grp_monitor_01',
      status: 'pendente',
      data_vencimento: `${
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 12)
          .toISOString()
          .split('T')[0]
      }`,
      data_pagamento: null,
    },
    {
      id: 'tx_demo_7c',
      user_id: userId,
      account_id: null,
      credit_card_id: 'cc_itau_black',
      category_id: 'cat_est_lazer',
      descricao: 'Passagem Aérea Conferência Tech',
      valor: 1280,
      tipo: 'despesa',
      natureza: 'parcelada',
      parcela_atual: 1,
      total_parcelas: 4,
      grupo_parcelamento_id: 'grp_voo_01',
      status: 'pendente',
      data_vencimento: `${mesAtual}-25`,
      data_pagamento: null,
    },
    {
      id: 'tx_demo_7d',
      user_id: userId,
      account_id: null,
      credit_card_id: 'cc_itau_black',
      category_id: 'cat_est_lazer',
      descricao: 'Passagem Aérea Conferência Tech',
      valor: 1280,
      tipo: 'despesa',
      natureza: 'parcelada',
      parcela_atual: 2,
      total_parcelas: 4,
      grupo_parcelamento_id: 'grp_voo_01',
      status: 'pendente',
      data_vencimento: `${
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 25)
          .toISOString()
          .split('T')[0]
      }`,
      data_pagamento: null,
    },
    {
      id: 'tx_demo_8',
      user_id: userId,
      account_id: 'acc_btg',
      credit_card_id: null,
      category_id: 'cat_fut_investimentos',
      descricao: 'Aporte Mensal Tesouro IPCA+ & ETFs',
      valor: 2500,
      tipo: 'despesa',
      natureza: 'fixa',
      parcela_atual: null,
      total_parcelas: null,
      grupo_parcelamento_id: null,
      status: 'pago',
      data_vencimento: `${mesAtual}-08`,
      data_pagamento: `${mesAtual}-08`,
    },
  ];

  const budgets: Budget[] = [
    {
      id: 'bdg_moradia',
      user_id: userId,
      category_id: 'cat_ess_moradia',
      mes_ano: mesAtual,
      valor_teto_planejado: 3000,
    },
    {
      id: 'bdg_mercado',
      user_id: userId,
      category_id: 'cat_ess_mercado',
      mes_ano: mesAtual,
      valor_teto_planejado: 1800,
    },
    {
      id: 'bdg_restaurantes',
      user_id: userId,
      category_id: 'cat_est_restaurantes',
      mes_ano: mesAtual,
      valor_teto_planejado: 900,
    },
    {
      id: 'bdg_investimentos',
      user_id: userId,
      category_id: 'cat_fut_investimentos',
      mes_ano: mesAtual,
      valor_teto_planejado: 3000,
    },
  ];

  const financialGoals: FinancialGoal[] = [
    {
      id: 'goal_reserva',
      user_id: userId,
      titulo: 'Reserva de Emergência (12 Meses)',
      valor_meta: 60000,
      valor_acumulado: 38500,
      data_alvo: '2027-06-30',
      cor: '#8b5cf6',
      icone: 'ShieldCheck',
    },
    {
      id: 'goal_viagem',
      user_id: userId,
      titulo: 'Eurotrip & Suíça',
      valor_meta: 28000,
      valor_acumulado: 14200,
      data_alvo: '2027-09-15',
      cor: '#f59e0b',
      icone: 'Plane',
    },
    {
      id: 'goal_setup',
      user_id: userId,
      titulo: 'Upgrade MacBook Pro M4 Max',
      valor_meta: 22000,
      valor_acumulado: 16500,
      data_alvo: '2027-03-01',
      cor: '#10b981',
      icone: 'Laptop',
    },
  ];

  const userSettings: UserSettings = {
    user_id: userId,
    nome_exibicao: displayName,
    avatar_url: '',
    moeda: 'BRL',
    meta_economia_mensal: 3000,
    cor_tema: 'purple-black',
    modo_tema: 'dark',
    ocultar_valores: false,
    usar_regra_50_30_20: false,
    pct_essencial: 50,
    pct_estilo_vida: 30,
    pct_futuro: 20,
  };

  return {
    accounts: recalculateAccountsBalance(accounts, transactions),
    creditCards,
    categories: createDefaultCategories(userId),
    transactions,
    budgets,
    financialGoals,
    userSettings,
  };
}

const CLOUD_THEME_PREF_KEY = '@FinancesPro:guestTheme:v1';

function readGuestThemePreference(): { cor_tema: ThemeColor; modo_tema: ThemeMode } {
  try {
    const raw = localStorage.getItem(CLOUD_THEME_PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { cor_tema?: string; modo_tema?: string };
      return {
        cor_tema: normalizeThemeColor(parsed.cor_tema),
        modo_tema: parsed.modo_tema === 'light' ? 'light' : 'dark',
      };
    }
  } catch {
    // ignore
  }
  return { cor_tema: 'purple-black', modo_tema: 'dark' };
}

function createEmptyCloudShellState(): FinanceDatabaseState {
  const pref = readGuestThemePreference();
  return {
    accounts: [],
    creditCards: [],
    categories: [],
    transactions: [],
    budgets: [],
    financialGoals: [],
    userSettings: {
      user_id: '',
      nome_exibicao: 'Gestor Financeiro',
      avatar_url: '',
      moeda: 'BRL',
      meta_economia_mensal: 2000,
      cor_tema: pref.cor_tema,
      modo_tema: pref.modo_tema,
      ocultar_valores: false,
      usar_regra_50_30_20: false,
      pct_essencial: 50,
      pct_estilo_vida: 30,
      pct_futuro: 20,
    },
  };
}

function loadTenantDatabase(userId: string, displayName: string): FinanceDatabaseState {
  const tenantKey = `${STORAGE_PREFIX}:${userId}`;
  try {
    const raw = localStorage.getItem(tenantKey);
    if (raw) {
      const parsed = JSON.parse(raw) as FinanceDatabaseState;
      const recalculatedAccounts = recalculateAccountsBalance(
        parsed.accounts || [],
        parsed.transactions || []
      );
      const validThemes: ThemeColor[] = [
        'light-green',
        'purple-black',
        'deep-blue',
        'amber-purple',
        'monochrome',
      ];
      const savedTheme = parsed.userSettings?.cor_tema as string | undefined;
      const normalizedTheme: ThemeColor =
        savedTheme && validThemes.includes(savedTheme as ThemeColor)
          ? (savedTheme as ThemeColor)
          : savedTheme === 'graphite'
          ? 'monochrome'
          : 'purple-black';

      return {
        ...createInitialDemoState(userId, displayName),
        ...parsed,
        userSettings: {
          ...createInitialDemoState(userId, displayName).userSettings,
          ...(parsed.userSettings || {}),
          cor_tema: normalizedTheme,
        },
        accounts: recalculatedAccounts,
      };
    }
  } catch (error) {
    console.error('Erro ao ler dados financeiros do localStorage:', error);
  }
  return createInitialDemoState(userId, displayName);
}

// ============================================================================
// TIPAGEM DO CONTEXTO GLOBAL
// ============================================================================
export interface Rule503020Breakdown {
  receitaLiquidaMes: number;
  essencial_50: {
    gasto: number;
    ideal: number;
    percentualReceita: number;
    targetPct: number;
  };
  estilo_vida_30: {
    gasto: number;
    ideal: number;
    percentualReceita: number;
    targetPct: number;
  };
  futuro_20: {
    gasto: number;
    ideal: number;
    percentualReceita: number;
    targetPct: number;
  };
  sem_pilar: {
    gasto: number;
    percentualReceita: number;
  };
}

export interface LoginResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: string | null;
}

export interface RegisterAccountResult {
  success: boolean;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

export interface FinanceContextData extends FinanceDatabaseState {
  // Autenticação Multi-Tenant & Segurança Força Bruta
  currentUser: AuthUserAccount | null;
  isAuthLoading: boolean;
  registeredUsers: AuthUserAccount[];
  loginAttempts: Record<string, LoginAttemptRecord>;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  registerAccount: (payload: {
    nome_exibicao: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<RegisterAccountResult>;
  logout: () => void;
  getLockoutStatus: (identifier: string) => {
    isLocked: boolean;
    failedAttempts: number;
    lockedUntil: string | null;
    remainingSeconds: number;
  };
  createAccessProfile: (profile: {
    username: string;
    email: string;
    nome_exibicao: string;
    role: UserRole;
    senha_hash: string;
  }) => { success: boolean; error?: string };
  toggleProfileActive: (userId: string) => void;
  deleteAccessProfile: (userId: string) => void;
  resetLoginAttempts: (identifier: string) => void;
  updateOwnCredentials: (payload: {
    currentPassword: string;
    newUsername?: string;
    newEmail?: string;
    newDisplayName?: string;
    newPassword?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  adminUpdateUserCredentials: (payload: {
    targetUserId: string;
    newUsername?: string;
    newEmail?: string;
    newDisplayName?: string;
    newPassword?: string;
  }) => { success: boolean; error?: string };

  // Navegação limpa sincronizada com sessionStorage (URL fixa em '/')
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Modal Rápido "+ Novo Lançamento" (Desktop Sidebar & Mobile FAB) e Edição
  isQuickTransactionOpen: boolean;
  setIsQuickTransactionOpen: (open: boolean) => void;
  editingTransaction: Transaction | null;
  setEditingTransaction: (tx: Transaction | null) => void;

  // Filtro temporal global YYYY-MM
  selectedMonth: string;
  setSelectedMonth: (mesAno: string) => void;

  // Status de Sincronização Supabase Cloud
  isSupabaseReady: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncWithSupabase: () => Promise<void>;

  // Seletores e Cálculos Derivados
  totalSaldoGeral: number;
  receitasMes: number;
  despesasMes: number;
  saldoPrevistoMes: number;
  rule503020Summary: Rule503020Breakdown;

  // Ações de Tema e Preferências
  updateUserSettings: (partial: Partial<UserSettings>) => void;
  toggleThemeColor: (theme?: ThemeColor) => void;
  toggleThemeMode: (mode?: ThemeMode) => void;
  toggleHideValues: () => void;

  // CRUD das Entidades
  addAccount: (account: Omit<Account, 'id' | 'user_id' | 'saldo_atual'>) => void;
  updateAccount: (id: string, data: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  adjustAccountBalance: (accountId: string, newTargetBalance: number) => void;
  transferBetweenAccounts: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description?: string;
  }) => { success: boolean; error?: string };

  addCreditCard: (card: Omit<CreditCard, 'id' | 'user_id'>) => void;
  updateCreditCard: (id: string, data: Partial<CreditCard>) => void;
  deleteCreditCard: (id: string) => void;
  payCreditCardInvoice: (
    cardId: string,
    mesAno: string,
    paymentAccountId: string
  ) => { success: boolean; paidCount: number; totalPaid: number; error?: string };

  addCategory: (category: Omit<Category, 'id' | 'user_id'>) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addTransaction: (
    tx: Omit<Transaction, 'id' | 'user_id' | 'parcela_atual' | 'grupo_parcelamento_id'>
  ) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string, deleteParcelGroup?: boolean) => void;
  toggleTransactionStatus: (id: string) => void;

  upsertBudget: (category_id: string, mes_ano: string, valor_teto_planejado: number) => void;
  deleteBudget: (id: string) => void;

  addFinancialGoal: (goal: Omit<FinancialGoal, 'id' | 'user_id'>) => void;
  updateFinancialGoal: (id: string, data: Partial<FinancialGoal>) => void;
  contributeToGoal: (id: string, amount: number) => void;
  deleteFinancialGoal: (id: string) => void;

  resetToDemoData: () => void;
  exportBackupJson: () => string;
  importBackupJson: (rawJson: string) => { success: boolean; error?: string };
}

const FinanceContext = createContext<FinanceContextData | undefined>(undefined);

const VALID_TABS: AppTab[] = [
  'dashboard',
  'transacoes',
  'contas_cartoes',
  'orcamentos',
  'metas',
  'relatorios',
  'configuracoes',
  'gerenciar_acessos',
];

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isCloudMode = Boolean(isSupabaseConfigured && supabase);

  // 1. Perfis cadastrados (somente para modo local quando .env Supabase ainda não está preenchido)
  const [registeredUsers, setRegisteredUsers] = useState<AuthUserAccount[]>(() => {
    if (isCloudMode) return [];
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUserAccount[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_AUTH_USERS;
  });

  // 2. Registro de tentativas de login (Força Bruta: 5 falhas = bloqueio 15 min)
  const [loginAttempts, setLoginAttempts] = useState<Record<string, LoginAttemptRecord>>(() => {
    if (isCloudMode) return {};
    try {
      const saved = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Record<string, LoginAttemptRecord>;
    } catch {
      // ignore
    }
    return {};
  });

  // 3. Usuário autenticado na sessão atual (no Modo Nuvem vem exclusivamente do Supabase Auth)
  const [currentUser, setCurrentUser] = useState<AuthUserAccount | null>(() => {
    if (isCloudMode) return null;
    try {
      const savedUserId = sessionStorage.getItem(SESSION_USER_KEY);
      if (savedUserId) {
        const usersRaw = localStorage.getItem(USERS_STORAGE_KEY);
        const list: AuthUserAccount[] = usersRaw ? JSON.parse(usersRaw) : INITIAL_AUTH_USERS;
        const found = list.find((u) => u.id === savedUserId && u.ativo);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isCloudMode);

  // 4. Estado do Banco Multi-Tenant carregado conforme o usuário autenticado
  const activeTenantId = currentUser?.id ?? (isCloudMode ? '' : DEFAULT_ADMIN_ID);
  const activeTenantName = currentUser?.nome_exibicao ?? (isCloudMode ? 'Gestor Financeiro' : 'Franklin Oliveira');

  const [dbState, setDbState] = useState<FinanceDatabaseState>(() =>
    isCloudMode
      ? createEmptyCloudShellState()
      : loadTenantDatabase(activeTenantId, activeTenantName)
  );

  const dbStateRef = useRef<FinanceDatabaseState>(dbState);
  dbStateRef.current = dbState;

  const currentUserRef = useRef<AuthUserAccount | null>(currentUser);
  currentUserRef.current = currentUser;

  const hydratedUserIdRef = useRef<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const commitDbState = useCallback(
    (updater: (prev: FinanceDatabaseState) => FinanceDatabaseState): FinanceDatabaseState => {
      const next = updater(dbStateRef.current);
      dbStateRef.current = next;
      setDbState(next);
      return next;
    },
    []
  );

  const runCloudMutation = useCallback(
    async (label: string, task: (userId: string) => Promise<void>) => {
      const uid = currentUserRef.current?.id;
      if (!isCloudMode || !supabase || !uid) return;
      setIsSyncing(true);
      setSyncError(null);
      try {
        await task(uid);
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        console.error(`[SupabaseSync:${label}]`, err);
        setSyncError(
          err instanceof Error
            ? `Erro ao salvar na nuvem (${label}): ${err.message}`
            : `Erro ao salvar dados na nuvem (${label}).`
        );
      } finally {
        setIsSyncing(false);
      }
    },
    [isCloudMode]
  );

  const hydrateCloudSessionUser = useCallback(async (authUser: User | null) => {
    if (!isCloudMode || !supabase) return;
    if (!authUser) {
      hydratedUserIdRef.current = null;
      const empty = createEmptyCloudShellState();
      dbStateRef.current = empty;
      setDbState(empty);
      currentUserRef.current = null;
      setCurrentUser(null);
      setIsAuthLoading(false);
      return;
    }

    hydratedUserIdRef.current = authUser.id;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const { authUserAccount, dbState: cloudState } = await loadCloudUserWorkspace(
        authUser,
        createDefaultCategories
      );
      dbStateRef.current = cloudState;
      setDbState(cloudState);
      currentUserRef.current = authUserAccount;
      setCurrentUser(authUserAccount);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      hydratedUserIdRef.current = null;
      console.error('[SupabaseAuth] Falha ao carregar dados do usuário:', err);
      setSyncError(
        err instanceof Error
          ? `Falha ao carregar conta Supabase: ${err.message}`
          : 'Falha ao carregar dados da conta na nuvem.'
      );
    } finally {
      setIsSyncing(false);
      setIsAuthLoading(false);
    }
  }, [isCloudMode]);

  // Sessão persistente na nuvem via Supabase Auth (acesso multi-dispositivo real)
  useEffect(() => {
    if (!isCloudMode || !supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        hydrateCloudSessionUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (isMounted) setIsAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT') {
        hydrateCloudSessionUser(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const nextUser = session?.user ?? null;
        if (nextUser && hydratedUserIdRef.current === nextUser.id && event === 'SIGNED_IN') {
          return;
        }
        hydrateCloudSessionUser(nextUser);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateCloudSessionUser, isCloudMode]);

  // Modo Local fallback (quando .env ainda não foi configurado): carrega tenant localStorage
  useEffect(() => {
    if (!isCloudMode && currentUser) {
      const localDb = loadTenantDatabase(currentUser.id, currentUser.nome_exibicao);
      dbStateRef.current = localDb;
      setDbState(localDb);
    }
  }, [currentUser, isCloudMode]);

  // Persiste lista de usuários e tentativas de login apenas no Modo Local
  useEffect(() => {
    if (isCloudMode) return;
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(registeredUsers));
    } catch {
      // ignore
    }
  }, [isCloudMode, registeredUsers]);

  useEffect(() => {
    if (isCloudMode) return;
    try {
      localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(loginAttempts));
    } catch {
      // ignore
    }
  }, [isCloudMode, loginAttempts]);

  // 5. Estado de Navegação sincronizado com sessionStorage (mantendo URL limpa em '/')
  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    try {
      const savedTab = sessionStorage.getItem(SESSION_TAB_KEY) as AppTab | null;
      if (savedTab && VALID_TABS.includes(savedTab)) {
        return savedTab;
      }
    } catch {
      // ignore
    }
    return 'dashboard';
  });

  const [isQuickTransactionOpen, setIsQuickTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // 6. Mês/Ano ativo sincronizado com sessionStorage
  const [selectedMonth, setSelectedMonthState] = useState<string>(() => {
    try {
      const savedMonth = sessionStorage.getItem(SESSION_MONTH_KEY);
      if (savedMonth && /^\d{4}-\d{2}$/.test(savedMonth)) {
        return savedMonth;
      }
    } catch {
      // ignore
    }
    return getCurrentYearMonth();
  });

  // Garante que a URL no navegador fique sempre limpa na raiz '/'
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [activeTab, currentUser]);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem(SESSION_TAB_KEY, tab);
      if (window.location.pathname !== '/' || window.location.search || window.location.hash) {
        window.history.replaceState(null, '', '/');
      }
    } catch {
      // ignore
    }
  }, []);

  const setSelectedMonth = useCallback((mesAno: string) => {
    setSelectedMonthState(mesAno);
    try {
      sessionStorage.setItem(SESSION_MONTH_KEY, mesAno);
    } catch {
      // ignore
    }
  }, []);

  // Persiste automaticamente no localStorage APENAS no Modo Local (quando Supabase não está configurado).
  // No Modo Nuvem, toda persistência é gravada exclusivamente no Supabase por usuário autenticado.
  useEffect(() => {
    if (isCloudMode) return;
    if (!dbState.userSettings.user_id) return;
    try {
      const tenantKey = `${STORAGE_PREFIX}:${dbState.userSettings.user_id}`;
      localStorage.setItem(tenantKey, JSON.stringify(dbState));
    } catch (error) {
      console.error('Erro ao salvar estado no localStorage:', error);
    }
  }, [dbState, isCloudMode]);

  // Aplica os atributos data-theme e data-mode no <html> e <body> para ativar as variáveis CSS nativas
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute('data-theme', dbState.userSettings.cor_tema);
    root.setAttribute('data-mode', dbState.userSettings.modo_tema);
    if (body) {
      body.setAttribute('data-theme', dbState.userSettings.cor_tema);
      body.setAttribute('data-mode', dbState.userSettings.modo_tema);
    }
  }, [dbState.userSettings.cor_tema, dbState.userSettings.modo_tema]);

  // ============================================================================
  // AUTENTICAÇÃO FECHADA & PROTEÇÃO CONTRA FORÇA BRUTA (5 FALHAS -> 15 MIN)
  // ============================================================================
  const getLockoutStatus = useCallback(
    (rawIdentifier: string) => {
      const key = rawIdentifier.trim().toLowerCase() || 'global';
      const record = loginAttempts[key];
      if (!record) {
        return { isLocked: false, failedAttempts: 0, lockedUntil: null, remainingSeconds: 0 };
      }

      if (record.locked_until) {
        const lockTime = new Date(record.locked_until).getTime();
        const now = Date.now();
        if (lockTime > now) {
          return {
            isLocked: true,
            failedAttempts: record.failed_attempts,
            lockedUntil: record.locked_until,
            remainingSeconds: Math.ceil((lockTime - now) / 1000),
          };
        }
      }

      return {
        isLocked: false,
        failedAttempts: record.locked_until ? 0 : record.failed_attempts,
        lockedUntil: null,
        remainingSeconds: 0,
      };
    },
    [loginAttempts]
  );

  const login = useCallback(
    async (identifier: string, password: string): Promise<LoginResult> => {
      const normalized = identifier.trim().toLowerCase();
      if (!normalized || !password) {
        return { success: false, error: 'Preencha seu identificador de acesso e senha.' };
      }

      // ------------------------------------------------------------------
      // MODO NUVEM (SUPABASE AUTH + POSTGRESQL POR USUÁRIO)
      // ------------------------------------------------------------------
      if (isCloudMode && supabase) {
        const remoteLock = await cloudGetLockoutStatus(normalized);
        if (remoteLock) {
          setLoginAttempts((prev) => ({
            ...prev,
            [normalized]: {
              identifier: normalized,
              failed_attempts: remoteLock.failedAttempts,
              locked_until: remoteLock.lockedUntil,
              last_attempt_at: new Date().toISOString(),
            },
          }));
          if (remoteLock.isLocked) {
            return {
              success: false,
              error: 'Acesso temporariamente bloqueado por excesso de tentativas incorretas.',
              remainingAttempts: 0,
              lockedUntil: remoteLock.lockedUntil,
            };
          }
        }

        const localLock = getLockoutStatus(normalized);
        if (localLock.isLocked) {
          return {
            success: false,
            error: 'Acesso temporariamente bloqueado por excesso de tentativas incorretas.',
            remainingAttempts: 0,
            lockedUntil: localLock.lockedUntil,
          };
        }

        const recordFailedCloudAttempt = async (): Promise<LoginResult> => {
          const updatedRemote = await cloudRegisterLoginAttempt(normalized, false);
          const nextAttempts = updatedRemote
            ? updatedRemote.failedAttempts
            : localLock.failedAttempts + 1;
          const isNowLocked = updatedRemote
            ? updatedRemote.isLocked
            : nextAttempts >= MAX_LOGIN_ATTEMPTS;
          const lockedUntilIso = updatedRemote
            ? updatedRemote.lockedUntil
            : isNowLocked
            ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
            : null;

          setLoginAttempts((prev) => ({
            ...prev,
            [normalized]: {
              identifier: normalized,
              failed_attempts: nextAttempts,
              locked_until: lockedUntilIso,
              last_attempt_at: new Date().toISOString(),
            },
          }));

          if (isNowLocked) {
            return {
              success: false,
              error:
                'Limite de 5 tentativas excedido! Este acesso foi bloqueado por 15 minutos por segurança.',
              remainingAttempts: 0,
              lockedUntil: lockedUntilIso,
            };
          }

          const remaining = Math.max(1, MAX_LOGIN_ATTEMPTS - nextAttempts);
          return {
            success: false,
            error: `Credenciais inválidas. Você possui mais ${remaining} tentativa(s) antes do bloqueio de 15 min.`,
            remainingAttempts: remaining,
            lockedUntil: null,
          };
        };

        const resolvedEmail = await cloudResolveLoginEmail(normalized);
        if (!resolvedEmail) {
          return recordFailedCloudAttempt();
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        });

        if (error || !data.user) {
          if (/email not confirmed/i.test(error?.message ?? '')) {
            return {
              success: false,
              error:
                'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou ajuste a confirmação no Supabase Auth.',
            };
          }
          return recordFailedCloudAttempt();
        }

        await cloudRegisterLoginAttempt(normalized, true);
        setLoginAttempts((prev) => ({
          ...prev,
          [normalized]: {
            identifier: normalized,
            failed_attempts: 0,
            locked_until: null,
            last_attempt_at: new Date().toISOString(),
          },
        }));

        await hydrateCloudSessionUser(data.user);
        return { success: true };
      }

      // ------------------------------------------------------------------
      // MODO LOCAL FALLBACK (QUANDO .ENV SUPABASE NÃO ESTÁ PREENCHIDO)
      // ------------------------------------------------------------------
      const lockStatus = getLockoutStatus(normalized);
      if (lockStatus.isLocked) {
        return {
          success: false,
          error: 'Acesso temporariamente bloqueado por excesso de tentativas incorretas.',
          remainingAttempts: 0,
          lockedUntil: lockStatus.lockedUntil,
        };
      }

      const matchedUser = registeredUsers.find(
        (u) =>
          u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized
      );

      if (!matchedUser || !verifyPasswordHash(password, matchedUser.senha_hash)) {
        const previousAttempts = lockStatus.failedAttempts;
        const nextAttempts = previousAttempts + 1;
        const isNowLocked = nextAttempts >= MAX_LOGIN_ATTEMPTS;
        const lockedUntilIso = isNowLocked
          ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
          : null;

        setLoginAttempts((prev) => ({
          ...prev,
          [normalized]: {
            identifier: normalized,
            failed_attempts: nextAttempts,
            locked_until: lockedUntilIso,
            last_attempt_at: new Date().toISOString(),
          },
        }));

        if (isNowLocked) {
          return {
            success: false,
            error:
              'Limite de 5 tentativas excedido! Este acesso foi bloqueado por 15 minutos por segurança.',
            remainingAttempts: 0,
            lockedUntil: lockedUntilIso,
          };
        }

        const remaining = MAX_LOGIN_ATTEMPTS - nextAttempts;
        return {
          success: false,
          error: `Credenciais inválidas. Você possui mais ${remaining} tentativa(s) antes do bloqueio de 15 min.`,
          remainingAttempts: remaining,
          lockedUntil: null,
        };
      }

      if (!matchedUser.ativo) {
        return {
          success: false,
          error: 'Este perfil está desativado pelo Administrador do sistema.',
        };
      }

      // Sucesso: zera tentativas incorretas e autentica sessão
      setLoginAttempts((prev) => ({
        ...prev,
        [normalized]: {
          identifier: normalized,
          failed_attempts: 0,
          locked_until: null,
          last_attempt_at: new Date().toISOString(),
        },
      }));

      const nowIso = new Date().toISOString();
      const updatedUser: AuthUserAccount = { ...matchedUser, ultimo_acesso: nowIso };

      setRegisteredUsers((prev) =>
        prev.map((u) => (u.id === matchedUser.id ? updatedUser : u))
      );
      setCurrentUser(updatedUser);

      try {
        sessionStorage.setItem(SESSION_USER_KEY, updatedUser.id);
        if (window.location.pathname !== '/') {
          window.history.replaceState(null, '', '/');
        }
      } catch {
        // ignore
      }

      return { success: true };
    },
    [getLockoutStatus, hydrateCloudSessionUser, isCloudMode, registeredUsers]
  );

  const registerAccount = useCallback(
    async (payload: {
      nome_exibicao: string;
      username: string;
      email: string;
      password: string;
    }): Promise<RegisterAccountResult> => {
      const cleanName = payload.nome_exibicao.trim();
      const cleanUsername = payload.username.trim().toLowerCase();
      const cleanEmail = payload.email.trim().toLowerCase();

      if (cleanName.length < 2) {
        return { success: false, error: 'Informe seu nome completo ou de exibição.' };
      }
      if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
        return {
          success: false,
          error:
            'O nome de usuário deve ter de 3 a 32 caracteres (apenas letras, números, ponto, hífen ou _).',
        };
      }
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return { success: false, error: 'Informe um endereço de e-mail válido.' };
      }
      if (payload.password.length < 6) {
        return { success: false, error: 'A senha deve possuir no mínimo 6 caracteres.' };
      }

      if (isCloudMode && supabase) {
        const usernameAvailable = await cloudCheckUsernameAvailable(cleanUsername);
        if (!usernameAvailable) {
          return {
            success: false,
            error: 'Este nome de usuário já está em uso. Escolha outro identificador.',
          };
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: payload.password,
          options: {
            emailRedirectTo:
              typeof window !== 'undefined' ? window.location.origin : undefined,
            data: {
              nome_exibicao: cleanName,
              username: cleanUsername,
            },
          },
        });

        if (error) {
          const msg = error.message || '';
          if (/already registered/i.test(msg)) {
            return {
              success: false,
              error: 'Este e-mail já possui cadastro. Acesse pela aba Entrar.',
            };
          }
          if (/rate limit/i.test(msg)) {
            return {
              success: false,
              error: 'Muitas tentativas em sequência. Aguarde instantes antes de tentar novamente.',
            };
          }
          return { success: false, error: msg || 'Não foi possível criar a conta na nuvem.' };
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return {
            success: false,
            error: 'Este e-mail já está cadastrado. Faça login pela aba Entrar.',
          };
        }

        if (data.session && data.user) {
          await hydrateCloudSessionUser(data.user);
          return { success: true };
        }

        return { success: true, requiresEmailConfirmation: true };
      }

      // Modo Local fallback
      const duplicate = registeredUsers.some(
        (u) =>
          u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanEmail
      );
      if (duplicate) {
        return {
          success: false,
          error: 'Já existe uma conta com este usuário ou e-mail.',
        };
      }

      const newUserId = generateId('usr');
      const nowIso = new Date().toISOString();
      const newUser: AuthUserAccount = {
        id: newUserId,
        username: cleanUsername,
        email: cleanEmail,
        nome_exibicao: cleanName,
        role: 'member',
        senha_hash: encodePasswordHash(payload.password),
        ativo: true,
        criado_em: nowIso,
        ultimo_acesso: nowIso,
      };

      const initialLocalDb: FinanceDatabaseState = {
        accounts: [],
        creditCards: [],
        categories: createDefaultCategories(newUserId),
        transactions: [],
        budgets: [],
        financialGoals: [],
        userSettings: {
          ...createEmptyCloudShellState().userSettings,
          user_id: newUserId,
          nome_exibicao: cleanName,
        },
      };

      try {
        localStorage.setItem(`${STORAGE_PREFIX}:${newUserId}`, JSON.stringify(initialLocalDb));
        sessionStorage.setItem(SESSION_USER_KEY, newUserId);
      } catch {
        // ignore
      }

      setRegisteredUsers((prev) => [...prev, newUser]);
      setCurrentUser(newUser);
      return { success: true };
    },
    [hydrateCloudSessionUser, isCloudMode, registeredUsers]
  );

  const logout = useCallback(() => {
    if (isCloudMode && supabase) {
      hydratedUserIdRef.current = null;
      supabase.auth.signOut().catch((err) => {
        console.warn('Erro ao encerrar sessão Supabase:', err);
      });
      const empty = createEmptyCloudShellState();
      dbStateRef.current = empty;
      setDbState(empty);
    }
    currentUserRef.current = null;
    setCurrentUser(null);
    setActiveTabState('dashboard');
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.setItem(SESSION_TAB_KEY, 'dashboard');
      if (window.location.pathname !== '/') {
        window.history.replaceState(null, '', '/');
      }
    } catch {
      // ignore
    }
  }, [isCloudMode]);

  const createAccessProfile = useCallback(
    (profileData: {
      username: string;
      email: string;
      nome_exibicao: string;
      role: UserRole;
      senha_hash: string;
    }) => {
      const cleanUsername = profileData.username.trim().toLowerCase();
      const cleanEmail = profileData.email.trim().toLowerCase();

      if (cleanUsername.length < 3) {
        return { success: false, error: 'O usuário deve ter pelo menos 3 caracteres.' };
      }
      if (profileData.senha_hash.length < 6) {
        return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
      }

      const duplicate = registeredUsers.some(
        (u) =>
          u.username.toLowerCase() === cleanUsername ||
          u.email.toLowerCase() === cleanEmail
      );
      if (duplicate) {
        return {
          success: false,
          error: 'Já existe um perfil cadastrado com este usuário ou e-mail.',
        };
      }

      const newUserId = generateId('usr');
      const newUser: AuthUserAccount = {
        id: newUserId,
        username: cleanUsername,
        email: cleanEmail,
        nome_exibicao: profileData.nome_exibicao.trim(),
        role: profileData.role,
        senha_hash: encodePasswordHash(profileData.senha_hash),
        ativo: true,
        criado_em: new Date().toISOString(),
        ultimo_acesso: null,
      };

      // Inicializa o banco isolado (Multi-Tenant) para o novo perfil com as categorias 50-30-20
      const initialTenantDb = createInitialDemoState(newUserId, newUser.nome_exibicao);
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX}:${newUserId}`,
          JSON.stringify(initialTenantDb)
        );
      } catch {
        // ignore
      }

      setRegisteredUsers((prev) => [...prev, newUser]);
      return { success: true };
    },
    [registeredUsers]
  );

  const toggleProfileActive = useCallback((userId: string) => {
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId || u.username === 'admin') return u;
        return { ...u, ativo: !u.ativo };
      })
    );
  }, []);

  const deleteAccessProfile = useCallback((userId: string) => {
    setRegisteredUsers((prev) =>
      prev.filter((u) => u.id !== userId || u.username === 'admin')
    );
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}:${userId}`);
    } catch {
      // ignore
    }
  }, []);

  const resetLoginAttempts = useCallback((identifier: string) => {
    const normalized = identifier.trim().toLowerCase();
    setLoginAttempts((prev) => {
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
  }, []);

  // Permite ao usuário já logado alterar seu próprio login, e-mail, nome e senha a qualquer momento
  const updateOwnCredentials = useCallback(
    async (payload: {
      currentPassword: string;
      newUsername?: string;
      newEmail?: string;
      newDisplayName?: string;
      newPassword?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) {
        return { success: false, error: 'Nenhum usuário autenticado na sessão.' };
      }

      const nextUsername = payload.newUsername?.trim().toLowerCase() || currentUser.username;
      const nextEmail = payload.newEmail?.trim().toLowerCase() || currentUser.email;
      const nextDisplayName = payload.newDisplayName?.trim() || currentUser.nome_exibicao;

      if (!/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
        return {
          success: false,
          error:
            'O login de usuário deve ter de 3 a 32 caracteres (letras, números, ponto, hífen ou _).',
        };
      }

      if (payload.newPassword && payload.newPassword.length < 6) {
        return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
      }

      // ------------------------------------------------------------------
      // MODO NUVEM: valida senha atual e grava no Supabase Auth + user_settings
      // ------------------------------------------------------------------
      if (isCloudMode && supabase) {
        let passwordValid = false;
        const { data: verifiedRpc, error: rpcErr } = await supabase.rpc('verify_my_password', {
          p_password: payload.currentPassword,
        });

        if (!rpcErr) {
          passwordValid = Boolean(verifiedRpc);
        } else {
          // Fallback caso a RPC ainda não exista no banco: valida via signInWithPassword
          const { error: checkErr } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: payload.currentPassword,
          });
          passwordValid = !checkErr;
        }

        if (!passwordValid) {
          return { success: false, error: 'A senha atual informada está incorreta.' };
        }

        if (nextUsername !== currentUser.username.toLowerCase()) {
          const available = await cloudCheckUsernameAvailable(nextUsername);
          if (!available) {
            return {
              success: false,
              error: 'Este nome de usuário já está em uso por outra conta.',
            };
          }
        }

        const emailChanged = nextEmail !== currentUser.email.toLowerCase();
        const authPayload: {
          email?: string;
          password?: string;
          data?: Record<string, string>;
        } = {
          data: {
            nome_exibicao: nextDisplayName,
            username: nextUsername,
          },
        };
        if (emailChanged) authPayload.email = nextEmail;
        if (payload.newPassword) authPayload.password = payload.newPassword;

        const { error: authErr } = await supabase.auth.updateUser(authPayload);
        if (authErr) {
          return {
            success: false,
            error: authErr.message || 'Falha ao atualizar credenciais no Supabase Auth.',
          };
        }

        const { error: settingsErr } = await supabase
          .from('user_settings')
          .update({
            username: nextUsername,
            nome_exibicao: nextDisplayName,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', currentUser.id);

        if (settingsErr) {
          return {
            success: false,
            error:
              settingsErr.message.includes('unique') || settingsErr.code === '23505'
                ? 'Este nome de usuário já está em uso por outra conta.'
                : settingsErr.message,
          };
        }

        const updatedCloudUser: AuthUserAccount = {
          ...currentUser,
          username: nextUsername,
          email: nextEmail,
          nome_exibicao: nextDisplayName,
        };
        currentUserRef.current = updatedCloudUser;
        setCurrentUser(updatedCloudUser);
        commitDbState((prev) => ({
          ...prev,
          userSettings: {
            ...prev.userSettings,
            nome_exibicao: nextDisplayName,
          },
        }));

        return { success: true };
      }

      // ------------------------------------------------------------------
      // MODO LOCAL FALLBACK
      // ------------------------------------------------------------------
      if (!verifyPasswordHash(payload.currentPassword, currentUser.senha_hash)) {
        return { success: false, error: 'A senha atual informada está incorreta.' };
      }

      const duplicate = registeredUsers.some(
        (u) =>
          u.id !== currentUser.id &&
          (u.username.toLowerCase() === nextUsername || u.email.toLowerCase() === nextEmail)
      );
      if (duplicate) {
        return {
          success: false,
          error: 'Este nome de usuário ou e-mail já está em uso por outro perfil.',
        };
      }

      const nextPasswordHash = payload.newPassword
        ? encodePasswordHash(payload.newPassword)
        : currentUser.senha_hash;

      const updatedAccount: AuthUserAccount = {
        ...currentUser,
        username: nextUsername,
        email: nextEmail,
        nome_exibicao: nextDisplayName,
        senha_hash: nextPasswordHash,
      };

      setRegisteredUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? updatedAccount : u))
      );
      setCurrentUser(updatedAccount);

      commitDbState((prev) => ({
        ...prev,
        userSettings: {
          ...prev.userSettings,
          nome_exibicao: nextDisplayName,
        },
      }));

      return { success: true };
    },
    [commitDbState, currentUser, isCloudMode, registeredUsers]
  );

  // Permite ao Admin redefinir credenciais de qualquer perfil pelo painel Gerenciar Acessos
  const adminUpdateUserCredentials = useCallback(
    (payload: {
      targetUserId: string;
      newUsername?: string;
      newEmail?: string;
      newDisplayName?: string;
      newPassword?: string;
    }): { success: boolean; error?: string } => {
      if (currentUser?.role !== 'admin') {
        return { success: false, error: 'Permissão restrita ao Administrador.' };
      }

      const target = registeredUsers.find((u) => u.id === payload.targetUserId);
      if (!target) {
        return { success: false, error: 'Perfil não encontrado no banco.' };
      }

      const nextUsername = payload.newUsername?.trim().toLowerCase() || target.username;
      const nextEmail = payload.newEmail?.trim().toLowerCase() || target.email;
      const nextDisplayName = payload.newDisplayName?.trim() || target.nome_exibicao;

      if (nextUsername.length < 3) {
        return { success: false, error: 'O login deve ter pelo menos 3 caracteres.' };
      }
      if (payload.newPassword && payload.newPassword.length < 6) {
        return { success: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
      }

      const duplicate = registeredUsers.some(
        (u) =>
          u.id !== target.id &&
          (u.username.toLowerCase() === nextUsername || u.email.toLowerCase() === nextEmail)
      );
      if (duplicate) {
        return {
          success: false,
          error: 'Já existe outro perfil utilizando este usuário ou e-mail.',
        };
      }

      const updatedTarget: AuthUserAccount = {
        ...target,
        username: nextUsername,
        email: nextEmail,
        nome_exibicao: nextDisplayName,
        senha_hash: payload.newPassword
          ? encodePasswordHash(payload.newPassword)
          : target.senha_hash,
      };

      setRegisteredUsers((prev) =>
        prev.map((u) => (u.id === target.id ? updatedTarget : u))
      );

      if (currentUser.id === target.id) {
        setCurrentUser(updatedTarget);
        setDbState((prev) => ({
          ...prev,
          userSettings: {
            ...prev.userSettings,
            nome_exibicao: nextDisplayName,
          },
        }));
      }

      return { success: true };
    },
    [currentUser, registeredUsers]
  );

  // ============================================================================
  // SINCRONIZAÇÃO COM SUPABASE CLOUD
  // ============================================================================
  const syncWithSupabase = useCallback(async () => {
    if (!isCloudMode || !supabase) return;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setSyncError(`Erro ao sincronizar sessão: ${error.message}`);
      return;
    }
    await hydrateCloudSessionUser(data.user ?? null);
  }, [hydrateCloudSessionUser, isCloudMode]);

  // ============================================================================
  // AÇÕES DE CONFIGURAÇÃO DO USUÁRIO E TEMA
  // ============================================================================
  const persistGuestTheme = useCallback((cor_tema: ThemeColor, modo_tema: ThemeMode) => {
    try {
      localStorage.setItem(CLOUD_THEME_PREF_KEY, JSON.stringify({ cor_tema, modo_tema }));
    } catch {
      // ignore
    }
  }, []);

  const updateUserSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      const next = commitDbState((prev) => ({
        ...prev,
        userSettings: {
          ...prev.userSettings,
          ...partial,
        },
      }));

      if (partial.nome_exibicao !== undefined && currentUserRef.current) {
        const updatedUser = {
          ...currentUserRef.current,
          nome_exibicao: partial.nome_exibicao,
        };
        currentUserRef.current = updatedUser;
        setCurrentUser(updatedUser);
      }

      persistGuestTheme(next.userSettings.cor_tema, next.userSettings.modo_tema);
      void runCloudMutation('user_settings', (uid) => cloudUpsertUserSettings(uid, partial));
    },
    [commitDbState, persistGuestTheme, runCloudMutation]
  );

  const toggleThemeColor = useCallback(
    (theme?: ThemeColor) => {
      const themesOrder: ThemeColor[] = [
        'light-green',
        'purple-black',
        'deep-blue',
        'amber-purple',
        'monochrome',
      ];
      const currentTheme = dbStateRef.current.userSettings.cor_tema;
      const currentIdx = themesOrder.indexOf(currentTheme);
      const nextTheme =
        theme ?? themesOrder[(currentIdx + 1) % themesOrder.length] ?? 'light-green';

      document.documentElement.setAttribute('data-theme', nextTheme);
      if (document.body) {
        document.body.setAttribute('data-theme', nextTheme);
      }

      const next = commitDbState((prev) => ({
        ...prev,
        userSettings: {
          ...prev.userSettings,
          cor_tema: nextTheme,
        },
      }));

      persistGuestTheme(next.userSettings.cor_tema, next.userSettings.modo_tema);
      void runCloudMutation('cor_tema', (uid) =>
        cloudUpsertUserSettings(uid, { cor_tema: nextTheme })
      );
    },
    [commitDbState, persistGuestTheme, runCloudMutation]
  );

  const toggleThemeMode = useCallback(
    (mode?: ThemeMode) => {
      const nextMode =
        mode ?? (dbStateRef.current.userSettings.modo_tema === 'dark' ? 'light' : 'dark');
      const next = commitDbState((prev) => ({
        ...prev,
        userSettings: {
          ...prev.userSettings,
          modo_tema: nextMode,
        },
      }));

      persistGuestTheme(next.userSettings.cor_tema, next.userSettings.modo_tema);
      void runCloudMutation('modo_tema', (uid) =>
        cloudUpsertUserSettings(uid, { modo_tema: nextMode })
      );
    },
    [commitDbState, persistGuestTheme, runCloudMutation]
  );

  const toggleHideValues = useCallback(() => {
    const nextHidden = !dbStateRef.current.userSettings.ocultar_valores;
    commitDbState((prev) => ({
      ...prev,
      userSettings: {
        ...prev.userSettings,
        ocultar_valores: nextHidden,
      },
    }));
    void runCloudMutation('ocultar_valores', (uid) =>
      cloudUpsertUserSettings(uid, { ocultar_valores: nextHidden })
    );
  }, [commitDbState, runCloudMutation]);

  // ============================================================================
  // CRUD: ACCOUNTS
  // ============================================================================
  const addAccount = useCallback(
    (accountData: Omit<Account, 'id' | 'user_id' | 'saldo_atual'>) => {
      const uid = currentUserRef.current?.id || dbStateRef.current.userSettings.user_id || DEFAULT_ADMIN_ID;
      const newAccountId = createCloudUniqueId('acc');
      const newAccount: Account = {
        ...accountData,
        id: newAccountId,
        user_id: uid,
        saldo_atual: accountData.saldo_inicial,
      };

      const nextState = commitDbState((prev) => ({
        ...prev,
        accounts: recalculateAccountsBalance([...prev.accounts, newAccount], prev.transactions),
      }));

      const persisted = nextState.accounts.find((a) => a.id === newAccountId) ?? newAccount;
      void runCloudMutation('criar_conta', () => cloudUpsertAccounts([persisted]));
    },
    [commitDbState, runCloudMutation]
  );

  const updateAccount = useCallback(
    (id: string, data: Partial<Account>) => {
      const nextState = commitDbState((prev) => {
        const nextAccounts = prev.accounts.map((acc) =>
          acc.id === id ? { ...acc, ...data } : acc
        );
        return {
          ...prev,
          accounts: recalculateAccountsBalance(nextAccounts, prev.transactions),
        };
      });

      const updatedAcc = nextState.accounts.find((a) => a.id === id);
      if (updatedAcc) {
        void runCloudMutation('atualizar_conta', () => cloudUpsertAccounts([updatedAcc]));
      }
    },
    [commitDbState, runCloudMutation]
  );

  const deleteAccount = useCallback(
    (id: string) => {
      commitDbState((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((acc) => acc.id !== id),
        creditCards: prev.creditCards.filter((cc) => cc.account_id !== id),
      }));
      void runCloudMutation('excluir_conta', (uid) => cloudDeleteAccount(uid, id));
    },
    [commitDbState, runCloudMutation]
  );

  // Ajuste Rápido de Saldo: calibra o saldo_inicial para que o saldo_atual atinja exatamente o valor desejado
  const adjustAccountBalance = useCallback(
    (accountId: string, newTargetBalance: number) => {
      const targetAcc = dbStateRef.current.accounts.find((a) => a.id === accountId);
      if (!targetAcc) return;

      const diff = Number((newTargetBalance - targetAcc.saldo_atual).toFixed(2));
      if (diff === 0) return;

      const nextState = commitDbState((prev) => {
        const nextAccounts = prev.accounts.map((acc) =>
          acc.id === accountId
            ? { ...acc, saldo_inicial: Number((acc.saldo_inicial + diff).toFixed(2)) }
            : acc
        );
        return {
          ...prev,
          accounts: recalculateAccountsBalance(nextAccounts, prev.transactions),
        };
      });

      const updatedAcc = nextState.accounts.find((a) => a.id === accountId);
      if (updatedAcc) {
        void runCloudMutation('ajustar_saldo', () => cloudUpsertAccounts([updatedAcc]));
      }
    },
    [commitDbState, runCloudMutation]
  );

  // Transferência entre Contas (ex: sacar do banco para Carteira Física sem contar como despesa/receita)
  const transferBetweenAccounts = useCallback(
    (params: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      date: string;
      description?: string;
    }): { success: boolean; error?: string } => {
      if (params.fromAccountId === params.toAccountId) {
        return {
          success: false,
          error: 'Selecione contas de origem e destino diferentes para transferir.',
        };
      }
      if (params.amount <= 0 || Number.isNaN(params.amount)) {
        return { success: false, error: 'Informe um valor de transferência válido.' };
      }

      const currentState = dbStateRef.current;
      const fromAcc = currentState.accounts.find((a) => a.id === params.fromAccountId);
      const toAcc = currentState.accounts.find((a) => a.id === params.toAccountId);
      if (!fromAcc || !toAcc) {
        return { success: false, error: 'Conta de origem ou destino não encontrada.' };
      }

      const cleanAmount = Number(params.amount.toFixed(2));
      const uid =
        currentUserRef.current?.id || currentState.userSettings.user_id || DEFAULT_ADMIN_ID;
      const transferTx: Transaction = {
        id: createCloudUniqueId('tx'),
        user_id: uid,
        account_id: params.fromAccountId,
        credit_card_id: null,
        category_id: currentState.categories[0]?.id ?? '',
        descricao:
          params.description?.trim() || `Transferência: ${fromAcc.nome} → ${toAcc.nome}`,
        valor: cleanAmount,
        tipo: 'transferencia',
        natureza: 'variavel',
        parcela_atual: null,
        total_parcelas: null,
        grupo_parcelamento_id: null,
        status: 'pago',
        data_vencimento: params.date,
        data_pagamento: params.date,
      };

      const nextState = commitDbState((prev) => {
        const nextAccounts = prev.accounts.map((acc) => {
          if (acc.id === params.fromAccountId) {
            return { ...acc, saldo_inicial: Number((acc.saldo_inicial - cleanAmount).toFixed(2)) };
          }
          if (acc.id === params.toAccountId) {
            return { ...acc, saldo_inicial: Number((acc.saldo_inicial + cleanAmount).toFixed(2)) };
          }
          return acc;
        });
        const nextTransactions = [transferTx, ...prev.transactions];
        return {
          ...prev,
          transactions: nextTransactions,
          accounts: recalculateAccountsBalance(nextAccounts, nextTransactions),
        };
      });

      const affectedAccounts = nextState.accounts.filter(
        (a) => a.id === params.fromAccountId || a.id === params.toAccountId
      );
      void runCloudMutation('transferencia', async () => {
        await cloudUpsertAccounts(affectedAccounts);
        await cloudUpsertTransactions([transferTx]);
      });

      return { success: true };
    },
    [commitDbState, runCloudMutation]
  );

  // ============================================================================
  // CRUD: CREDIT CARDS
  // ============================================================================
  const addCreditCard = useCallback(
    (cardData: Omit<CreditCard, 'id' | 'user_id'>) => {
      const uid =
        currentUserRef.current?.id || dbStateRef.current.userSettings.user_id || DEFAULT_ADMIN_ID;
      const newCard: CreditCard = {
        ...cardData,
        id: createCloudUniqueId('cc'),
        user_id: uid,
      };
      commitDbState((prev) => ({
        ...prev,
        creditCards: [...prev.creditCards, newCard],
      }));
      void runCloudMutation('criar_cartao', () => cloudUpsertCreditCard(newCard));
    },
    [commitDbState, runCloudMutation]
  );

  const updateCreditCard = useCallback(
    (id: string, data: Partial<CreditCard>) => {
      const nextState = commitDbState((prev) => ({
        ...prev,
        creditCards: prev.creditCards.map((cc) => (cc.id === id ? { ...cc, ...data } : cc)),
      }));
      const updatedCard = nextState.creditCards.find((cc) => cc.id === id);
      if (updatedCard) {
        void runCloudMutation('atualizar_cartao', () => cloudUpsertCreditCard(updatedCard));
      }
    },
    [commitDbState, runCloudMutation]
  );

  const deleteCreditCard = useCallback(
    (id: string) => {
      commitDbState((prev) => ({
        ...prev,
        creditCards: prev.creditCards.filter((cc) => cc.id !== id),
      }));
      void runCloudMutation('excluir_cartao', (uid) => cloudDeleteCreditCard(uid, id));
    },
    [commitDbState, runCloudMutation]
  );

  // Pagar Fatura do Cartão: liquida todos os lançamentos pendentes daquele mês no cartão e debita da conta escolhida
  const payCreditCardInvoice = useCallback(
    (
      cardId: string,
      mesAno: string,
      paymentAccountId: string
    ): { success: boolean; paidCount: number; totalPaid: number; error?: string } => {
      const pendingInvoiceTxs = dbStateRef.current.transactions.filter(
        (tx) =>
          tx.credit_card_id === cardId &&
          tx.status === 'pendente' &&
          tx.data_vencimento.startsWith(mesAno)
      );

      if (pendingInvoiceTxs.length === 0) {
        return {
          success: false,
          paidCount: 0,
          totalPaid: 0,
          error: 'Não há lançamentos pendentes nesta fatura para dar baixa.',
        };
      }

      const totalPaid = Number(
        pendingInvoiceTxs.reduce((acc, tx) => acc + tx.valor, 0).toFixed(2)
      );
      const todayIso = new Date().toISOString().split('T')[0];
      const pendingIds = new Set(pendingInvoiceTxs.map((t) => t.id));

      const nextState = commitDbState((prev) => {
        const nextTransactions: Transaction[] = prev.transactions.map((tx) => {
          if (pendingIds.has(tx.id)) {
            return {
              ...tx,
              status: 'pago',
              account_id: paymentAccountId,
              data_pagamento: todayIso,
            };
          }
          return tx;
        });

        return {
          ...prev,
          transactions: nextTransactions,
          accounts: recalculateAccountsBalance(prev.accounts, nextTransactions),
        };
      });

      const settledTxs = nextState.transactions.filter((tx) => pendingIds.has(tx.id));
      void runCloudMutation('pagar_fatura', async () => {
        await cloudUpsertTransactions(settledTxs);
        await cloudUpsertAccounts(nextState.accounts);
      });

      return {
        success: true,
        paidCount: pendingInvoiceTxs.length,
        totalPaid,
      };
    },
    [commitDbState, runCloudMutation]
  );

  // ============================================================================
  // CRUD: CATEGORIES
  // ============================================================================
  const addCategory = useCallback(
    (categoryData: Omit<Category, 'id' | 'user_id'>) => {
      const uid =
        currentUserRef.current?.id || dbStateRef.current.userSettings.user_id || DEFAULT_ADMIN_ID;
      const newCategory: Category = {
        ...categoryData,
        id: createCloudUniqueId('cat'),
        user_id: uid,
      };
      commitDbState((prev) => ({
        ...prev,
        categories: [...prev.categories, newCategory],
      }));
      void runCloudMutation('criar_categoria', () => cloudUpsertCategory(newCategory));
    },
    [commitDbState, runCloudMutation]
  );

  const updateCategory = useCallback(
    (id: string, data: Partial<Category>) => {
      const nextState = commitDbState((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) => (cat.id === id ? { ...cat, ...data } : cat)),
      }));
      const updated = nextState.categories.find((c) => c.id === id);
      if (updated) {
        void runCloudMutation('atualizar_categoria', () => cloudUpsertCategory(updated));
      }
    },
    [commitDbState, runCloudMutation]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      commitDbState((prev) => ({
        ...prev,
        categories: prev.categories.filter((cat) => cat.id !== id),
      }));
      void runCloudMutation('excluir_categoria', (uid) => cloudDeleteCategory(uid, id));
    },
    [commitDbState, runCloudMutation]
  );

  // ============================================================================
  // CRUD: TRANSACTIONS (Com suporte a parcelamento N vezes e Dia de Fechamento do Cartão)
  // ============================================================================
  const addTransaction = useCallback(
    (
      txData: Omit<
        Transaction,
        'id' | 'user_id' | 'parcela_atual' | 'grupo_parcelamento_id'
      >
    ) => {
      const currentState = dbStateRef.current;
      const userId =
        currentUserRef.current?.id || currentState.userSettings.user_id || DEFAULT_ADMIN_ID;
      const createdTransactions: Transaction[] = [];

      // Se for compra no Cartão de Crédito, verifica se a data da compra é após o dia_fechamento
      let baseDate = new Date(`${txData.data_vencimento}T12:00:00`);
      if (txData.credit_card_id) {
        const card = currentState.creditCards.find((cc) => cc.id === txData.credit_card_id);
        if (card) {
          const purchaseDay = baseDate.getDate();
          // Compras feitas após o dia de fechamento vão automaticamente para a fatura do mês seguinte
          if (purchaseDay > card.dia_fechamento) {
            baseDate = new Date(
              baseDate.getFullYear(),
              baseDate.getMonth() + 1,
              Math.min(card.dia_vencimento, 28),
              12,
              0,
              0
            );
          }
        }
      }

      const totalParcelas =
        txData.natureza === 'parcelada' && txData.total_parcelas && txData.total_parcelas > 1
          ? txData.total_parcelas
          : 1;

      if (totalParcelas > 1) {
        const groupId = createCloudUniqueId('grp');

        for (let i = 1; i <= totalParcelas; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(baseDate.getMonth() + (i - 1));
          const isoDue = installmentDate.toISOString().split('T')[0];

          createdTransactions.push({
            ...txData,
            id: createCloudUniqueId('tx'),
            user_id: userId,
            parcela_atual: i,
            total_parcelas: totalParcelas,
            grupo_parcelamento_id: groupId,
            status: i === 1 && !txData.credit_card_id ? txData.status : 'pendente',
            data_vencimento: isoDue,
            data_pagamento:
              i === 1 && !txData.credit_card_id && txData.status === 'pago' ? isoDue : null,
          });
        }
      } else if (txData.natureza === 'fixa') {
        // Natureza Fixa Mensal: projeta/repete automaticamente para os 12 meses consecutivos
        const fixedGroupId = createCloudUniqueId('fix');
        const monthsToProject = 12;

        for (let m = 0; m < monthsToProject; m++) {
          const recurringDate = new Date(baseDate);
          recurringDate.setMonth(baseDate.getMonth() + m);
          const isoDue = recurringDate.toISOString().split('T')[0];
          const isFirstMonth = m === 0;

          createdTransactions.push({
            ...txData,
            id: createCloudUniqueId('tx'),
            user_id: userId,
            parcela_atual: null,
            total_parcelas: null,
            grupo_parcelamento_id: fixedGroupId,
            status: isFirstMonth && !txData.credit_card_id ? txData.status : 'pendente',
            data_vencimento: isoDue,
            data_pagamento:
              isFirstMonth && !txData.credit_card_id && txData.status === 'pago'
                ? isoDue
                : null,
          });
        }
      } else {
        const effectiveDueIso = baseDate.toISOString().split('T')[0];
        createdTransactions.push({
          ...txData,
          id: createCloudUniqueId('tx'),
          user_id: userId,
          data_vencimento: effectiveDueIso,
          parcela_atual: null,
          total_parcelas: null,
          grupo_parcelamento_id: null,
        });
      }

      const nextState = commitDbState((prev) => {
        const nextTransactions = [...createdTransactions, ...prev.transactions];
        return {
          ...prev,
          transactions: nextTransactions,
          accounts: recalculateAccountsBalance(prev.accounts, nextTransactions),
        };
      });

      void runCloudMutation('criar_lancamento', async () => {
        await cloudUpsertTransactions(createdTransactions);
        await cloudUpsertAccounts(nextState.accounts);
      });
    },
    [commitDbState, runCloudMutation]
  );

  const updateTransaction = useCallback(
    (id: string, data: Partial<Transaction>) => {
      const nextState = commitDbState((prev) => {
        const nextTransactions = prev.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...data } : tx
        );
        return {
          ...prev,
          transactions: nextTransactions,
          accounts: recalculateAccountsBalance(prev.accounts, nextTransactions),
        };
      });

      const updatedTx = nextState.transactions.find((tx) => tx.id === id);
      if (updatedTx) {
        void runCloudMutation('atualizar_lancamento', async () => {
          await cloudUpsertTransactions([updatedTx]);
          await cloudUpsertAccounts(nextState.accounts);
        });
      }
    },
    [commitDbState, runCloudMutation]
  );

  const deleteTransaction = useCallback(
    (id: string, deleteParcelGroup = false) => {
      const currentTransactions = dbStateRef.current.transactions;
      const target = currentTransactions.find((tx) => tx.id === id);
      const idsToDelete = currentTransactions
        .filter((tx) => {
          if (
            deleteParcelGroup &&
            target?.grupo_parcelamento_id &&
            tx.grupo_parcelamento_id === target.grupo_parcelamento_id
          ) {
            return true;
          }
          return tx.id === id;
        })
        .map((tx) => tx.id);

      const idSet = new Set(idsToDelete);
      const nextState = commitDbState((prev) => {
        const nextTransactions = prev.transactions.filter((tx) => !idSet.has(tx.id));
        return {
          ...prev,
          transactions: nextTransactions,
          accounts: recalculateAccountsBalance(prev.accounts, nextTransactions),
        };
      });

      void runCloudMutation('excluir_lancamento', async (uid) => {
        await cloudDeleteTransactions(uid, idsToDelete);
        await cloudUpsertAccounts(nextState.accounts);
      });
    },
    [commitDbState, runCloudMutation]
  );

  const toggleTransactionStatus = useCallback(
    (id: string) => {
      const todayIso = new Date().toISOString().split('T')[0];
      const nextState = commitDbState((prev) => {
        const nextTransactions: Transaction[] = prev.transactions.map((tx) => {
          if (tx.id !== id) return tx;
          const nextStatus: TransactionStatus = tx.status === 'pago' ? 'pendente' : 'pago';

          // Se for compra de cartão sendo baixada individualmente, vincula à conta do cartão para debitar do saldo real
          let nextAccountId = tx.account_id;
          if (nextStatus === 'pago' && !nextAccountId && tx.credit_card_id) {
            const linkedCard = prev.creditCards.find((cc) => cc.id === tx.credit_card_id);
            nextAccountId = linkedCard?.account_id ?? prev.accounts[0]?.id ?? null;
          }

          return {
            ...tx,
            account_id: nextAccountId,
            status: nextStatus,
            data_pagamento: nextStatus === 'pago' ? todayIso : null,
          };
        });

        return {
          ...prev,
          transactions: nextTransactions,
          accounts: recalculateAccountsBalance(prev.accounts, nextTransactions),
        };
      });

      const updatedTx = nextState.transactions.find((tx) => tx.id === id);
      if (updatedTx) {
        void runCloudMutation('alternar_status', async () => {
          await cloudUpsertTransactions([updatedTx]);
          await cloudUpsertAccounts(nextState.accounts);
        });
      }
    },
    [commitDbState, runCloudMutation]
  );

  // ============================================================================
  // CRUD: BUDGETS
  // ============================================================================
  const upsertBudget = useCallback(
    (category_id: string, mes_ano: string, valor_teto_planejado: number) => {
      let persistedBudget: Budget | null = null;
      commitDbState((prev) => {
        const existingIndex = prev.budgets.findIndex(
          (b) => b.category_id === category_id && b.mes_ano === mes_ano
        );
        if (existingIndex >= 0) {
          const updated = [...prev.budgets];
          persistedBudget = {
            ...updated[existingIndex],
            valor_teto_planejado,
          };
          updated[existingIndex] = persistedBudget;
          return { ...prev, budgets: updated };
        }
        const uid = currentUserRef.current?.id || prev.userSettings.user_id || DEFAULT_ADMIN_ID;
        persistedBudget = {
          id: createCloudUniqueId('bdg'),
          user_id: uid,
          category_id,
          mes_ano,
          valor_teto_planejado,
        };
        return {
          ...prev,
          budgets: [...prev.budgets, persistedBudget],
        };
      });

      if (persistedBudget) {
        const target = persistedBudget;
        void runCloudMutation('salvar_orcamento', () => cloudUpsertBudget(target));
      }
    },
    [commitDbState, runCloudMutation]
  );

  const deleteBudget = useCallback(
    (id: string) => {
      commitDbState((prev) => ({
        ...prev,
        budgets: prev.budgets.filter((b) => b.id !== id),
      }));
      void runCloudMutation('excluir_orcamento', (uid) => cloudDeleteBudget(uid, id));
    },
    [commitDbState, runCloudMutation]
  );

  // ============================================================================
  // CRUD: FINANCIAL GOALS
  // ============================================================================
  const addFinancialGoal = useCallback(
    (goalData: Omit<FinancialGoal, 'id' | 'user_id'>) => {
      const uid =
        currentUserRef.current?.id || dbStateRef.current.userSettings.user_id || DEFAULT_ADMIN_ID;
      const newGoal: FinancialGoal = {
        ...goalData,
        id: createCloudUniqueId('goal'),
        user_id: uid,
      };
      commitDbState((prev) => ({
        ...prev,
        financialGoals: [...prev.financialGoals, newGoal],
      }));
      void runCloudMutation('criar_meta', () => cloudUpsertGoal(newGoal));
    },
    [commitDbState, runCloudMutation]
  );

  const updateFinancialGoal = useCallback(
    (id: string, data: Partial<FinancialGoal>) => {
      const nextState = commitDbState((prev) => ({
        ...prev,
        financialGoals: prev.financialGoals.map((g) => (g.id === id ? { ...g, ...data } : g)),
      }));
      const updatedGoal = nextState.financialGoals.find((g) => g.id === id);
      if (updatedGoal) {
        void runCloudMutation('atualizar_meta', () => cloudUpsertGoal(updatedGoal));
      }
    },
    [commitDbState, runCloudMutation]
  );

  const contributeToGoal = useCallback(
    (id: string, amount: number) => {
      const nextState = commitDbState((prev) => ({
        ...prev,
        financialGoals: prev.financialGoals.map((g) =>
          g.id === id
            ? {
                ...g,
                valor_acumulado: Math.max(0, Number((g.valor_acumulado + amount).toFixed(2))),
              }
            : g
        ),
      }));
      const updatedGoal = nextState.financialGoals.find((g) => g.id === id);
      if (updatedGoal) {
        void runCloudMutation('aportar_meta', () => cloudUpsertGoal(updatedGoal));
      }
    },
    [commitDbState, runCloudMutation]
  );

  const deleteFinancialGoal = useCallback(
    (id: string) => {
      commitDbState((prev) => ({
        ...prev,
        financialGoals: prev.financialGoals.filter((g) => g.id !== id),
      }));
      void runCloudMutation('excluir_meta', (uid) => cloudDeleteGoal(uid, id));
    },
    [commitDbState, runCloudMutation]
  );

  const resetToDemoData = useCallback(() => {
    const uid = activeTenantId || DEFAULT_ADMIN_ID;
    const rawDemo = createInitialDemoState(uid, activeTenantName);
    const preparedDemo = isCloudMode ? remapStateIdsForUser(rawDemo, uid) : rawDemo;
    commitDbState(() => preparedDemo);
    void runCloudMutation('restaurar_demo', (cloudUid) =>
      cloudReplaceFullWorkspace(cloudUid, preparedDemo)
    );
  }, [activeTenantId, activeTenantName, commitDbState, isCloudMode, runCloudMutation]);

  const exportBackupJson = useCallback(() => {
    const backupPayload = {
      app: 'Gestor Financeiro',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tenantId: activeTenantId,
      data: dbState,
    };
    return JSON.stringify(backupPayload, null, 2);
  }, [activeTenantId, dbState]);

  const importBackupJson = useCallback(
    (rawJson: string): { success: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(rawJson);
        const targetState: Partial<FinanceDatabaseState> = parsed.data
          ? parsed.data
          : parsed;

        if (
          !targetState ||
          !Array.isArray(targetState.accounts) ||
          !Array.isArray(targetState.transactions)
        ) {
          return {
            success: false,
            error:
              'Arquivo JSON inválido: estrutura de contas ou transações não encontrada.',
          };
        }

        const prev = dbStateRef.current;
        const uid = activeTenantId || prev.userSettings.user_id || DEFAULT_ADMIN_ID;
        const mergedState: FinanceDatabaseState = {
          accounts: recalculateAccountsBalance(
            targetState.accounts ?? prev.accounts,
            targetState.transactions ?? prev.transactions
          ),
          creditCards: Array.isArray(targetState.creditCards)
            ? targetState.creditCards
            : prev.creditCards,
          categories: Array.isArray(targetState.categories)
            ? targetState.categories
            : prev.categories,
          transactions: targetState.transactions ?? prev.transactions,
          budgets: Array.isArray(targetState.budgets) ? targetState.budgets : prev.budgets,
          financialGoals: Array.isArray(targetState.financialGoals)
            ? targetState.financialGoals
            : prev.financialGoals,
          userSettings: targetState.userSettings
            ? {
                ...prev.userSettings,
                ...targetState.userSettings,
                cor_tema: normalizeThemeColor(targetState.userSettings.cor_tema),
                user_id: uid,
              }
            : prev.userSettings,
        };

        const finalState = isCloudMode ? remapStateIdsForUser(mergedState, uid) : mergedState;
        commitDbState(() => finalState);

        void runCloudMutation('importar_backup', (cloudUid) =>
          cloudReplaceFullWorkspace(cloudUid, finalState)
        );

        return { success: true };
      } catch {
        return {
          success: false,
          error: 'Não foi possível ler o arquivo JSON de backup.',
        };
      }
    },
    [activeTenantId, commitDbState, isCloudMode, runCloudMutation]
  );

  // ============================================================================
  // SELETORES E INDICADORES CONSOLIDADOS DO MÊS SELECIONADO (REGRA 50-30-20)
  // ============================================================================
  const totalSaldoGeral = useMemo(() => {
    return dbState.accounts
      .filter((acc) => acc.incluir_na_soma_geral)
      .reduce((sum, acc) => sum + acc.saldo_atual, 0);
  }, [dbState.accounts]);

  const monthTransactions = useMemo(() => {
    return dbState.transactions.filter((tx) =>
      tx.data_vencimento.startsWith(selectedMonth)
    );
  }, [dbState.transactions, selectedMonth]);

  const receitasMes = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.tipo === 'receita')
      .reduce((sum, tx) => sum + tx.valor, 0);
  }, [monthTransactions]);

  const despesasMes = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.tipo === 'despesa')
      .reduce((sum, tx) => sum + tx.valor, 0);
  }, [monthTransactions]);

  const saldoPrevistoMes = useMemo(() => {
    return receitasMes - despesasMes;
  }, [receitasMes, despesasMes]);

  const rule503020Summary = useMemo<Rule503020Breakdown>(() => {
    const categoryMap = new Map<string, Category>(
      dbState.categories.map((c) => [c.id, c])
    );

    const totals: Record<Rule503020, number> = {
      essencial_50: 0,
      estilo_vida_30: 0,
      futuro_20: 0,
    };
    let semPilarTotal = 0;

    monthTransactions
      .filter((tx) => tx.tipo === 'despesa')
      .forEach((tx) => {
        const category = categoryMap.get(tx.category_id);
        const bucket = category?.regra_50_30_20;
        if (bucket && bucket in totals) {
          totals[bucket] += tx.valor;
        } else {
          semPilarTotal += tx.valor;
        }
      });

    const baseReceita = receitasMes > 0 ? receitasMes : 1;
    const pctEssencial = dbState.userSettings.pct_essencial ?? 50;
    const pctEstilo = dbState.userSettings.pct_estilo_vida ?? 30;
    const pctFuturo = dbState.userSettings.pct_futuro ?? 20;

    return {
      receitaLiquidaMes: receitasMes,
      essencial_50: {
        gasto: totals.essencial_50,
        ideal: receitasMes * (pctEssencial / 100),
        percentualReceita: Number(((totals.essencial_50 / baseReceita) * 100).toFixed(1)),
        targetPct: pctEssencial,
      },
      estilo_vida_30: {
        gasto: totals.estilo_vida_30,
        ideal: receitasMes * (pctEstilo / 100),
        percentualReceita: Number(((totals.estilo_vida_30 / baseReceita) * 100).toFixed(1)),
        targetPct: pctEstilo,
      },
      futuro_20: {
        gasto: totals.futuro_20,
        ideal: receitasMes * (pctFuturo / 100),
        percentualReceita: Number(((totals.futuro_20 / baseReceita) * 100).toFixed(1)),
        targetPct: pctFuturo,
      },
      sem_pilar: {
        gasto: semPilarTotal,
        percentualReceita: Number(((semPilarTotal / baseReceita) * 100).toFixed(1)),
      },
    };
  }, [
    dbState.categories,
    dbState.userSettings.pct_essencial,
    dbState.userSettings.pct_estilo_vida,
    dbState.userSettings.pct_futuro,
    monthTransactions,
    receitasMes,
  ]);

  const value = useMemo<FinanceContextData>(
    () => ({
      ...dbState,
      currentUser,
      isAuthLoading,
      registeredUsers,
      loginAttempts,
      login,
      registerAccount,
      logout,
      getLockoutStatus,
      createAccessProfile,
      toggleProfileActive,
      deleteAccessProfile,
      resetLoginAttempts,
      updateOwnCredentials,
      adminUpdateUserCredentials,
      activeTab,
      setActiveTab,
      isQuickTransactionOpen,
      setIsQuickTransactionOpen,
      editingTransaction,
      setEditingTransaction,
      selectedMonth,
      setSelectedMonth,
      isSupabaseReady: isSupabaseConfigured,
      isSyncing,
      lastSyncedAt,
      syncError,
      syncWithSupabase,
      totalSaldoGeral,
      receitasMes,
      despesasMes,
      saldoPrevistoMes,
      rule503020Summary,
      updateUserSettings,
      toggleThemeColor,
      toggleThemeMode,
      toggleHideValues,
      addAccount,
      updateAccount,
      deleteAccount,
      adjustAccountBalance,
      transferBetweenAccounts,
      addCreditCard,
      updateCreditCard,
      deleteCreditCard,
      payCreditCardInvoice,
      addCategory,
      updateCategory,
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      toggleTransactionStatus,
      upsertBudget,
      deleteBudget,
      addFinancialGoal,
      updateFinancialGoal,
      contributeToGoal,
      deleteFinancialGoal,
      resetToDemoData,
      exportBackupJson,
      importBackupJson,
    }),
    [
      dbState,
      currentUser,
      isAuthLoading,
      registeredUsers,
      loginAttempts,
      login,
      registerAccount,
      logout,
      getLockoutStatus,
      createAccessProfile,
      toggleProfileActive,
      deleteAccessProfile,
      resetLoginAttempts,
      updateOwnCredentials,
      adminUpdateUserCredentials,
      activeTab,
      setActiveTab,
      isQuickTransactionOpen,
      editingTransaction,
      selectedMonth,
      setSelectedMonth,
      isSyncing,
      lastSyncedAt,
      syncError,
      syncWithSupabase,
      totalSaldoGeral,
      receitasMes,
      despesasMes,
      saldoPrevistoMes,
      rule503020Summary,
      updateUserSettings,
      toggleThemeColor,
      toggleThemeMode,
      toggleHideValues,
      addAccount,
      updateAccount,
      deleteAccount,
      adjustAccountBalance,
      transferBetweenAccounts,
      addCreditCard,
      updateCreditCard,
      deleteCreditCard,
      payCreditCardInvoice,
      addCategory,
      updateCategory,
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      toggleTransactionStatus,
      upsertBudget,
      deleteBudget,
      addFinancialGoal,
      updateFinancialGoal,
      contributeToGoal,
      deleteFinancialGoal,
      resetToDemoData,
      exportBackupJson,
      importBackupJson,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextData {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance deve ser utilizado dentro de um FinanceProvider');
  }
  return context;
}
