import { z } from 'zod';

// ==========================================
// ENUMS E TIPOS AUXILIARES
// ==========================================

export type AccountType = 'corrente' | 'poupanca' | 'dinheiro_fisico' | 'investimento';

export type CategoryType = 'receita' | 'despesa';

export type Rule503020 = 'essencial_50' | 'estilo_vida_30' | 'futuro_20';

export type TransactionType = 'receita' | 'despesa' | 'transferencia';

export type TransactionNature = 'fixa' | 'variavel' | 'parcelada';

export type TransactionStatus = 'pago' | 'pendente';

export type ThemeColor =
  | 'light-green'
  | 'purple-black'
  | 'deep-blue'
  | 'amber-purple'
  | 'monochrome';

export type ThemeMode = 'dark' | 'light';

export type AppTab =
  | 'dashboard'
  | 'transacoes'
  | 'contas_cartoes'
  | 'orcamentos'
  | 'metas'
  | 'relatorios'
  | 'configuracoes'
  | 'gerenciar_acessos';

export type UserRole = 'admin' | 'member';

export interface AuthUserAccount {
  id: string;
  username: string;
  email: string;
  nome_exibicao: string;
  role: UserRole;
  senha_hash: string; // Senha de acesso local / híbrida
  ativo: boolean;
  criado_em: string;
  ultimo_acesso: string | null;
}

export interface LoginAttemptRecord {
  identifier: string;
  failed_attempts: number;
  locked_until: string | null; // ISO timestamp quando bloqueado por 15 min
  last_attempt_at: string;
}

// ==========================================
// 1. ACCOUNT (Contas Bancárias / Carteiras)
// ==========================================
export interface Account {
  id: string;
  user_id: string;
  nome: string;
  tipo: AccountType;
  saldo_inicial: number;
  saldo_atual: number;
  cor: string;
  incluir_na_soma_geral: boolean;
}

export const AccountSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  nome: z.string().min(2, 'O nome da conta deve ter pelo menos 2 caracteres'),
  tipo: z.enum(['corrente', 'poupanca', 'dinheiro_fisico', 'investimento']),
  saldo_inicial: z.number(),
  saldo_atual: z.number(),
  cor: z.string().min(4),
  incluir_na_soma_geral: z.boolean(),
});

// ==========================================
// 2. CREDIT CARD (Cartões de Crédito)
// ==========================================
export interface CreditCard {
  id: string;
  user_id: string;
  account_id: string;
  nome_cartao: string;
  limite_total: number;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string;
}

export const CreditCardSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  account_id: z.string().min(1, 'Selecione uma conta vinculada'),
  nome_cartao: z.string().min(2, 'Informe o nome do cartão'),
  limite_total: z.number().positive('O limite total deve ser maior que zero'),
  dia_fechamento: z.number().int().min(1).max(31),
  dia_vencimento: z.number().int().min(1).max(31),
  cor: z.string().min(4),
});

// ==========================================
// 3. CATEGORY (Categorias & Porcentagem Opcional)
// ==========================================
export interface Category {
  id: string;
  user_id: string;
  nome: string;
  tipo: CategoryType;
  icone: string;
  cor: string;
  regra_50_30_20?: Rule503020 | null;
  percentual_meta?: number | null; // % opcional da receita definida para esta categoria
}

export const CategorySchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  nome: z.string().min(2, 'O nome da categoria deve ter pelo menos 2 caracteres'),
  tipo: z.enum(['receita', 'despesa']),
  icone: z.string().min(1),
  cor: z.string().min(4),
  regra_50_30_20: z.enum(['essencial_50', 'estilo_vida_30', 'futuro_20']).nullable().optional(),
  percentual_meta: z.number().min(0).max(100).nullable().optional(),
});

// ==========================================
// 4. TRANSACTION (Lançamentos Financeiros)
// ==========================================
export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  credit_card_id: string | null;
  category_id: string;
  descricao: string;
  valor: number;
  tipo: TransactionType;
  natureza: TransactionNature;
  parcela_atual: number | null;
  total_parcelas: number | null;
  grupo_parcelamento_id: string | null;
  status: TransactionStatus;
  data_vencimento: string; // ISO YYYY-MM-DD
  data_pagamento: string | null; // ISO YYYY-MM-DD | null
}

export const TransactionSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  account_id: z.string().nullable(),
  credit_card_id: z.string().nullable(),
  category_id: z.string().min(1, 'Selecione uma categoria'),
  descricao: z.string().min(2, 'Informe uma descrição válida'),
  valor: z.number().positive('O valor deve ser maior que zero'),
  tipo: z.enum(['receita', 'despesa', 'transferencia']),
  natureza: z.enum(['fixa', 'variavel', 'parcelada']),
  parcela_atual: z.number().int().positive().nullable(),
  total_parcelas: z.number().int().positive().nullable(),
  grupo_parcelamento_id: z.string().nullable(),
  status: z.enum(['pago', 'pendente']),
  data_vencimento: z.string().min(10, 'Data de vencimento obrigatória'),
  data_pagamento: z.string().nullable(),
});

// ==========================================
// 5. BUDGET (Orçamentos Mensais por Categoria)
// ==========================================
export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  mes_ano: string; // Formato 'YYYY-MM'
  valor_teto_planejado: number;
}

export const BudgetSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  category_id: z.string().min(1),
  mes_ano: z.string().regex(/^\d{4}-\d{2}$/, 'Formato inválido (esperado YYYY-MM)'),
  valor_teto_planejado: z.number().nonnegative('O valor planejado não pode ser negativo'),
});

// ==========================================
// 6. FINANCIAL GOAL (Metas e Cofres)
// ==========================================
export interface FinancialGoal {
  id: string;
  user_id: string;
  titulo: string;
  valor_meta: number;
  valor_acumulado: number;
  data_alvo: string; // ISO YYYY-MM-DD
  cor: string;
  icone: string;
}

export const FinancialGoalSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  titulo: z.string().min(2, 'O título da meta deve ter pelo menos 2 caracteres'),
  valor_meta: z.number().positive('O valor da meta deve ser maior que zero'),
  valor_acumulado: z.number().nonnegative('O valor acumulado não pode ser negativo'),
  data_alvo: z.string().min(10, 'Informe uma data-alvo válida'),
  cor: z.string().min(4),
  icone: z.string().min(1),
});

// ==========================================
// 7. USER SETTINGS (Preferências e Tema)
// ==========================================
export interface UserSettings {
  user_id: string;
  nome_exibicao: string;
  avatar_url: string;
  moeda: string;
  meta_economia_mensal: number;
  cor_tema: ThemeColor;
  modo_tema: ThemeMode;
  ocultar_valores: boolean;
  usar_regra_50_30_20?: boolean;
  pct_essencial?: number;
  pct_estilo_vida?: number;
  pct_futuro?: number;
}

export const UserSettingsSchema = z.object({
  user_id: z.string().min(1),
  nome_exibicao: z.string().min(2, 'O nome de exibição deve ter pelo menos 2 caracteres'),
  avatar_url: z.string(),
  moeda: z.string().default('BRL'),
  meta_economia_mensal: z.number().nonnegative(),
  cor_tema: z.enum(['light-green', 'purple-black', 'deep-blue', 'amber-purple', 'monochrome']),
  modo_tema: z.enum(['dark', 'light']),
  ocultar_valores: z.boolean(),
  usar_regra_50_30_20: z.boolean().optional(),
  pct_essencial: z.number().min(0).max(100).optional(),
  pct_estilo_vida: z.number().min(0).max(100).optional(),
  pct_futuro: z.number().min(0).max(100).optional(),
});

// ==========================================
// ESTADO GLOBAL COMPLETO DO SISTEMA
// ==========================================
export interface FinanceDatabaseState {
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  financialGoals: FinancialGoal[];
  userSettings: UserSettings;
}

