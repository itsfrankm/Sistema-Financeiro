import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Check,
  Clock,
  Edit3,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Building2,
  Banknote,
  CreditCard as CreditCardIcon,
  Layers,
  Repeat,
  Shuffle,
  Briefcase,
  Laptop,
  TrendingUp,
  Home,
  ShoppingCart,
  Car,
  HeartPulse,
  Zap,
  Utensils,
  Compass,
  Tv,
  ShoppingBag,
  PiggyBank,
  GraduationCap,
  Tag,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../types/finance';
import { formatCurrency, formatMonthYearDisplay } from '../../lib/utils';

// Mapa de ícones Lucide para renderizar o ícone dinâmico de cada categoria
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Briefcase,
  Laptop,
  TrendingUp,
  Home,
  ShoppingCart,
  Car,
  HeartPulse,
  Zap,
  Utensils,
  Compass,
  Tv,
  ShoppingBag,
  PiggyBank,
  GraduationCap,
  Tag,
};

function formatDatePtBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    accounts,
    creditCards,
    categories,
    selectedMonth,
    userSettings,
    toggleTransactionStatus,
    deleteTransaction,
    setIsQuickTransactionOpen,
    setEditingTransaction,
  } = useFinance();

  const hide = userSettings.ocultar_valores;
  const currency = userSettings.moeda;

  // Estados dos Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receita' | 'despesa' | 'transferencia'>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'pendente'>('all');
  const [originFilter, setOriginFilter] = useState<string>('all'); // 'all' | 'acc:...' | 'cc:...'
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Confirmação de exclusão de grupo parcelado/recorrente
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const cardMap = useMemo(
    () => new Map(creditCards.map((cc) => [cc.id, cc])),
    [creditCards]
  );

  // Filtra as transações do mês selecionado + filtros combinados
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions
      .filter((tx) => tx.data_vencimento.startsWith(selectedMonth))
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.tipo !== typeFilter) return false;
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && tx.category_id !== categoryFilter) return false;

        if (originFilter !== 'all') {
          if (originFilter.startsWith('acc:')) {
            const accId = originFilter.replace('acc:', '');
            if (tx.account_id !== accId) return false;
          } else if (originFilter.startsWith('cc:')) {
            const ccId = originFilter.replace('cc:', '');
            if (tx.credit_card_id !== ccId) return false;
          }
        }

        if (query) {
          const catName = categoryMap.get(tx.category_id)?.nome.toLowerCase() || '';
          const matchDesc = tx.descricao.toLowerCase().includes(query);
          const matchCat = catName.includes(query);
          if (!matchDesc && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
  }, [
    transactions,
    selectedMonth,
    typeFilter,
    statusFilter,
    categoryFilter,
    originFilter,
    searchQuery,
    categoryMap,
  ]);

  // Agrupamento por data para o Mobile (< 768px)
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();

    filteredTransactions.forEach((tx) => {
      const list = map.get(tx.data_vencimento) || [];
      list.push(tx);
      map.set(tx.data_vencimento, list);
    });

    map.forEach((items, date) => {
      groups.push({ date, items });
    });

    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredTransactions]);

  // KPIs do Extrato Filtrado
  const summary = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let pendentes = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.tipo === 'receita') entradas += tx.valor;
      if (tx.tipo === 'despesa') saidas += tx.valor;
      if (tx.status === 'pendente') pendentes += tx.valor;
    });

    return {
      entradas,
      saidas,
      pendentes,
      saldoLiquido: entradas - saidas,
    };
  }, [filteredTransactions]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setOriginFilter('all');
    setCategoryFilter('all');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    originFilter !== 'all' ||
    categoryFilter !== 'all';

  const renderOriginBadge = (tx: Transaction) => {
    if (tx.credit_card_id) {
      const card = cardMap.get(tx.credit_card_id);
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
          <CreditCardIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{card?.nome_cartao || 'Cartão de Crédito'}</span>
        </span>
      );
    }

    const acc = tx.account_id ? accountMap.get(tx.account_id) : null;
    if (acc?.tipo === 'dinheiro_fisico') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300">
          <Banknote className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{acc.nome}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-app-text">
        <Building2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span className="truncate">{acc?.nome || 'Conta Bancária'}</span>
      </span>
    );
  };

  const newLocal = <tr className="surface-elevated border-b border-app-border text-[11px] font-bold uppercase tracking-wider text-app-muted">
    <th className="w-28 py-3.5 px-4 text-center">Vencimento</th>
    <th className="w-64 py-3.5 px-4 text-center">Descrição & Natureza</th>
    <th className="w-44 py-3.5 px-4 text-center">Categoria</th>
    <th className="w-44 py-3.5 px-4 text-center">Conta / Cartão</th>
    <th className="w-28 py-3.5 px-4 text-center">Status</th>
    <th className="w-36 py-3.5 px-4 text-center">Valor</th>
    <th className="w-36 py-3.5 px-4 text-center">Baixa</th>
  </tr>;
  return (
    <div className="space-y-6">
      {/* Cabeçalho + Botão Novo Lançamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-app-accent flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Extrato Inteligente
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Lançamentos de {formatMonthYearDisplay(selectedMonth)}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsQuickTransactionOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold btn-primary-theme shadow-sm flex items-center gap-2 transition-colors w-fit"
        >
          <Plus className="w-4 h-4 stroke-[2.25]" />
          <span>Lançamento</span>
        </button>
      </div>

      {/* KPIs do Extrato Filtrado */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="surface-card rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-app-muted">
            <span>Entradas Filtradas</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-400">
            {formatCurrency(summary.entradas, currency, hide)}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-app-muted">
            <span>Saídas Filtradas</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-rose-400">
            {formatCurrency(summary.saidas, currency, hide)}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-app-muted">
            <span>Pendentes de Baixa</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-amber-400">
            {formatCurrency(summary.pendentes, currency, hide)}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-1 border-l-4 border-l-app-primary">
          <div className="flex items-center justify-between text-[11px] text-app-muted">
            <span>Resultado Filtrado</span>
            <ArrowLeftRight className="w-4 h-4 text-app-primary" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold">
            {formatCurrency(summary.saldoLiquido, currency, hide)}
          </p>
        </div>
      </section>

      {/* Barra Completa de Filtros e Busca */}
      <section className="surface-card rounded-2xl p-4 space-y-3 border border-app-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-app-muted flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-app-primary" />
            Filtros Avançados ({filteredTransactions.length} lançamentos exibidos)
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-app-accent hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Busca por Texto */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-app-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar descrição..."
              className="w-full surface-elevated rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(
                e.target.value as 'all' | 'receita' | 'despesa' | 'transferencia'
              )
            }
            className="surface-elevated rounded-xl px-3 py-2 text-xs font-medium"
          >
            <option value="all">Todos os Tipos</option>
            <option value="receita">Apenas Receitas (+)</option>
            <option value="despesa">Apenas Despesas (-)</option>
            <option value="transferencia">Transferências (⇄)</option>
          </select>

          {/* Filtro por Status */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'pago' | 'pendente')
            }
            className="surface-elevated rounded-xl px-3 py-2 text-xs font-medium"
          >
            <option value="all">Status: Todos</option>
            <option value="pago">Liquidados (Pago / Recebido)</option>
            <option value="pendente">Pendentes de Baixa</option>
          </select>

          {/* Filtro por Conta ou Cartão */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="surface-elevated rounded-xl px-3 py-2 text-xs font-medium"
          >
            <option value="all">Todas as Contas & Cartões</option>
            <optgroup label="Contas & Carteiras Físicas">
              {accounts.map((acc) => (
                <option key={acc.id} value={`acc:${acc.id}`}>
                  {acc.nome}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cartões de Crédito">
              {creditCards.map((cc) => (
                <option key={cc.id} value={`cc:${cc.id}`}>
                  Cartão: {cc.nome_cartao}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Filtro por Categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="surface-elevated rounded-xl px-3 py-2 text-xs font-medium"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Estado Vazio */}
      {filteredTransactions.length === 0 ? (
        <div className="surface-card rounded-3xl p-10 text-center space-y-3 border border-app-border">
          <Calendar className="w-10 h-10 text-app-muted mx-auto" />
          <h3 className="text-base font-bold">
            Nenhum lançamento encontrado em {formatMonthYearDisplay(selectedMonth)}
          </h3>
          <p className="text-xs text-app-muted max-w-md mx-auto">
            Não há transações que correspondam aos filtros selecionados ou esta competência ainda não possui registros.
          </p>
          <button
            type="button"
            onClick={() => setIsQuickTransactionOpen(true)}
            className="btn-primary-theme px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Primeiro Lançamento</span>
          </button>
        </div>
      ) : (
        <>
          {/* =================================================================
              VISÃO DESKTOP (>= 768px): TABELA COMPLETA (table-fixed)
              ================================================================= */}
          <div className="hidden md:block surface-card rounded-2xl overflow-hidden border border-app-border">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                {newLocal}
              </thead>
              <tbody className="divide-y divide-app-border text-xs">
                {filteredTransactions.map((tx) => {
                  const category = categoryMap.get(tx.category_id);
                  const CatIcon =
                    (category && CATEGORY_ICON_MAP[category.icone]) || Tag;
                  const isPaid = tx.status === 'pago';

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-app-elevated/50 transition-colors"
                    >
                      {/* Coluna 1: Data */}
                      <td className="py-3.5 px-4 font-mono text-app-muted text-center">
                        {formatDatePtBr(tx.data_vencimento)}
                      </td>

                      {/* Coluna 2: Descrição + Ícone + Badge Parcela (3/10) ou Fixa */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm"
                            style={{
                              backgroundColor: category?.cor || '#8b5cf6',
                            }}
                          >
                            <CatIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate text-app-text">
                              {tx.descricao}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {tx.natureza === 'parcelada' && tx.parcela_atual ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Layers className="w-2.5 h-2.5" />
                                  Parcela {tx.parcela_atual}/{tx.total_parcelas}
                                </span>
                              ) : tx.natureza === 'fixa' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                  <Repeat className="w-2.5 h-2.5" />
                                  Fixa Mensal
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  <Shuffle className="w-2.5 h-2.5" />
                                  Variável / Único
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 3: Categoria */}
                      <td className="py-3.5 px-4">
                        <div className="truncate font-semibold text-center">
                          {tx.tipo === 'transferencia'
                            ? 'Transferência Interna'
                            : category?.nome || 'Sem Categoria'}
                        </div>
                        {tx.tipo === 'despesa' && category && (
                          <>
                            {category.percentual_meta ? (
                              <span className="text-[10px] text-app-muted block">
                                Meta: {category.percentual_meta}% da renda
                              </span>
                            ) : userSettings.usar_regra_50_30_20 &&
                              category.regra_50_30_20 ? (
                              <span className="text-[10px] text-app-muted block">
                                {category.regra_50_30_20 === 'essencial_50'
                                  ? `${userSettings.pct_essencial ?? 50}% • Essencial`
                                  : category.regra_50_30_20 === 'estilo_vida_30'
                                  ? `${userSettings.pct_estilo_vida ?? 30}% • Estilo de Vida`
                                  : `${userSettings.pct_futuro ?? 20}% • Futuro & Metas`}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>

                      {/* Coluna 4: Origem (Conta, Carteira Física ou Cartão) */}
                      <td className="py-3 px-2 truncate text-center">
                        {renderOriginBadge(tx)}
                      </td>

                      {/* Coluna 5: Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>Pago</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Pendente</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Coluna 6: Valor Colorido */}
                      <td className="py-3.5 px-4 text-center font-extrabold text-sm">
                        <span
                          className={
                            tx.tipo === 'receita'
                              ? 'text-emerald-400'
                              : tx.tipo === 'transferencia'
                              ? 'text-violet-400'
                              : 'text-rose-400'
                          }
                        >
                          {tx.tipo === 'receita'
                            ? '+ '
                            : tx.tipo === 'transferencia'
                            ? '⇄ '
                            : '- '}
                          {formatCurrency(tx.valor, currency, hide)}
                        </span>
                      </td>

                      {/* Coluna 7: Botão de 1 Clique "Dar Baixa (✓)" + Editar + Excluir */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleTransactionStatus(tx.id)}
                            title={
                              isPaid
                                ? 'Reabrir como Pendente'
                                : 'Dar Baixa em 1 Clique (✓) e Atualizar Saldo Real'
                            }
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all ${
                              isPaid
                                ? 'surface-elevated text-emerald-400 hover:bg-amber-500/15 hover:text-amber-300'
                                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-sm'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{isPaid ? 'Baixado' : 'Baixar'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingTransaction(tx)}
                            title="Editar Lançamento"
                            className="p-1.5 rounded-xl surface-elevated text-app-muted hover:text-app-text"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              tx.grupo_parcelamento_id
                                ? setDeletingTx(tx)
                                : deleteTransaction(tx.id, false)
                            }
                            title="Excluir Lançamento"
                            className="p-1.5 rounded-xl surface-elevated text-rose-400 hover:bg-rose-500/15"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* =================================================================
              VISÃO MOBILE (< 768px): CARDS COMPACTOS AGRUPADOS POR DATA
              ================================================================= */}
          <div className="md:hidden space-y-4">
            {groupedByDate.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-app-muted">
                    {formatDatePtBr(group.date)}
                  </span>
                  <span className="text-[11px] text-app-muted">
                    {group.items.length} lançamento(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map((tx) => {
                    const category = categoryMap.get(tx.category_id);
                    const CatIcon =
                      (category && CATEGORY_ICON_MAP[category.icone]) || Tag;
                    const isPaid = tx.status === 'pago';

                    return (
                      <div
                        key={tx.id}
                        className="surface-card rounded-2xl p-3.5 flex items-center justify-between gap-3 border border-app-border"
                      >
                        {/* Ícone da Categoria + Infos */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow"
                            style={{
                              backgroundColor: category?.cor || '#8b5cf6',
                            }}
                          >
                            <CatIcon className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold truncate">
                                {tx.descricao}
                              </p>
                              {tx.natureza === 'parcelada' && tx.parcela_atual && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">
                                  {tx.parcela_atual}/{tx.total_parcelas}
                                </span>
                              )}
                              {tx.natureza === 'fixa' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 shrink-0">
                                  Fixa
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-app-muted">
                              {renderOriginBadge(tx)}
                            </div>
                          </div>
                        </div>

                        {/* Valor Colorido + Botão 1-Click Dar Baixa (✓) */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p
                              className={`text-sm font-extrabold ${
                                tx.tipo === 'receita'
                                  ? 'text-emerald-400'
                                  : tx.tipo === 'transferencia'
                                  ? 'text-violet-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {tx.tipo === 'receita'
                                ? '+'
                                : tx.tipo === 'transferencia'
                                ? '⇄'
                                : '-'}
                              {formatCurrency(tx.valor, currency, hide)}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => setEditingTransaction(tx)}
                                className="text-[10px] text-app-muted underline"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  tx.grupo_parcelamento_id
                                    ? setDeletingTx(tx)
                                    : deleteTransaction(tx.id, false)
                                }
                                className="text-[10px] text-rose-400 underline"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>

                          {/* Botão 1 Clique "Dar Baixa (✓)" */}
                          <button
                            type="button"
                            onClick={() => toggleTransactionStatus(tx.id)}
                            title={
                              isPaid
                                ? 'Liquidado (Toque para reabrir)'
                                : 'Dar Baixa em 1 Clique (✓)'
                            }
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                              isPaid
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-emerald-500 text-zinc-950 shadow-md active:scale-95'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de Confirmação ao Excluir Lançamento Parcelado ou Fixo Recorrente */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-4 border border-app-border">
            <h3 className="text-base font-extrabold">
              Excluir Lançamento {deletingTx.natureza === 'parcelada' ? 'Parcelado' : 'Recorrente'}
            </h3>
            <p className="text-xs text-app-muted leading-relaxed">
              O lançamento <strong className="text-app-text">"{deletingTx.descricao}"</strong> faz
              parte de uma série ({deletingTx.natureza === 'parcelada' ? `Parcela ${deletingTx.parcela_atual}/${deletingTx.total_parcelas}` : 'Fixa Mensal'}). Deseja excluir apenas o lançamento deste mês ou todas as ocorrências vinculadas?
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTransaction(deletingTx.id, false);
                  setDeletingTx(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold surface-elevated hover:border-rose-400 text-rose-300"
              >
                Apenas Este Mês
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTransaction(deletingTx.id, true);
                  setDeletingTx(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500 text-white shadow-md"
              >
                Todas as Parcelas/Série
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

