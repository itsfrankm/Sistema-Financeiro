import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  Account,
  AuthUserAccount,
  Budget,
  Category,
  CreditCard,
  FinanceDatabaseState,
  FinancialGoal,
  ThemeColor,
  Transaction,
  UserRole,
  UserSettings,
} from '../types/finance';

const VALID_THEMES: ThemeColor[] = [
  'light-green',
  'purple-black',
  'deep-blue',
  'amber-purple',
  'monochrome',
];

export function normalizeThemeColor(raw?: string | null): ThemeColor {
  if (raw && VALID_THEMES.includes(raw as ThemeColor)) {
    return raw as ThemeColor;
  }
  if (raw === 'graphite') {
    return 'monochrome';
  }
  return 'purple-black';
}

export function createCloudUniqueId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// RE-CÁLCULO COMPARTILHADO DE SALDO DAS CONTAS
// ============================================================================
export function recalculateAccountsBalance(
  accounts: Account[],
  transactions: Transaction[]
): Account[] {
  return accounts.map((acc) => {
    const accountTransactions = transactions.filter(
      (tx) => tx.account_id === acc.id && tx.status === 'pago'
    );

    const delta = accountTransactions.reduce((sum, tx) => {
      if (tx.tipo === 'receita') return sum + tx.valor;
      if (tx.tipo === 'despesa') return sum - tx.valor;
      return sum;
    }, 0);

    return {
      ...acc,
      saldo_atual: Number((acc.saldo_inicial + delta).toFixed(2)),
    };
  });
}

// ============================================================================
// CONVERSORES ROW <-> MODELO TYPESCRIPT (SEM COLUNAS DESCONHECIDAS NO POSTGREST)
// ============================================================================
function mapAccountRow(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    nome: String(row.nome ?? ''),
    tipo: row.tipo as Account['tipo'],
    saldo_inicial: Number(row.saldo_inicial ?? 0),
    saldo_atual: Number(row.saldo_atual ?? 0),
    cor: String(row.cor ?? '#8b5cf6'),
    incluir_na_soma_geral: Boolean(row.incluir_na_soma_geral ?? true),
  };
}

function toAccountRow(acc: Account) {
  return {
    id: acc.id,
    user_id: acc.user_id,
    nome: acc.nome,
    tipo: acc.tipo,
    saldo_inicial: Number(acc.saldo_inicial.toFixed(2)),
    saldo_atual: Number(acc.saldo_atual.toFixed(2)),
    cor: acc.cor,
    incluir_na_soma_geral: acc.incluir_na_soma_geral,
    updated_at: new Date().toISOString(),
  };
}

function mapCreditCardRow(row: Record<string, unknown>): CreditCard {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: String(row.account_id),
    nome_cartao: String(row.nome_cartao ?? ''),
    limite_total: Number(row.limite_total ?? 0),
    dia_fechamento: Number(row.dia_fechamento ?? 1),
    dia_vencimento: Number(row.dia_vencimento ?? 10),
    cor: String(row.cor ?? '#8b5cf6'),
  };
}

function toCreditCardRow(card: CreditCard) {
  return {
    id: card.id,
    user_id: card.user_id,
    account_id: card.account_id,
    nome_cartao: card.nome_cartao,
    limite_total: Number(card.limite_total.toFixed(2)),
    dia_fechamento: card.dia_fechamento,
    dia_vencimento: card.dia_vencimento,
    cor: card.cor,
    updated_at: new Date().toISOString(),
  };
}

function mapCategoryRow(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    nome: String(row.nome ?? ''),
    tipo: row.tipo as Category['tipo'],
    icone: String(row.icone ?? 'Tag'),
    cor: String(row.cor ?? '#8b5cf6'),
    regra_50_30_20: (row.regra_50_30_20 as Category['regra_50_30_20']) ?? null,
    percentual_meta:
      row.percentual_meta !== null && row.percentual_meta !== undefined
        ? Number(row.percentual_meta)
        : null,
  };
}

function toCategoryRow(cat: Category) {
  return {
    id: cat.id,
    user_id: cat.user_id,
    nome: cat.nome,
    tipo: cat.tipo,
    icone: cat.icone,
    cor: cat.cor,
    regra_50_30_20: cat.regra_50_30_20 ?? null,
    percentual_meta:
      cat.percentual_meta !== undefined && cat.percentual_meta !== null
        ? Number(cat.percentual_meta)
        : null,
  };
}

function mapTransactionRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id ? String(row.account_id) : null,
    credit_card_id: row.credit_card_id ? String(row.credit_card_id) : null,
    category_id: row.category_id ? String(row.category_id) : '',
    descricao: String(row.descricao ?? ''),
    valor: Number(row.valor ?? 0),
    tipo: row.tipo as Transaction['tipo'],
    natureza: row.natureza as Transaction['natureza'],
    parcela_atual:
      row.parcela_atual !== null && row.parcela_atual !== undefined
        ? Number(row.parcela_atual)
        : null,
    total_parcelas:
      row.total_parcelas !== null && row.total_parcelas !== undefined
        ? Number(row.total_parcelas)
        : null,
    grupo_parcelamento_id: row.grupo_parcelamento_id
      ? String(row.grupo_parcelamento_id)
      : null,
    status: (row.status as Transaction['status']) ?? 'pendente',
    data_vencimento: String(row.data_vencimento ?? '').slice(0, 10),
    data_pagamento: row.data_pagamento ? String(row.data_pagamento).slice(0, 10) : null,
  };
}

function toTransactionRow(tx: Transaction) {
  return {
    id: tx.id,
    user_id: tx.user_id,
    account_id: tx.account_id || null,
    credit_card_id: tx.credit_card_id || null,
    category_id: tx.category_id || null,
    descricao: tx.descricao,
    valor: Number(tx.valor.toFixed(2)),
    tipo: tx.tipo,
    natureza: tx.natureza,
    parcela_atual: tx.parcela_atual ?? null,
    total_parcelas: tx.total_parcelas ?? null,
    grupo_parcelamento_id: tx.grupo_parcelamento_id ?? null,
    status: tx.status,
    data_vencimento: tx.data_vencimento,
    data_pagamento: tx.data_pagamento ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapBudgetRow(row: Record<string, unknown>): Budget {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    category_id: String(row.category_id),
    mes_ano: String(row.mes_ano),
    valor_teto_planejado: Number(row.valor_teto_planejado ?? 0),
  };
}

function toBudgetRow(bdg: Budget) {
  return {
    id: bdg.id,
    user_id: bdg.user_id,
    category_id: bdg.category_id,
    mes_ano: bdg.mes_ano,
    valor_teto_planejado: Number(bdg.valor_teto_planejado.toFixed(2)),
    updated_at: new Date().toISOString(),
  };
}

function mapGoalRow(row: Record<string, unknown>): FinancialGoal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    titulo: String(row.titulo ?? ''),
    valor_meta: Number(row.valor_meta ?? 0),
    valor_acumulado: Number(row.valor_acumulado ?? 0),
    data_alvo: String(row.data_alvo ?? '').slice(0, 10),
    cor: String(row.cor ?? '#8b5cf6'),
    icone: String(row.icone ?? 'Target'),
  };
}

function toGoalRow(goal: FinancialGoal) {
  return {
    id: goal.id,
    user_id: goal.user_id,
    titulo: goal.titulo,
    valor_meta: Number(goal.valor_meta.toFixed(2)),
    valor_acumulado: Number(goal.valor_acumulado.toFixed(2)),
    data_alvo: goal.data_alvo,
    cor: goal.cor,
    icone: goal.icone,
    updated_at: new Date().toISOString(),
  };
}

function toUserSettingsPatch(partial: Partial<UserSettings>) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (partial.nome_exibicao !== undefined) patch.nome_exibicao = partial.nome_exibicao;
  if (partial.avatar_url !== undefined) patch.avatar_url = partial.avatar_url;
  if (partial.moeda !== undefined) patch.moeda = partial.moeda;
  if (partial.meta_economia_mensal !== undefined) {
    patch.meta_economia_mensal = Number(partial.meta_economia_mensal);
  }
  if (partial.cor_tema !== undefined) patch.cor_tema = partial.cor_tema;
  if (partial.modo_tema !== undefined) patch.modo_tema = partial.modo_tema;
  if (partial.ocultar_valores !== undefined) patch.ocultar_valores = partial.ocultar_valores;
  if (partial.usar_regra_50_30_20 !== undefined) {
    patch.usar_regra_50_30_20 = partial.usar_regra_50_30_20;
  }
  if (partial.pct_essencial !== undefined) patch.pct_essencial = partial.pct_essencial;
  if (partial.pct_estilo_vida !== undefined) patch.pct_estilo_vida = partial.pct_estilo_vida;
  if (partial.pct_futuro !== undefined) patch.pct_futuro = partial.pct_futuro;
  return patch;
}

// ============================================================================
// RE-MAPEAMENTO DE IDs ÚNICOS GLOBAIS POR CONTA (EVITA COLISÃO MULTI-TENANT)
// ============================================================================
export function remapStateIdsForUser(
  source: FinanceDatabaseState,
  userId: string
): FinanceDatabaseState {
  const accountIdMap = new Map<string, string>();
  const cardIdMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();
  const parcelGroupMap = new Map<string, string>();

  const categories: Category[] = source.categories.map((cat) => {
    const newId = createCloudUniqueId('cat');
    categoryIdMap.set(cat.id, newId);
    return { ...cat, id: newId, user_id: userId };
  });

  const accounts: Account[] = source.accounts.map((acc) => {
    const newId = createCloudUniqueId('acc');
    accountIdMap.set(acc.id, newId);
    return { ...acc, id: newId, user_id: userId };
  });

  const creditCards: CreditCard[] = source.creditCards.map((cc) => {
    const newId = createCloudUniqueId('cc');
    cardIdMap.set(cc.id, newId);
    return {
      ...cc,
      id: newId,
      user_id: userId,
      account_id: accountIdMap.get(cc.account_id) ?? accounts[0]?.id ?? cc.account_id,
    };
  });

  const transactions: Transaction[] = source.transactions.map((tx) => {
    let nextParcelGroup = tx.grupo_parcelamento_id;
    if (nextParcelGroup) {
      if (!parcelGroupMap.has(nextParcelGroup)) {
        parcelGroupMap.set(nextParcelGroup, createCloudUniqueId('grp'));
      }
      nextParcelGroup = parcelGroupMap.get(nextParcelGroup)!;
    }

    return {
      ...tx,
      id: createCloudUniqueId('tx'),
      user_id: userId,
      account_id: tx.account_id ? accountIdMap.get(tx.account_id) ?? null : null,
      credit_card_id: tx.credit_card_id ? cardIdMap.get(tx.credit_card_id) ?? null : null,
      category_id: categoryIdMap.get(tx.category_id) ?? categories[0]?.id ?? '',
      grupo_parcelamento_id: nextParcelGroup,
    };
  });

  const budgets: Budget[] = source.budgets
    .map((bdg) => {
      const mappedCategory = categoryIdMap.get(bdg.category_id);
      if (!mappedCategory) return null;
      return {
        ...bdg,
        id: createCloudUniqueId('bdg'),
        user_id: userId,
        category_id: mappedCategory,
      };
    })
    .filter((b): b is Budget => b !== null);

  const financialGoals: FinancialGoal[] = source.financialGoals.map((goal) => ({
    ...goal,
    id: createCloudUniqueId('goal'),
    user_id: userId,
  }));

  return {
    accounts: recalculateAccountsBalance(accounts, transactions),
    creditCards,
    categories,
    transactions,
    budgets,
    financialGoals,
    userSettings: {
      ...source.userSettings,
      user_id: userId,
    },
  };
}

// ============================================================================
// AUTH / LOCKOUT RPCS NA NUVEM
// ============================================================================
export interface CloudLockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  remainingSeconds: number;
}

export async function cloudGetLockoutStatus(
  identifier: string
): Promise<CloudLockoutStatus | null> {
  if (!supabase || !identifier.trim()) return null;
  try {
    const { data, error } = await supabase.rpc('get_login_lockout_status', {
      p_identifier: identifier.trim().toLowerCase(),
    });
    if (error || !data) return null;
    const lockedUntil = (data.locked_until as string | null) ?? null;
    const lockMs = lockedUntil ? new Date(lockedUntil).getTime() : 0;
    const remainingSeconds =
      data.locked && lockMs > Date.now() ? Math.ceil((lockMs - Date.now()) / 1000) : 0;
    return {
      isLocked: Boolean(data.locked && remainingSeconds > 0),
      failedAttempts: Number(data.failed_attempts ?? 0),
      lockedUntil,
      remainingSeconds,
    };
  } catch {
    return null;
  }
}

export async function cloudRegisterLoginAttempt(
  identifier: string,
  success: boolean
): Promise<CloudLockoutStatus | null> {
  if (!supabase || !identifier.trim()) return null;
  try {
    const { data, error } = await supabase.rpc('register_login_attempt', {
      p_identifier: identifier.trim().toLowerCase(),
      p_success: success,
    });
    if (error || !data) return null;
    const lockedUntil = (data.locked_until as string | null) ?? null;
    const lockMs = lockedUntil ? new Date(lockedUntil).getTime() : 0;
    const remainingSeconds =
      data.locked && lockMs > Date.now() ? Math.ceil((lockMs - Date.now()) / 1000) : 0;
    return {
      isLocked: Boolean(data.locked && remainingSeconds > 0),
      failedAttempts: Number(data.failed_attempts ?? 0),
      lockedUntil,
      remainingSeconds,
    };
  } catch {
    return null;
  }
}

export async function cloudResolveLoginEmail(identifier: string): Promise<string | null> {
  if (!supabase || !identifier.trim()) return null;
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) return clean;

  const { data, error } = await supabase.rpc('resolve_login_email', {
    p_identifier: clean,
  });
  if (error) {
    console.warn('Falha ao resolver usuário para login:', error.message);
    return null;
  }
  return typeof data === 'string' && data.trim() ? data.trim().toLowerCase() : null;
}

export async function cloudCheckUsernameAvailable(username: string): Promise<boolean> {
  if (!supabase) return true;
  const clean = username.trim().toLowerCase();
  if (clean.length < 3) return false;
  const { data, error } = await supabase.rpc('check_username_available', {
    p_username: clean,
  });
  if (error) return true;
  return Boolean(data);
}

// ============================================================================
// CARREGAMENTO COMPLETO DO WORKSPACE DO USUÁRIO LOGADO
// ============================================================================
export interface CloudWorkspaceLoadResult {
  authUserAccount: AuthUserAccount;
  dbState: FinanceDatabaseState;
}

export async function loadCloudUserWorkspace(
  authUser: User,
  defaultCategoriesBuilder: (userId: string) => Category[]
): Promise<CloudWorkspaceLoadResult> {
  if (!supabase) {
    throw new Error('Cliente Supabase não configurado.');
  }

  const userId = authUser.id;
  const [accountsRes, cardsRes, categoriesRes, txRes, budgetsRes, goalsRes, settingsRes] =
    await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('credit_cards').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('categories').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('data_vencimento', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

  const queryErrors = [
    accountsRes.error,
    cardsRes.error,
    categoriesRes.error,
    txRes.error,
    budgetsRes.error,
    goalsRes.error,
    settingsRes.error,
  ].filter(Boolean);

  if (queryErrors.length > 0) {
    throw new Error(queryErrors[0]!.message);
  }

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const emailPrefix = (authUser.email ?? 'usuario').split('@')[0];
  const fallbackDisplayName =
    typeof meta.nome_exibicao === 'string' && meta.nome_exibicao.trim()
      ? meta.nome_exibicao.trim()
      : emailPrefix;
  const fallbackUsername =
    typeof meta.username === 'string' && meta.username.trim().length >= 3
      ? meta.username.trim().toLowerCase()
      : emailPrefix.toLowerCase().replace(/[^a-z0-9._-]/g, '');

  let settingsRow = settingsRes.data as Record<string, unknown> | null;
  if (!settingsRow) {
    const bootstrapSettings = {
      user_id: userId,
      username: fallbackUsername || `user_${userId.slice(0, 6)}`,
      nome_exibicao: fallbackDisplayName,
      avatar_url: '',
      moeda: 'BRL',
      meta_economia_mensal: 2000,
      cor_tema: 'purple-black',
      modo_tema: 'dark',
      ocultar_valores: false,
      usar_regra_50_30_20: false,
      pct_essencial: 50,
      pct_estilo_vida: 30,
      pct_futuro: 20,
      role: 'member',
    };
    const { data: insertedSettings } = await supabase
      .from('user_settings')
      .upsert(bootstrapSettings, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();
    settingsRow = (insertedSettings as Record<string, unknown> | null) ?? bootstrapSettings;
  }

  let categories = (categoriesRes.data ?? []).map((row) =>
    mapCategoryRow(row as Record<string, unknown>)
  );

  // Garante categorias iniciais caso o usuário tenha sido criado antes do trigger existir
  if (categories.length === 0) {
    const seededCategories = defaultCategoriesBuilder(userId).map((c) => ({
      ...c,
      id: createCloudUniqueId('cat'),
      user_id: userId,
    }));
    const { error: catSeedErr } = await supabase
      .from('categories')
      .insert(seededCategories.map(toCategoryRow));
    if (!catSeedErr) {
      categories = seededCategories;
    }
  }

  const rawAccounts = (accountsRes.data ?? []).map((row) =>
    mapAccountRow(row as Record<string, unknown>)
  );
  const transactions = (txRes.data ?? []).map((row) =>
    mapTransactionRow(row as Record<string, unknown>)
  );
  const accounts = recalculateAccountsBalance(rawAccounts, transactions);

  const userSettings: UserSettings = {
    user_id: userId,
    nome_exibicao: String(settingsRow.nome_exibicao ?? fallbackDisplayName),
    avatar_url: String(settingsRow.avatar_url ?? ''),
    moeda: String(settingsRow.moeda ?? 'BRL'),
    meta_economia_mensal: Number(settingsRow.meta_economia_mensal ?? 2000),
    cor_tema: normalizeThemeColor(settingsRow.cor_tema as string | undefined),
    modo_tema: settingsRow.modo_tema === 'light' ? 'light' : 'dark',
    ocultar_valores: Boolean(settingsRow.ocultar_valores ?? false),
    usar_regra_50_30_20: Boolean(settingsRow.usar_regra_50_30_20 ?? false),
    pct_essencial: Number(settingsRow.pct_essencial ?? 50),
    pct_estilo_vida: Number(settingsRow.pct_estilo_vida ?? 30),
    pct_futuro: Number(settingsRow.pct_futuro ?? 20),
  };

  const authUserAccount: AuthUserAccount = {
    id: userId,
    username: String(settingsRow.username ?? fallbackUsername),
    email: authUser.email ?? '',
    nome_exibicao: userSettings.nome_exibicao,
    role: settingsRow.role === 'admin' ? 'admin' : 'member',
    senha_hash: '[SUPABASE_AUTH]',
    ativo: true,
    criado_em: authUser.created_at ?? new Date().toISOString(),
    ultimo_acesso: authUser.last_sign_in_at ?? new Date().toISOString(),
  };

  return {
    authUserAccount,
    dbState: {
      accounts,
      creditCards: (cardsRes.data ?? []).map((row) =>
        mapCreditCardRow(row as Record<string, unknown>)
      ),
      categories,
      transactions,
      budgets: (budgetsRes.data ?? []).map((row) =>
        mapBudgetRow(row as Record<string, unknown>)
      ),
      financialGoals: (goalsRes.data ?? []).map((row) =>
        mapGoalRow(row as Record<string, unknown>)
      ),
      userSettings,
    },
  };
}

// ============================================================================
// OPERAÇÕES DE PERSISTÊNCIA INDIVIDUAL (CRUD NA NUVEM SUPABASE)
// ============================================================================
export async function cloudUpsertUserSettings(
  userId: string,
  partial: Partial<UserSettings>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_settings')
    .update(toUserSettingsPatch(partial))
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudUpsertAccounts(accounts: Account[]): Promise<void> {
  if (!supabase || accounts.length === 0) return;
  const { error } = await supabase
    .from('accounts')
    .upsert(accounts.map(toAccountRow), { onConflict: 'id' });
  if (error) throw error;
}

export async function cloudDeleteAccount(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudUpsertCreditCard(card: CreditCard): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('credit_cards')
    .upsert(toCreditCardRow(card), { onConflict: 'id' });
  if (error) throw error;
}

export async function cloudDeleteCreditCard(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('credit_cards')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudUpsertCategory(cat: Category): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('categories')
    .upsert(toCategoryRow(cat), { onConflict: 'id' });
  if (error) throw error;
}

export async function cloudDeleteCategory(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudUpsertTransactions(transactions: Transaction[]): Promise<void> {
  if (!supabase || transactions.length === 0) return;
  const { error } = await supabase
    .from('transactions')
    .upsert(transactions.map(toTransactionRow), { onConflict: 'id' });
  if (error) throw error;
}

export async function cloudDeleteTransactions(userId: string, ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudUpsertBudget(budget: Budget): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('budgets')
    .upsert(toBudgetRow(budget), { onConflict: 'user_id,category_id,mes_ano' });
  if (error) throw error;
}

export async function cloudDeleteBudget(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudUpsertGoal(goal: FinancialGoal): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('financial_goals')
    .upsert(toGoalRow(goal), { onConflict: 'id' });
  if (error) throw error;
}

export async function cloudDeleteGoal(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('financial_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function cloudReplaceFullWorkspace(
  userId: string,
  state: FinanceDatabaseState
): Promise<void> {
  if (!supabase) return;

  // Remove em ordem segura para FKs antes de re-popular
  const delSteps = await Promise.all([
    supabase.from('transactions').delete().eq('user_id', userId),
    supabase.from('budgets').delete().eq('user_id', userId),
  ]);
  for (const res of delSteps) {
    if (res.error) throw res.error;
  }

  const { error: delCardsErr } = await supabase
    .from('credit_cards')
    .delete()
    .eq('user_id', userId);
  if (delCardsErr) throw delCardsErr;

  const delRest = await Promise.all([
    supabase.from('accounts').delete().eq('user_id', userId),
    supabase.from('financial_goals').delete().eq('user_id', userId),
    supabase.from('categories').delete().eq('user_id', userId),
  ]);
  for (const res of delRest) {
    if (res.error) throw res.error;
  }

  if (state.categories.length > 0) {
    const { error } = await supabase
      .from('categories')
      .insert(state.categories.map(toCategoryRow));
    if (error) throw error;
  }

  if (state.accounts.length > 0) {
    const { error } = await supabase
      .from('accounts')
      .insert(state.accounts.map(toAccountRow));
    if (error) throw error;
  }

  if (state.creditCards.length > 0) {
    const { error } = await supabase
      .from('credit_cards')
      .insert(state.creditCards.map(toCreditCardRow));
    if (error) throw error;
  }

  if (state.transactions.length > 0) {
    const { error } = await supabase
      .from('transactions')
      .insert(state.transactions.map(toTransactionRow));
    if (error) throw error;
  }

  if (state.budgets.length > 0) {
    const { error } = await supabase
      .from('budgets')
      .insert(state.budgets.map(toBudgetRow));
    if (error) throw error;
  }

  if (state.financialGoals.length > 0) {
    const { error } = await supabase
      .from('financial_goals')
      .insert(state.financialGoals.map(toGoalRow));
    if (error) throw error;
  }

  await cloudUpsertUserSettings(userId, state.userSettings);
}
