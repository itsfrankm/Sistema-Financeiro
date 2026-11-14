-- ============================================================================
-- GESTOR FINANCEIRO — SCRIPT SQL MULTI-TENANT COMPLETO (SUPABASE / POSTGRESQL)
-- Isolamento 100% Multi-Tenant via Row Level Security (user_id = auth.uid())
-- Autenticação por Usuário ou E-mail + Proteção contra Força Bruta (5 falhas / 15 min)
-- ============================================================================

-- Habilita extensões necessárias (no Supabase, pgcrypto geralmente fica no schema extensions)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELA: accounts (Contas Bancárias, Carteiras e Investimentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY DEFAULT ('acc_' || substr(gen_random_uuid()::text, 1, 8)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(trim(nome)) >= 2),
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'dinheiro_fisico', 'investimento')),
  saldo_inicial NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  saldo_atual NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  cor TEXT NOT NULL DEFAULT '#8b5cf6',
  incluir_na_soma_geral BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- ============================================================================
-- 2. TABELA: credit_cards (Cartões de Crédito vinculados a Contas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id TEXT PRIMARY KEY DEFAULT ('cc_' || substr(gen_random_uuid()::text, 1, 8)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  nome_cartao TEXT NOT NULL CHECK (char_length(trim(nome_cartao)) >= 2),
  limite_total NUMERIC(14, 2) NOT NULL CHECK (limite_total > 0),
  dia_fechamento SMALLINT NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  cor TEXT NOT NULL DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_account_id ON public.credit_cards(account_id);

-- ============================================================================
-- 3. TABELA: categories (Categorias Personalizadas & Meta Percentual)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY DEFAULT ('cat_' || substr(gen_random_uuid()::text, 1, 8)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(trim(nome)) >= 2),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  icone TEXT NOT NULL DEFAULT 'Tag',
  cor TEXT NOT NULL DEFAULT '#8b5cf6',
  regra_50_30_20 TEXT CHECK (regra_50_30_20 IS NULL OR regra_50_30_20 IN ('essencial_50', 'estilo_vida_30', 'futuro_20')),
  percentual_meta NUMERIC(5, 2) CHECK (percentual_meta IS NULL OR (percentual_meta >= 0 AND percentual_meta <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração idempotente caso a tabela já exista de versão anterior
ALTER TABLE public.categories ALTER COLUMN regra_50_30_20 DROP NOT NULL;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_regra_50_30_20_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_regra_50_30_20_check
  CHECK (regra_50_30_20 IS NULL OR regra_50_30_20 IN ('essencial_50', 'estilo_vida_30', 'futuro_20'));
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS percentual_meta NUMERIC(5, 2);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- ============================================================================
-- 4. TABELA: transactions (Lançamentos: Receitas, Despesas, Parcelados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY DEFAULT ('tx_' || substr(gen_random_uuid()::text, 1, 8)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
  credit_card_id TEXT REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL CHECK (char_length(trim(descricao)) >= 2),
  valor NUMERIC(14, 2) NOT NULL CHECK (valor > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia')),
  natureza TEXT NOT NULL CHECK (natureza IN ('fixa', 'variavel', 'parcelada')),
  parcela_atual SMALLINT CHECK (parcela_atual IS NULL OR parcela_atual >= 1),
  total_parcelas SMALLINT CHECK (total_parcelas IS NULL OR total_parcelas >= 1),
  grupo_parcelamento_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente')),
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração idempotente caso transactions.category_id estivesse com ON DELETE RESTRICT
ALTER TABLE public.transactions ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vencimento ON public.transactions(user_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_transactions_grupo_parcela ON public.transactions(grupo_parcelamento_id);

-- ============================================================================
-- 5. TABELA: budgets (Teto de Gastos Mensal por Categoria)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id TEXT PRIMARY KEY DEFAULT ('bdg_' || substr(gen_random_uuid()::text, 1, 8)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  mes_ano TEXT NOT NULL CHECK (mes_ano ~ '^\d{4}-\d{2}$'),
  valor_teto_planejado NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (valor_teto_planejado >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, mes_ano)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_mes ON public.budgets(user_id, mes_ano);

-- ============================================================================
-- 6. TABELA: financial_goals (Metas Financeiras e Cofres)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id TEXT PRIMARY KEY DEFAULT ('goal_' || substr(gen_random_uuid()::text, 1, 8)),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL CHECK (char_length(trim(titulo)) >= 2),
  valor_meta NUMERIC(14, 2) NOT NULL CHECK (valor_meta > 0),
  valor_acumulado NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (valor_acumulado >= 0),
  data_alvo DATE NOT NULL,
  cor TEXT NOT NULL DEFAULT '#8b5cf6',
  icone TEXT NOT NULL DEFAULT 'Target',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON public.financial_goals(user_id);

-- ============================================================================
-- 7. TABELA: user_settings (Preferências, Tema, Moeda, Login e Privacidade)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  nome_exibicao TEXT NOT NULL DEFAULT 'Usuário Finances Pro',
  avatar_url TEXT NOT NULL DEFAULT '',
  moeda TEXT NOT NULL DEFAULT 'BRL',
  meta_economia_mensal NUMERIC(14, 2) NOT NULL DEFAULT 1000.00 CHECK (meta_economia_mensal >= 0),
  cor_tema TEXT NOT NULL DEFAULT 'purple-black'
    CHECK (cor_tema IN ('light-green', 'purple-black', 'deep-blue', 'amber-purple', 'monochrome')),
  modo_tema TEXT NOT NULL DEFAULT 'dark' CHECK (modo_tema IN ('dark', 'light')),
  ocultar_valores BOOLEAN NOT NULL DEFAULT FALSE,
  usar_regra_50_30_20 BOOLEAN NOT NULL DEFAULT FALSE,
  pct_essencial SMALLINT NOT NULL DEFAULT 50 CHECK (pct_essencial BETWEEN 0 AND 100),
  pct_estilo_vida SMALLINT NOT NULL DEFAULT 30 CHECK (pct_estilo_vida BETWEEN 0 AND 100),
  pct_futuro SMALLINT NOT NULL DEFAULT 20 CHECK (pct_futuro BETWEEN 0 AND 100),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração idempotente para bases criadas anteriormente
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_cor_tema_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_cor_tema_check
  CHECK (cor_tema IN ('light-green', 'purple-black', 'deep-blue', 'amber-purple', 'monochrome'));
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS usar_regra_50_30_20 BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS pct_essencial SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS pct_estilo_vida SMALLINT NOT NULL DEFAULT 30;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS pct_futuro SMALLINT NOT NULL DEFAULT 20;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_username_lower
  ON public.user_settings (lower(username))
  WHERE username IS NOT NULL AND username <> '';

-- ============================================================================
-- 8. TABELA: login_attempts (Controle de Tentativas e Proteção Força Bruta)
-- Bloqueio automático de 15 minutos após 5 tentativas incorretas consecutivas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL UNIQUE, -- email ou username normalizado em lowercase
  failed_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON public.login_attempts(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — ISOLAMENTO 100% MULTI-TENANT (user_id = auth.uid())
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para accounts
DROP POLICY IF EXISTS "accounts_multi_tenant_isolation" ON public.accounts;
CREATE POLICY "accounts_multi_tenant_isolation"
  ON public.accounts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Políticas para credit_cards
DROP POLICY IF EXISTS "credit_cards_multi_tenant_isolation" ON public.credit_cards;
CREATE POLICY "credit_cards_multi_tenant_isolation"
  ON public.credit_cards
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Políticas para categories
DROP POLICY IF EXISTS "categories_multi_tenant_isolation" ON public.categories;
CREATE POLICY "categories_multi_tenant_isolation"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Políticas para transactions
DROP POLICY IF EXISTS "transactions_multi_tenant_isolation" ON public.transactions;
CREATE POLICY "transactions_multi_tenant_isolation"
  ON public.transactions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Políticas para budgets
DROP POLICY IF EXISTS "budgets_multi_tenant_isolation" ON public.budgets;
CREATE POLICY "budgets_multi_tenant_isolation"
  ON public.budgets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Políticas para financial_goals
DROP POLICY IF EXISTS "financial_goals_multi_tenant_isolation" ON public.financial_goals;
CREATE POLICY "financial_goals_multi_tenant_isolation"
  ON public.financial_goals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. Políticas para user_settings
DROP POLICY IF EXISTS "user_settings_multi_tenant_isolation" ON public.user_settings;
CREATE POLICY "user_settings_multi_tenant_isolation"
  ON public.user_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 8. Políticas para login_attempts
DROP POLICY IF EXISTS "login_attempts_multi_tenant_isolation" ON public.login_attempts;
CREATE POLICY "login_attempts_multi_tenant_isolation"
  ON public.login_attempts
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = auth.uid() AND us.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = auth.uid() AND us.role = 'admin'
    )
  );

-- ============================================================================
-- FUNÇÕES RPC DE AUTENTICAÇÃO E SEGURANÇA
-- ============================================================================

-- Resolve username -> e-mail antes do signInWithPassword (permite login por usuário OU e-mail)
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_identifier, '')));
  v_email TEXT;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' IN v_clean) > 0 THEN
    RETURN v_clean;
  END IF;

  SELECT u.email INTO v_email
  FROM public.user_settings us
  JOIN auth.users u ON u.id = us.user_id
  WHERE lower(us.username) = v_clean
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

-- Verifica se um username está disponível no cadastro ou edição
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_username, '')));
BEGIN
  IF char_length(v_clean) < 3 THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.user_settings us
    WHERE lower(us.username) = v_clean
      AND (auth.uid() IS NULL OR us.user_id <> auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;

-- Consulta o estado de bloqueio pré-login sem expor a tabela login_attempts diretamente
CREATE OR REPLACE FUNCTION public.get_login_lockout_status(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_identifier, '')));
  v_record public.login_attempts%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('locked', false, 'failed_attempts', 0, 'locked_until', NULL);
  END IF;

  SELECT * INTO v_record
  FROM public.login_attempts
  WHERE identifier = v_clean;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false, 'failed_attempts', 0, 'locked_until', NULL);
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'locked', true,
      'failed_attempts', v_record.failed_attempts,
      'locked_until', v_record.locked_until
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'failed_attempts', CASE WHEN v_record.locked_until IS NOT NULL THEN 0 ELSE v_record.failed_attempts END,
    'locked_until', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_login_lockout_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_lockout_status(TEXT) TO anon, authenticated;

-- Registra tentativa de login (bloqueia 15 min após 5 falhas consecutivas)
CREATE OR REPLACE FUNCTION public.register_login_attempt(
  p_identifier TEXT,
  p_success BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_identifier, '')));
  v_record public.login_attempts%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_new_attempts SMALLINT;
  v_locked_until TIMESTAMPTZ;
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('locked', false, 'failed_attempts', 0, 'locked_until', NULL);
  END IF;

  SELECT * INTO v_record
  FROM public.login_attempts
  WHERE identifier = v_clean;

  IF FOUND AND v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'locked', true,
      'failed_attempts', v_record.failed_attempts,
      'locked_until', v_record.locked_until
    );
  END IF;

  IF p_success THEN
    INSERT INTO public.login_attempts (identifier, failed_attempts, locked_until, last_attempt_at, updated_at)
    VALUES (v_clean, 0, NULL, v_now, v_now)
    ON CONFLICT (identifier) DO UPDATE
      SET failed_attempts = 0,
          locked_until = NULL,
          last_attempt_at = v_now,
          updated_at = v_now;

    RETURN jsonb_build_object(
      'locked', false,
      'failed_attempts', 0,
      'locked_until', NULL
    );
  ELSE
    v_new_attempts := COALESCE(
      CASE
        WHEN v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN 0
        ELSE v_record.failed_attempts
      END,
      0
    ) + 1;

    IF v_new_attempts >= 5 THEN
      v_locked_until := v_now + INTERVAL '15 minutes';
    ELSE
      v_locked_until := NULL;
    END IF;

    INSERT INTO public.login_attempts (identifier, failed_attempts, locked_until, last_attempt_at, updated_at)
    VALUES (v_clean, v_new_attempts, v_locked_until, v_now, v_now)
    ON CONFLICT (identifier) DO UPDATE
      SET failed_attempts = v_new_attempts,
          locked_until = v_locked_until,
          last_attempt_at = v_now,
          updated_at = v_now;

    RETURN jsonb_build_object(
      'locked', v_locked_until IS NOT NULL,
      'failed_attempts', v_new_attempts,
      'locked_until', v_locked_until
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_login_attempt(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_login_attempt(TEXT, BOOLEAN) TO anon, authenticated;

-- Verifica senha atual do usuário autenticado antes de alterações sensíveis
CREATE OR REPLACE FUNCTION public.verify_my_password(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_encrypted_pw TEXT;
BEGIN
  IF v_user_id IS NULL OR p_password IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT encrypted_password INTO v_encrypted_pw
  FROM auth.users
  WHERE id = v_user_id;

  RETURN v_encrypted_pw IS NOT NULL AND v_encrypted_pw = crypt(p_password, v_encrypted_pw);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_my_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_my_password(TEXT) TO authenticated;

-- ============================================================================
-- TRIGGER AUTOMÁTICA: PROVISIONA USER_SETTINGS E CATEGORIAS NO NOVO USUÁRIO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_finance_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_username TEXT := NULLIF(lower(regexp_replace(trim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '[^a-z0-9._-]', '', 'g')), '');
  v_final_username TEXT;
  v_display_name TEXT;
BEGIN
  IF v_raw_username IS NULL OR char_length(v_raw_username) < 3 THEN
    v_final_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  ELSIF EXISTS (SELECT 1 FROM public.user_settings WHERE lower(username) = v_raw_username) THEN
    v_final_username := v_raw_username || '_' || substr(replace(NEW.id::text, '-', ''), 1, 4);
  ELSE
    v_final_username := v_raw_username;
  END IF;

  v_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nome_exibicao'), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'Usuário Finances Pro'
  );

  INSERT INTO public.user_settings (
    user_id,
    username,
    nome_exibicao,
    moeda,
    meta_economia_mensal,
    cor_tema,
    modo_tema,
    ocultar_valores,
    usar_regra_50_30_20,
    pct_essencial,
    pct_estilo_vida,
    pct_futuro
  )
  VALUES (
    NEW.id,
    v_final_username,
    v_display_name,
    'BRL',
    2000.00,
    'purple-black',
    'dark',
    FALSE,
    FALSE,
    50,
    30,
    20
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Categorias iniciais para o novo usuário
  INSERT INTO public.categories (user_id, nome, tipo, icone, cor, regra_50_30_20)
  VALUES
    (NEW.id, 'Salário & Pró-labore', 'receita', 'Briefcase', '#10b981', 'futuro_20'),
    (NEW.id, 'Projetos & Freelance', 'receita', 'Laptop', '#34d399', 'futuro_20'),
    (NEW.id, 'Moradia & Condomínio', 'despesa', 'Home', '#8b5cf6', 'essencial_50'),
    (NEW.id, 'Supermercado & Feira', 'despesa', 'ShoppingCart', '#6366f1', 'essencial_50'),
    (NEW.id, 'Transporte & Combustível', 'despesa', 'Car', '#3b82f6', 'essencial_50'),
    (NEW.id, 'Saúde & Farmácia', 'despesa', 'HeartPulse', '#ec4899', 'essencial_50'),
    (NEW.id, 'Restaurantes & Delivery', 'despesa', 'Utensils', '#f59e0b', 'estilo_vida_30'),
    (NEW.id, 'Lazer & Assinaturas', 'despesa', 'Tv', '#a855f7', 'estilo_vida_30'),
    (NEW.id, 'Aportes & Investimentos', 'despesa', 'PiggyBank', '#10b981', 'futuro_20'),
    (NEW.id, 'Educação & Cursos', 'despesa', 'GraduationCap', '#14b8a6', 'futuro_20');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_finance ON auth.users;
CREATE TRIGGER on_auth_user_created_finance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_finance_setup();

-- ============================================================================
-- FUNÇÃO RPC: ALTERAÇÃO SEGURA DE CREDENCIAIS PELO PRÓPRIO USUÁRIO LOGADO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_my_credentials(
  p_current_password TEXT,
  p_new_username TEXT DEFAULT NULL,
  p_new_email TEXT DEFAULT NULL,
  p_new_password TEXT DEFAULT NULL,
  p_new_display_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_encrypted_pw TEXT;
  v_clean_username TEXT := NULLIF(lower(trim(COALESCE(p_new_username, ''))), '');
  v_clean_email TEXT := NULLIF(lower(trim(COALESCE(p_new_email, ''))), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão não autenticada.');
  END IF;

  SELECT encrypted_password INTO v_encrypted_pw
  FROM auth.users
  WHERE id = v_user_id;

  IF v_encrypted_pw IS NULL OR v_encrypted_pw != crypt(p_current_password, v_encrypted_pw) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A senha atual informada está incorreta.');
  END IF;

  IF v_clean_username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE lower(username) = v_clean_username AND user_id <> v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este nome de usuário já está em uso por outra conta.');
  END IF;

  IF v_clean_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = v_clean_email AND id <> v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este e-mail já está em uso por outra conta.');
  END IF;

  UPDATE auth.users
  SET
    email = COALESCE(v_clean_email, email),
    encrypted_password = CASE
      WHEN p_new_password IS NOT NULL AND char_length(p_new_password) >= 6
        THEN crypt(p_new_password, gen_salt('bf'))
      ELSE encrypted_password
    END,
    updated_at = NOW()
  WHERE id = v_user_id;

  UPDATE public.user_settings
  SET
    username = COALESCE(v_clean_username, username),
    nome_exibicao = COALESCE(NULLIF(trim(p_new_display_name), ''), nome_exibicao),
    updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_credentials(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_credentials(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
