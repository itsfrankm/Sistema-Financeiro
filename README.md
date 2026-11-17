# Gestor Financeiro

Aplicação web responsiva (PWA) para planejamento e controle financeiro pessoal multiusuário, com autenticação segura e persistência em nuvem por usuário via **Supabase (Auth + PostgreSQL)**, pronta para deploy na **Vercel**.

---

## Funcionalidades

- **Autenticação Multiusuário & Segurança**:
  - Login por **nome de usuário ou e-mail** e cadastro direto pela tela inicial (**Criar Conta**).
  - Isolamento de dados por usuário no PostgreSQL via **Row Level Security (RLS)** (`user_id = auth.uid()`).
  - Proteção contra força bruta com bloqueio automático de **15 minutos após 5 tentativas incorretas**.
  - Atualização segura de credenciais (usuário, e-mail, nome e senha) pelo próprio titular.
- **Visão Geral (Dashboard)**:
  - Resumo de **Saldo Atual**, **Receitas**, **Despesas**, **Saldo Projetado** e gráficos interativos com Recharts.
  - Modo Privacidade global para ocultar valores na tela.
- **Contas & Cartões de Crédito**:
  - Cadastro de contas correntes, poupança, dinheiro físico e investimentos, com ajuste rápido de saldo e transferências entre contas.
  - Controle de cartões de crédito com limite, fechamento de fatura (lançamentos após o fechamento vão para a fatura seguinte) e baixa/pagamento de faturas.
- **Lançamentos Inteligentes**:
  - Receitas, despesas e transferências com natureza **variável**, **fixa mensal** (projeção automática de 12 meses) ou **parcelada** em múltiplas parcelas.
- **Planejamento, Orçamentos & Metas**:
  - Definição de tetos mensais por categoria e metas financeiras com registro de aportes.
- **Relatórios Executivos em PDF & Backup**:
  - Visualizações **Diária**, **Semanal** (semanas do mês), **Mensal** e **Anual**, com exportação **PDF**.
  - Exportação e importação completa de dados via arquivo **JSON**.
- **Personalização & Temas**:
  - 5 paletas de cores (*Verde Claro*, *Roxo*, *Azul Escuro*, *Âmbar* e *Preto e Branco*), suporte a **Modo Escuro / Claro**, foto/logo de perfil e seleção de moeda (`BRL`, `USD`, `EUR`).

---

## Tecnologias Utilizadas

- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Estilização & Ícones**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Gráficos & Relatórios**: [Recharts](https://recharts.org/), [jsPDF](https://github.com/parallax/jsPDF), [html2canvas-pro](https://github.com/nicholasgillespie/html2canvas-pro)
- **Validação**: [Zod](https://zod.dev/)
- **Backend / BaaS**: [Supabase](https://supabase.com/) (`@supabase/supabase-js` — Auth, PostgreSQL, RLS e RPCs)
- **Hospedagem**: [Vercel](https://vercel.com/) (com suporte a SPA via `vercel.json`)

---

## Estrutura do Projeto

```text
├── public/
│   ├── icon.svg
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── auth/            # Tela de Login, Cadastro e gerenciamento de credenciais
│   │   ├── dashboard/       # Visão Geral e indicadores financeiros
│   │   ├── layout/          # AppShell (Sidebar, navegação mobile e atalhos)
│   │   ├── planning/        # Orçamentos, categorias, metas e Regra 50-30-20
│   │   ├── reports/         # Relatórios diário, semanal, mensal e anual
│   │   ├── settings/        # Temas, perfil, sincronização Supabase e backup JSON
│   │   ├── transactions/    # Extrato e modal de lançamentos
│   │   └── wallets/         # Contas bancárias, carteiras e cartões de crédito
│   ├── context/             # FinanceContext (estado global e integração Auth/CRUD)
│   ├── lib/                 # Cliente Supabase e camada de persistência em nuvem
│   ├── types/               # Tipagens e schemas Zod
│   └── utils/               # Gerador de relatórios executivos PDF A4
├── supabase/
│   └── schema.sql           # Script SQL completo (tabelas, RLS, triggers e RPCs)
├── .env.example             # Modelo de variáveis de ambiente
└── vercel.json              # Configuração de rewrite SPA na Vercel
```

---

## Como Rodar Localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o banco no Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Abra o **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute (**Run**).
3. Em **Project Settings → API** (ou **API Keys**), copie a **Project URL** e a **Publishable key** (`sb_publishable_...` / `anon public`).

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto e preencha suas chaves:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_publishable_ou_anon_key
```

> Caso `.env` fique sem chaves, o sistema opera automaticamente em **Modo Local** com dados armazenados no navegador (`localStorage`).

### 4. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

### 5. Gerar build de produção

```bash
npm run build
```

---

## Deploy na Vercel

1. Importe este repositório na **Vercel** com o preset **Vite** (`npm run build` / diretório `dist`).
2. Em **Settings → Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Após o deploy, acesse no Supabase **Authentication → URL Configuration** e adicione o domínio gerado pela Vercel em **Site URL** e **Redirect URLs**.
