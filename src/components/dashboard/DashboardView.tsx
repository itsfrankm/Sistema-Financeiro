import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  CreditCard as CreditCardIcon,
  Target,
  Check,
  Building2,
  Banknote,
  Repeat,
  Shuffle,
  FileDown,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, formatMonthYearDisplay, shiftYearMonth } from '../../lib/utils';
import { exportFinancePdf } from '../../utils/exportFinancePdf';

export type AnalyticalPeriod = 'diario' | 'semanal' | 'mensal' | 'anual';

export type SummaryBlockTab =
  | 'receitas'
  | 'despesas_fixas_variaveis'
  | 'parceladas_faturas'
  | 'balanco_caixinhas';

const MONTH_SHORT_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const MONTH_NAMES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

type WeekNumber = 1 | 2 | 3 | 4 | 5;

function getMonthWeeks(daysInMonth: number): { id: WeekNumber; label: string; min: number; max: number }[] {
  const weeks: { id: WeekNumber; label: string; min: number; max: number }[] = [
    { id: 1, label: 'Semana 1', min: 1, max: 7 },
    { id: 2, label: 'Semana 2', min: 8, max: 14 },
    { id: 3, label: 'Semana 3', min: 15, max: 21 },
    { id: 4, label: 'Semana 4', min: 22, max: 28 },
  ];
  if (daysInMonth > 28) {
    weeks.push({ id: 5, label: 'Semana 5', min: 29, max: daysInMonth });
  }
  return weeks;
}

const PERIOD_LABELS: Record<
  AnalyticalPeriod,
  'Diária' | 'Semanal' | 'Mensal' | 'Anual'
> = {
  diario: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
};

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    selectedMonth,
    setSelectedMonth,
    userSettings,
    accounts,
    creditCards,
    categories,
    budgets,
    transactions,
    financialGoals,
    rule503020Summary,
    setActiveTab,
    toggleTransactionStatus,
  } = useFinance();

  const [period, setPeriod] = useState<AnalyticalPeriod>('mensal');
  const [selectedDay, setSelectedDay] = useState<string>('01');
  const [selectedWeek, setSelectedWeek] = useState<WeekNumber>(1);
  const [activeBlock, setActiveBlock] = useState<SummaryBlockTab>('receitas');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const hide = userSettings.ocultar_valores;
  const currency = userSettings.moeda;
  const [selectedYear, selectedMonthNum] = selectedMonth.split('-');

  const daysInMonth = useMemo(() => {
    const y = Number(selectedYear) || 2026;
    const m = Number(selectedMonthNum) || 1;
    return new Date(y, m, 0).getDate();
  }, [selectedYear, selectedMonthNum]);

  const weekOptions = useMemo(() => getMonthWeeks(daysInMonth), [daysInMonth]);
  const maxWeekInMonth: WeekNumber = daysInMonth > 28 ? 5 : 4;

  useEffect(() => {
    if (Number(selectedDay) > daysInMonth) {
      setSelectedDay(String(daysInMonth).padStart(2, '0'));
    }
    if (selectedWeek > maxWeekInMonth) {
      setSelectedWeek(maxWeekInMonth);
    }
  }, [daysInMonth, maxWeekInMonth, selectedDay, selectedWeek]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>(['2024', '2025', '2026', '2027', '2028', selectedYear]);
    transactions.forEach((tx) => {
      const y = tx.data_vencimento.slice(0, 4);
      if (y) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort();
  }, [transactions, selectedYear]);

  const activeWeekObj =
    weekOptions.find((w) => w.id === selectedWeek) ||
    weekOptions[weekOptions.length - 1];

  const competenceDisplay = useMemo(() => {
    if (period === 'diario') {
      return `Dia ${selectedDay}/${selectedMonthNum}/${selectedYear}`;
    }
    if (period === 'semanal') {
      const maxDay = Math.min(activeWeekObj.max, daysInMonth);
      const minStr = String(activeWeekObj.min).padStart(2, '0');
      const maxStr = String(maxDay).padStart(2, '0');
      return `Semana ${selectedWeek} (${minStr} a ${maxStr}/${selectedMonthNum}/${selectedYear})`;
    }
    if (period === 'anual') {
      return `Ano ${selectedYear}`;
    }
    return formatMonthYearDisplay(selectedMonth);
  }, [
    period,
    selectedDay,
    selectedMonthNum,
    selectedYear,
    selectedWeek,
    activeWeekObj,
    daysInMonth,
    selectedMonth,
  ]);

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

  // ==========================================================================
  // TRANSAÇÕES FILTRADAS PELO PERÍODO ANALÍTICO SELECIONADO
  // ==========================================================================
  const periodTransactions = useMemo(() => {
    if (period === 'anual') {
      return transactions.filter((tx) => tx.data_vencimento.startsWith(selectedYear));
    }
    if (period === 'diario') {
      return transactions.filter(
        (tx) => tx.data_vencimento === `${selectedMonth}-${selectedDay}`
      );
    }
    if (period === 'semanal') {
      return transactions.filter((tx) => {
        if (!tx.data_vencimento.startsWith(selectedMonth)) return false;
        const d = Number(tx.data_vencimento.split('-')[2]);
        return d >= activeWeekObj.min && d <= activeWeekObj.max;
      });
    }
    return transactions.filter((tx) => tx.data_vencimento.startsWith(selectedMonth));
  }, [
    transactions,
    period,
    selectedMonth,
    selectedYear,
    selectedDay,
    activeWeekObj,
  ]);

  const handleExportDashboardPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportFinancePdf({
        holderName:
          userSettings.nome_exibicao || currentUser?.nome_exibicao || 'Titular FinPlanner',
        periodLabel: PERIOD_LABELS[period],
        selectedMonth,
        customCompetenceLabel: competenceDisplay,
        filteredTransactions: periodTransactions,
        userSettings,
        accounts,
        creditCards,
        categories,
        budgets,
        transactions,
        rule503020Summary,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ==========================================================================
  // CÁLCULO DOS 4 CARDS DE INDICADORES PRINCIPAIS
  // ==========================================================================
  const kpiMetrics = useMemo(() => {
    // Card 1: Saldo Atual em Contas (Realizado hoje nas contas bancárias + carteira física)
    const saldoBancos = accounts
      .filter((a) => a.incluir_na_soma_geral && a.tipo !== 'dinheiro_fisico')
      .reduce((s, a) => s + a.saldo_atual, 0);

    const saldoCarteiraFisica = accounts
      .filter((a) => a.incluir_na_soma_geral && a.tipo === 'dinheiro_fisico')
      .reduce((s, a) => s + a.saldo_atual, 0);

    const saldoAtualRealizado = Number((saldoBancos + saldoCarteiraFisica).toFixed(2));

    // Card 2: Receitas do Período (Já Recebido vs Falta Receber / Previsto)
    const receitasRecebidas = Number(
      periodTransactions
        .filter((tx) => tx.tipo === 'receita' && tx.status === 'pago')
        .reduce((s, tx) => s + tx.valor, 0)
        .toFixed(2)
    );
    const receitasPendentes = Number(
      periodTransactions
        .filter((tx) => tx.tipo === 'receita' && tx.status === 'pendente')
        .reduce((s, tx) => s + tx.valor, 0)
        .toFixed(2)
    );
    const receitasTotalPeriodo = Number((receitasRecebidas + receitasPendentes).toFixed(2));

    // Card 3: Despesas do Período (Já Pago vs Falta Pagar / Pendente)
    const despesasPagas = Number(
      periodTransactions
        .filter((tx) => tx.tipo === 'despesa' && tx.status === 'pago')
        .reduce((s, tx) => s + tx.valor, 0)
        .toFixed(2)
    );

    // Separa Despesas Pendentes de Conta vs Fatura Atual Pendente de Cartão
    const despesasPendentesConta = Number(
      periodTransactions
        .filter(
          (tx) =>
            tx.tipo === 'despesa' &&
            tx.status === 'pendente' &&
            !tx.credit_card_id
        )
        .reduce((s, tx) => s + tx.valor, 0)
        .toFixed(2)
    );

    const faturaAtualPendente = Number(
      periodTransactions
        .filter(
          (tx) =>
            tx.tipo === 'despesa' &&
            tx.status === 'pendente' &&
            Boolean(tx.credit_card_id)
        )
        .reduce((s, tx) => s + tx.valor, 0)
        .toFixed(2)
    );

    const despesasPendentesTotal = Number(
      (despesasPendentesConta + faturaAtualPendente).toFixed(2)
    );
    const despesasTotalPeriodo = Number(
      (despesasPagas + despesasPendentesTotal).toFixed(2)
    );

    // Card 4: Saldo Projetado do Fim do Mês
    // Fórmula estrita: Saldo Atual + Receitas Pendentes - Despesas Pendentes (Conta) - Fatura Atual (Cartão)
    const saldoProjetadoFimMes = Number(
      (
        saldoAtualRealizado +
        receitasPendentes -
        despesasPendentesConta -
        faturaAtualPendente
      ).toFixed(2)
    );

    // % de Economia Líquida do Período
    const economiaLiquidaPeriodo = Number(
      (receitasTotalPeriodo - despesasTotalPeriodo).toFixed(2)
    );
    const percentualEconomiaLiquida =
      receitasTotalPeriodo > 0
        ? Number(((economiaLiquidaPeriodo / receitasTotalPeriodo) * 100).toFixed(1))
        : 0;

    return {
      saldoAtualRealizado,
      saldoBancos,
      saldoCarteiraFisica,
      receitasRecebidas,
      receitasPendentes,
      receitasTotalPeriodo,
      despesasPagas,
      despesasPendentesConta,
      faturaAtualPendente,
      despesasPendentesTotal,
      despesasTotalPeriodo,
      saldoProjetadoFimMes,
      economiaLiquidaPeriodo,
      percentualEconomiaLiquida,
    };
  }, [accounts, periodTransactions]);

  // ==========================================================================
  // GRÁFICO 1: EVOLUÇÃO DE ENTRADAS VS SAÍDAS E SALDO ACUMULADO (RECHARTS)
  // ==========================================================================
  const cashFlowEvolutionData = useMemo(() => {
    const baseInitialBalance = accounts
      .filter((a) => a.incluir_na_soma_geral)
      .reduce((s, a) => s + a.saldo_inicial, 0);

    if (period === 'diario') {
      // Exibe janela de 7 dias centrada no dia selecionado para contexto diário
      const targetDay = Number(selectedDay) || 15;
      const startDay = Math.max(1, Math.min(daysInMonth - 6, targetDay - 3));
      const endDay = Math.min(daysInMonth, startDay + 6);
      let runningBalance = baseInitialBalance;
      const points: {
        label: string;
        Entradas: number;
        Saidas: number;
        SaldoAcumulado: number;
      }[] = [];

      for (let d = 1; d <= endDay; d++) {
        const dayStr = String(d).padStart(2, '0');
        const isoDate = `${selectedMonth}-${dayStr}`;
        const dayTxs = transactions.filter((t) => t.data_vencimento === isoDate);

        const entradas = dayTxs
          .filter((t) => t.tipo === 'receita')
          .reduce((s, t) => s + t.valor, 0);
        const saidas = dayTxs
          .filter((t) => t.tipo === 'despesa')
          .reduce((s, t) => s + t.valor, 0);

        runningBalance += entradas - saidas;

        if (d >= startDay && d <= endDay) {
          points.push({
            label: d === targetDay ? `★ Dia ${dayStr}` : `Dia ${dayStr}`,
            Entradas: Number(entradas.toFixed(2)),
            Saidas: Number(saidas.toFixed(2)),
            SaldoAcumulado: Number(runningBalance.toFixed(2)),
          });
        }
      }
      return points;
    }

    if (period === 'semanal') {
      // Exibe os dias da semana selecionada
      const minD = activeWeekObj.min;
      const maxD = Math.min(activeWeekObj.max, daysInMonth);
      let runningBalance = baseInitialBalance;
      const points: {
        label: string;
        Entradas: number;
        Saidas: number;
        SaldoAcumulado: number;
      }[] = [];

      for (let d = 1; d <= maxD; d++) {
        const dayStr = String(d).padStart(2, '0');
        const isoDate = `${selectedMonth}-${dayStr}`;
        const dayTxs = transactions.filter((t) => t.data_vencimento === isoDate);

        const entradas = dayTxs
          .filter((t) => t.tipo === 'receita')
          .reduce((s, t) => s + t.valor, 0);
        const saidas = dayTxs
          .filter((t) => t.tipo === 'despesa')
          .reduce((s, t) => s + t.valor, 0);

        runningBalance += entradas - saidas;

        if (d >= minD && d <= maxD) {
          points.push({
            label: `${dayStr}/${selectedMonthNum}`,
            Entradas: Number(entradas.toFixed(2)),
            Saidas: Number(saidas.toFixed(2)),
            SaldoAcumulado: Number(runningBalance.toFixed(2)),
          });
        }
      }
      return points;
    }

    if (period === 'mensal') {
      // Exibe janela de 6 meses centrada no selectedMonth (-2 meses até +3 meses projetados)
      let runningBalance = baseInitialBalance;
      const monthsWindow = [-2, -1, 0, 1, 2, 3].map((delta) =>
        shiftYearMonth(selectedMonth, delta)
      );

      return monthsWindow.map((ym) => {
        const [, mStr] = ym.split('-');
        const mIdx = Number(mStr) - 1;
        const mTxs = transactions.filter((t) => t.data_vencimento.startsWith(ym));

        const entradas = mTxs
          .filter((t) => t.tipo === 'receita')
          .reduce((s, t) => s + t.valor, 0);
        const saidas = mTxs
          .filter((t) => t.tipo === 'despesa')
          .reduce((s, t) => s + t.valor, 0);

        runningBalance += entradas - saidas;

        return {
          label: `${MONTH_SHORT_LABELS[mIdx]}/${ym.slice(2, 4)}`,
          Entradas: Number(entradas.toFixed(2)),
          Saidas: Number(saidas.toFixed(2)),
          SaldoAcumulado: Number(runningBalance.toFixed(2)),
        };
      });
    }

    // Período Anual (12 meses do ano selecionado)
    let runningBalance = baseInitialBalance;
    return MONTH_SHORT_LABELS.map((mName, idx) => {
      const ym = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const mTxs = transactions.filter((t) => t.data_vencimento.startsWith(ym));

      const entradas = mTxs
        .filter((t) => t.tipo === 'receita')
        .reduce((s, t) => s + t.valor, 0);
      const saidas = mTxs
        .filter((t) => t.tipo === 'despesa')
        .reduce((s, t) => s + t.valor, 0);

      runningBalance += entradas - saidas;

      return {
        label: mName,
        Entradas: Number(entradas.toFixed(2)),
        Saidas: Number(saidas.toFixed(2)),
        SaldoAcumulado: Number(runningBalance.toFixed(2)),
      };
    });
  }, [
    accounts,
    period,
    selectedMonth,
    selectedMonthNum,
    selectedYear,
    selectedDay,
    daysInMonth,
    activeWeekObj,
    periodTransactions,
    transactions,
  ]);

  // ==========================================================================
  // GRÁFICO 2 (ROSCA / DONUT): DISTRIBUIÇÃO DE DESPESAS POR CATEGORIA
  // ==========================================================================
  const expensesByCategoryData = useMemo(() => {
    const totalsMap = new Map<string, number>();
    const expenses = periodTransactions.filter((tx) => tx.tipo === 'despesa');
    const totalDespesas = expenses.reduce((s, tx) => s + tx.valor, 0);

    expenses.forEach((tx) => {
      totalsMap.set(tx.category_id, (totalsMap.get(tx.category_id) || 0) + tx.valor);
    });

    const items = Array.from(totalsMap.entries())
      .map(([catId, value]) => {
        const cat = categoryMap.get(catId);
        const pct = totalDespesas > 0 ? Number(((value / totalDespesas) * 100).toFixed(1)) : 0;
        return {
          id: catId,
          name: cat?.nome || 'Outros',
          value: Number(value.toFixed(2)),
          color: cat?.cor || '#8b5cf6',
          percent: pct,
        };
      })
      .sort((a, b) => b.value - a.value);

    return { items, totalDespesas };
  }, [periodTransactions, categoryMap]);

  // ==========================================================================
  // LISTAS PARA AS 4 VISÕES/TABELAS RESUMO RÁPIDAS ABAIXO DOS GRÁFICOS
  // ==========================================================================
  const incomesList = useMemo(
    () =>
      periodTransactions
        .filter((tx) => tx.tipo === 'receita')
        .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento)),
    [periodTransactions]
  );

  const fixedAndVariableExpensesList = useMemo(
    () =>
      periodTransactions
        .filter((tx) => tx.tipo === 'despesa' && tx.natureza !== 'parcelada')
        .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento)),
    [periodTransactions]
  );

  const installmentsAndCardsList = useMemo(
    () =>
      periodTransactions
        .filter(
          (tx) =>
            tx.tipo === 'despesa' &&
            (tx.natureza === 'parcelada' || Boolean(tx.credit_card_id))
        )
        .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento)),
    [periodTransactions]
  );

  const totalGuardadoCaixinhas = useMemo(
    () => financialGoals.reduce((s, g) => s + g.valor_acumulado, 0),
    [financialGoals]
  );
  const totalMetaCaixinhas = useMemo(
    () => financialGoals.reduce((s, g) => s + g.valor_meta, 0),
    [financialGoals]
  );

  return (
    <div className="space-y-8">
      {/* =====================================================================
          1. TOPO DO DASHBOARD + SELETOR DE PERÍODO ANALÍTICO (DIÁRIO | SEMANAL | MENSAL | ANUAL)
          ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-app-accent flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Fluxo de Caixa Projetado
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Olá, {currentUser?.nome_exibicao || userSettings.nome_exibicao}
          </h1>
          <p className="text-xs text-app-muted">
            Análise {PERIOD_LABELS[period]} • Competência ativa:{' '}
            <strong className="text-app-text">
              {competenceDisplay}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-center lg:justify-end gap-2.5">
          {/* 1. Seletor de Período Analítico: Diária, Semanal, Mensal, Anual */}
          <div className="surface-card h-10 p-1 rounded-2xl border border-app-border flex items-center gap-1 shrink-0">
            {(
              [
                { id: 'diario', label: 'Diária' },
                { id: 'semanal', label: 'Semanal' },
                { id: 'mensal', label: 'Mensal' },
                { id: 'anual', label: 'Anual' },
              ] as { id: AnalyticalPeriod; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`h-full px-3.5 rounded-xl text-xs font-bold flex items-center justify-center whitespace-nowrap transition-all ${
                  period === p.id
                    ? 'btn-primary-theme shadow-md'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 2. Seletor Específico de Dia, Semana, Mês ou Ano */}
          <div className="surface-card h-10 px-3 rounded-2xl border border-app-border flex items-center justify-center gap-2 text-xs shrink-0 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-app-primary shrink-0" />

            {period === 'diario' && (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    const d = Number(selectedDay);
                    if (d > 1) {
                      setSelectedDay(String(d - 1).padStart(2, '0'));
                    } else {
                      const prevYm = shiftYearMonth(selectedMonth, -1);
                      const [py, pm] = prevYm.split('-').map(Number);
                      const prevMax = new Date(py, pm, 0).getDate();
                      setSelectedMonth(prevYm);
                      setSelectedDay(String(prevMax).padStart(2, '0'));
                    }
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Dia anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: daysInMonth }, (_, idx) => {
                    const dStr = String(idx + 1).padStart(2, '0');
                    return (
                      <option
                        key={dStr}
                        value={dStr}
                        className="bg-zinc-900 text-white"
                      >
                        Dia {dStr}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={selectedMonthNum}
                  onChange={(e) =>
                    setSelectedMonth(`${selectedYear}-${e.target.value}`)
                  }
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((m) => (
                    <option
                      key={m.value}
                      value={m.value}
                      className="bg-zinc-900 text-white"
                    >
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedMonth(`${e.target.value}-${selectedMonthNum}`)
                  }
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-zinc-900 text-white">
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const d = Number(selectedDay);
                    if (d < daysInMonth) {
                      setSelectedDay(String(d + 1).padStart(2, '0'));
                    } else {
                      const nextYm = shiftYearMonth(selectedMonth, 1);
                      setSelectedMonth(nextYm);
                      setSelectedDay('01');
                    }
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Próximo dia"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {period === 'semanal' && (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedWeek > 1) {
                      setSelectedWeek((selectedWeek - 1) as WeekNumber);
                    } else {
                      setSelectedMonth(shiftYearMonth(selectedMonth, -1));
                      setSelectedWeek(1);
                    }
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={selectedWeek}
                  onChange={(e) =>
                    setSelectedWeek(Number(e.target.value) as WeekNumber)
                  }
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {weekOptions.map((w) => (
                    <option
                      key={w.id}
                      value={w.id}
                      className="bg-zinc-900 text-white"
                    >
                      Semana {w.id}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMonthNum}
                  onChange={(e) => {
                    setSelectedMonth(`${selectedYear}-${e.target.value}`);
                    setSelectedWeek(1);
                  }}
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((m) => (
                    <option
                      key={m.value}
                      value={m.value}
                      className="bg-zinc-900 text-white"
                    >
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedMonth(`${e.target.value}-${selectedMonthNum}`);
                    setSelectedWeek(1);
                  }}
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-zinc-900 text-white">
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedWeek < maxWeekInMonth) {
                      setSelectedWeek((selectedWeek + 1) as WeekNumber);
                    } else {
                      setSelectedMonth(shiftYearMonth(selectedMonth, 1));
                      setSelectedWeek(1);
                    }
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Próxima semana"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {period === 'mensal' && (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setSelectedMonth(shiftYearMonth(selectedMonth, -1))}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={selectedMonthNum}
                  onChange={(e) =>
                    setSelectedMonth(`${selectedYear}-${e.target.value}`)
                  }
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((m) => (
                    <option
                      key={m.value}
                      value={m.value}
                      className="bg-zinc-900 text-white"
                    >
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedMonth(`${e.target.value}-${selectedMonthNum}`)
                  }
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-zinc-900 text-white">
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setSelectedMonth(shiftYearMonth(selectedMonth, 1))}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {period === 'anual' && (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    const prevYear = String(Number(selectedYear) - 1);
                    setSelectedMonth(`${prevYear}-${selectedMonthNum}`);
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Ano anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedMonth(`${e.target.value}-${selectedMonthNum}`)
                  }
                  className="bg-transparent font-bold text-app-text focus:outline-none cursor-pointer px-1"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-zinc-900 text-white">
                      Ano {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const nextYear = String(Number(selectedYear) + 1);
                    setSelectedMonth(`${nextYear}-${selectedMonthNum}`);
                  }}
                  className="p-1 rounded-lg hover:bg-black/10 text-app-muted hover:text-app-text"
                  title="Próximo ano"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Botão PDF A4 */}
          <button
            type="button"
            onClick={handleExportDashboardPdf}
            disabled={isExportingPdf}
            className="surface-elevated hover:border-violet-500 h-10 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 text-violet-300 shrink-0 whitespace-nowrap transition-all disabled:opacity-60"
            title="Exportar Relatório Executivo em 1 Folha A4 Retrato (Margem 8mm)"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-violet-400" />
            )}
            <span>PDF A4</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. OS 4 CARDS DE INDICADORES PRINCIPAIS (COM SUPORTE AO MODO PRIVACIDADE)
          ===================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* CARD 1: Saldo Atual em Contas (Realizado) */}
        <div className="surface-card rounded-3xl p-5 border border-app-border flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2 min-h-[36px]">
            <span className="text-xs font-bold text-app-muted whitespace-nowrap">
              Saldo Atual
            </span>
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 min-h-[32px]">
              <p className="text-xl 2xl:text-2xl font-extrabold tracking-tight whitespace-nowrap">
                {formatCurrency(kpiMetrics.saldoAtualRealizado, currency, hide)}
              </p>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-app-border flex items-center justify-between gap-2 text-[10.5px] 2xl:text-[11px] text-app-muted">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Building2 className="w-3 h-3 text-violet-400 shrink-0" />
                <span>Bancos: {formatCurrency(kpiMetrics.saldoBancos, currency, hide)}</span>
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Banknote className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>Espécie: {formatCurrency(kpiMetrics.saldoCarteiraFisica, currency, hide)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: Receitas do Período (Já Recebido + Falta Receber) */}
        <div className="surface-card rounded-3xl p-5 border border-app-border flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2 min-h-[36px]">
            <span className="text-xs font-bold text-app-muted whitespace-nowrap">Receitas</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 min-h-[32px]">
              <p className="text-xl 2xl:text-2xl font-extrabold tracking-tight text-emerald-400 whitespace-nowrap">
                {formatCurrency(kpiMetrics.receitasRecebidas, currency, hide)}
              </p>
              <span className="inline-flex items-center whitespace-nowrap shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                Já Recebido
              </span>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-app-border flex items-center justify-between gap-2 text-[10.5px] 2xl:text-[11px] whitespace-nowrap">
              <span className="text-app-muted">Falta Receber</span>
              <strong className="text-emerald-300">
                {formatCurrency(kpiMetrics.receitasPendentes, currency, hide)}
              </strong>
            </div>
          </div>
        </div>

        {/* CARD 3: Despesas do Período (Já Pago + Falta Pagar) */}
        <div className="surface-card rounded-3xl p-5 border border-app-border flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2 min-h-[36px]">
            <span className="text-xs font-bold text-app-muted whitespace-nowrap">Despesas</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 min-h-[32px]">
              <p className="text-xl 2xl:text-2xl font-extrabold tracking-tight text-rose-400 whitespace-nowrap">
                {formatCurrency(kpiMetrics.despesasPagas, currency, hide)}
              </p>
              <span className="inline-flex items-center whitespace-nowrap shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300">
                Já Pago
              </span>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-app-border flex items-center justify-between gap-2 text-[10.5px] 2xl:text-[11px] whitespace-nowrap">
              <span className="text-app-muted">Falta Pagar (Pendente):</span>
              <strong className="text-amber-executive">
                {formatCurrency(kpiMetrics.despesasPendentesTotal, currency, hide)}
              </strong>
            </div>
          </div>
        </div>

        {/* CARD 4 (DESTAQUE EXECUTIVO SÓBRIO): Saldo Projetado do Fim do Mês */}
        <div className="card-projected-balance rounded-3xl p-5 flex flex-col justify-between gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 min-h-[36px]">
            <span className="text-xs font-bold text-amber-executive inline-flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 text-amber-executive shrink-0" />
              Saldo Projetado
            </span>
            <span
              className={`inline-flex items-center whitespace-nowrap shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                kpiMetrics.percentualEconomiaLiquida >= 20
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : kpiMetrics.percentualEconomiaLiquida >= 0
                  ? 'badge-amber-executive'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {kpiMetrics.percentualEconomiaLiquida}% Economia
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 min-h-[32px]">
              <p
                className={`text-xl 2xl:text-2xl font-extrabold tracking-tight whitespace-nowrap ${
                  kpiMetrics.saldoProjetadoFimMes >= 0 ? 'text-app-text' : 'text-rose-400'
                }`}
              >
                {formatCurrency(kpiMetrics.saldoProjetadoFimMes, currency, hide)}
              </p>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-app-border flex items-center justify-between gap-2 text-[10.5px] 2xl:text-[11px] text-app-muted whitespace-nowrap">
              <span>
                Fatura Cartão: {formatCurrency(kpiMetrics.faturaAtualPendente, currency, hide)}
              </span>
              <strong className="text-amber-executive font-semibold">
                {kpiMetrics.saldoProjetadoFimMes >= 0 ? '' : 'Atenção: Déficit'}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. GRÁFICOS INTERATIVOS COM RECHARTS (RESPONSIVOS)
          ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* GRÁFICO 1 (BARRAS + ÁREA): Entradas vs Saídas e Saldo Acumulado */}
        <div className="surface-card rounded-3xl p-6 lg:col-span-3 space-y-4 border border-app-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-app-primary" />
                Evolução: Entradas vs. Saídas ({period.toUpperCase()})
              </h3>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cashFlowEvolutionData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="saldoAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (hide ? '•••' : `R$${v}`)}
                />
                <Tooltip
                  formatter={(val: number) =>
                    formatCurrency(Number(val), currency, hide)
                  }
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '14px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="SaldoAcumulado"
                  name="Saldo"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#saldoAreaGrad)"
                />
                <Bar
                  dataKey="Entradas"
                  name="Entradas"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="Saidas"
                  name="Saídas"
                  fill="#f43f5e"
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2 (ROSCA / DONUT): Distribuição de Despesas por Categoria */}
        <div className="surface-card rounded-3xl p-6 lg:col-span-2 space-y-4 border border-app-border flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-app-accent" />
              Distribuição de Despesas
            </h3>
          </div>

          {expensesByCategoryData.items.length === 0 ? (
            <div className="my-auto py-12 text-center text-xs text-app-muted">
              Nenhuma despesa registrada neste período para gerar o gráfico de rosca.
            </div>
          ) : (
            <>
              <div className="h-48 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategoryData.items}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {expensesByCategoryData.items.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) =>
                        formatCurrency(Number(val), currency, hide)
                      }
                      contentStyle={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda Percentual e Valores */}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {expensesByCategoryData.items.map((item) => (
                  <div
                    key={item.id}
                    className="surface-elevated rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[11px] font-bold text-app-accent">
                        {item.percent}%
                      </span>
                      <span className="font-extrabold">
                        {formatCurrency(item.value, currency, hide)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* =====================================================================
          4. AS 4 VISÕES / TABELAS RESUMO RÁPIDAS ABAIXO DOS GRÁFICOS
          ===================================================================== */}
      <section className="surface-card rounded-3xl p-6 space-y-5 border border-app-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-app-border pb-4">
          <div>
            <h3 className="text-lg font-extrabold">
              Fechamento & Auditoria
            </h3>
          </div>

          {/* Abas das 4 Visões Resumo */}
          <div className="flex flex-wrap gap-1.5 surface-elevated p-1.5 rounded-2xl border border-app-border">
            <button
              type="button"
              onClick={() => setActiveBlock('receitas')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeBlock === 'receitas'
                  ? 'bg-emerald-500 text-zinc-950 shadow'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              Receitas
            </button>

            <button
              type="button"
              onClick={() => setActiveBlock('despesas_fixas_variaveis')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeBlock === 'despesas_fixas_variaveis'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              Despesas Fixas & Variáveis
            </button>

            <button
              type="button"
              onClick={() => setActiveBlock('parceladas_faturas')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeBlock === 'parceladas_faturas'
                  ? 'badge-amber-executive shadow-sm'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              Parceladas & Faturas
            </button>

            <button
              type="button"
              onClick={() => setActiveBlock('balanco_caixinhas')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeBlock === 'balanco_caixinhas'
                  ? 'btn-primary-theme shadow'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              Balanço & Caixinhas 
            </button>
          </div>
        </div>

        {/* ABA/BLOCO 1: RECEITAS (REALIZADAS VS PREVISTAS) */}
        {activeBlock === 'receitas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-app-muted">
              <span>
                Recebido:{' '}
                <strong className="text-emerald-400">
                  {formatCurrency(kpiMetrics.receitasRecebidas, currency, hide)}
                </strong>{' '}
                • Previsto:{' '}
                <strong className="text-amber-300">
                  {formatCurrency(kpiMetrics.receitasPendentes, currency, hide)}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('transacoes')}
                className="font-bold text-app-accent hover:underline"
              >
                Abrir Extrato Completo →
              </button>
            </div>

            {incomesList.length === 0 ? (
              <p className="text-xs text-app-muted py-6 text-center">
                Nenhuma receita registrada neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="surface-elevated text-[11px] uppercase text-app-muted">
                      <th className="py-3 px-4 rounded-l-xl">Data</th>
                      <th className="py-3 px-4">Descrição da Receita</th>
                      <th className="py-3 px-4">Conta Destino</th>
                      <th className="py-3 px-4">Natureza</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Valor</th>
                      <th className="py-3 px-4 text-center rounded-r-xl">Baixa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {incomesList.map((tx) => {
                      const acc = tx.account_id ? accountMap.get(tx.account_id) : null;
                      const isPaid = tx.status === 'pago';
                      return (
                        <tr key={tx.id} className="hover:bg-app-elevated/40">
                          <td className="py-3 px-4 font-mono text-app-muted whitespace-nowrap">
                            {formatDateBr(tx.data_vencimento)}
                          </td>
                          <td className="py-3 px-4 font-bold text-sm">{tx.descricao}</td>
                          <td className="py-3 px-4 whitespace-nowrap">{acc?.nome || 'Conta Principal'}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {tx.natureza === 'fixa' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap">
                                <Repeat className="w-2.5 h-2.5 shrink-0" />
                                Fixa Mensal
                              </span>
                            ) : tx.natureza === 'parcelada' && tx.parcela_atual ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold badge-amber-executive whitespace-nowrap">
                                <Layers className="w-2.5 h-2.5 shrink-0" />
                                Parcela {tx.parcela_atual}/{tx.total_parcelas}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 whitespace-nowrap">
                                <Shuffle className="w-2.5 h-2.5 shrink-0" />
                                Variável
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'badge-amber-executive'
                              }`}
                            >
                              {isPaid ? 'Realizada (Recebida)' : 'Prevista (A Receber)'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-extrabold text-emerald-400 whitespace-nowrap">
                            + {formatCurrency(tx.valor, currency, hide)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleTransactionStatus(tx.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                                isPaid
                                  ? 'surface-elevated text-emerald-400'
                                  : 'bg-emerald-500 text-zinc-950'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[2.5] shrink-0" />
                              <span>{isPaid ? 'Confirmado' : 'Confirmar'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA/BLOCO 2: DESPESAS FIXAS E VARIÁVEIS DO PERÍODO */}
        {activeBlock === 'despesas_fixas_variaveis' && (
          <div className="space-y-4">
            {fixedAndVariableExpensesList.length === 0 ? (
              <p className="text-xs text-app-muted py-6 text-center">
                Nenhuma despesa fixa ou variável registrada neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="surface-elevated text-[11px] uppercase text-app-muted">
                      <th className="py-3 px-4 rounded-l-xl">Vencimento</th>
                      <th className="py-3 px-4">Despesa</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Natureza</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Valor</th>
                      <th className="py-3 px-4 text-center rounded-r-xl">Baixas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {fixedAndVariableExpensesList.map((tx) => {
                      const cat = categoryMap.get(tx.category_id);
                      const isPaid = tx.status === 'pago';
                      return (
                        <tr key={tx.id} className="hover:bg-app-elevated/40">
                          <td className="py-3 px-4 font-mono text-app-muted whitespace-nowrap">
                            {formatDateBr(tx.data_vencimento)}
                          </td>
                          <td className="py-3 px-4 font-bold text-sm">{tx.descricao}</td>
                          <td className="py-3 px-4 whitespace-nowrap">{cat?.nome || 'Despesa'}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {tx.natureza === 'fixa' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap">
                                <Repeat className="w-2.5 h-2.5 shrink-0" />
                                Fixa Mensal
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 whitespace-nowrap">
                                <Shuffle className="w-2.5 h-2.5 shrink-0" />
                                Variável
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'badge-amber-executive'
                              }`}
                            >
                              {isPaid ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-extrabold text-rose-400 whitespace-nowrap">
                            - {formatCurrency(tx.valor, currency, hide)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleTransactionStatus(tx.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                                isPaid
                                  ? 'surface-elevated text-emerald-400'
                                  : 'bg-emerald-500 text-zinc-950'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[2.5] shrink-0" />
                              <span>{isPaid ? 'Pago' : 'Baixar'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA/BLOCO 3: COMPRAS PARCELADAS ATIVAS E FATURAS DE CARTÃO */}
        {activeBlock === 'parceladas_faturas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-muted">
                Total em Faturas Abertas no Período:{' '}
                <strong className="text-amber-executive">
                  {formatCurrency(kpiMetrics.faturaAtualPendente, currency, hide)}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('contas_cartoes')}
                className="font-bold text-app-accent hover:underline"
              >
                Gerenciar Faturas & Cartões →
              </button>
            </div>

            {installmentsAndCardsList.length === 0 ? (
              <p className="text-xs text-app-muted py-6 text-center">
                Nenhuma compra parcelada ou lançamento de cartão neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="surface-elevated text-[11px] uppercase text-app-muted">
                      <th className="py-3 px-4 rounded-l-xl">Vencimento</th>
                      <th className="py-3 px-4">Compra / Lançamento</th>
                      <th className="py-3 px-4">Cartão / Origem</th>
                      <th className="py-3 px-4">Parcela</th>
                      <th className="py-3 px-4 text-center">Status da Fatura</th>
                      <th className="py-3 px-4 text-center rounded-r-xl">Valor da Parcela</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {installmentsAndCardsList.map((tx) => {
                      const card = tx.credit_card_id
                        ? cardMap.get(tx.credit_card_id)
                        : null;
                      return (
                        <tr key={tx.id} className="hover:bg-app-elevated/40">
                          <td className="py-3 px-4 font-mono text-app-muted whitespace-nowrap">
                            {formatDateBr(tx.data_vencimento)}
                          </td>
                          <td className="py-3 px-4 font-bold text-sm">{tx.descricao}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-amber-executive font-semibold whitespace-nowrap">
                              <CreditCardIcon className="w-3.5 h-3.5 shrink-0" />
                              {card?.nome_cartao || 'Parcelamento Direto'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {tx.parcela_atual ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold badge-amber-executive whitespace-nowrap">
                                <Layers className="w-2.5 h-2.5 shrink-0" />
                                Parcela {tx.parcela_atual}/{tx.total_parcelas}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 whitespace-nowrap">
                                <Banknote className="w-2.5 h-2.5 shrink-0" />
                                À Vista (1x)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
                                tx.status === 'pago'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'badge-amber-executive'
                              }`}
                            >
                              {tx.status === 'pago' ? 'Fatura Paga' : 'Em Aberto'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-extrabold text-amber-executive whitespace-nowrap">
                            {formatCurrency(tx.valor, currency, hide)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA/BLOCO 4: BALANÇO CONSOLIDADO MENSAL (ECONOMIA LÍQUIDA + CAIXINHAS) */}
        {activeBlock === 'balanco_caixinhas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sub-bloco 4.1: Demonstrativo de Economia Líquida & Regra 50-30-20 */}
            <div className="surface-elevated rounded-2xl p-5 space-y-4 border border-app-border">
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-app-accent flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Demonstrativo de Resultado & Economia Líquida
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-app-border">
                  <span className="text-app-muted">(+) Receitas Totais do Período</span>
                  <strong className="text-emerald-400">
                    {formatCurrency(kpiMetrics.receitasTotalPeriodo, currency, hide)}
                  </strong>
                </div>

                <div className="flex justify-between py-2 border-b border-app-border">
                  <span className="text-app-muted">(-) Despesas Totais do Período</span>
                  <strong className="text-rose-400">
                    {formatCurrency(kpiMetrics.despesasTotalPeriodo, currency, hide)}
                  </strong>
                </div>

                <div className="flex justify-between py-2 border-b border-app-border">
                  <span className="font-bold">(=) Economia Líquida Gerada</span>
                  <strong
                    className={`text-sm ${
                      kpiMetrics.economiaLiquidaPeriodo >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(kpiMetrics.economiaLiquidaPeriodo, currency, hide)} (
                    {kpiMetrics.percentualEconomiaLiquida}%)
                  </strong>
                </div>  
              </div>
            </div>

            {/* Sub-bloco 4.2: Reservas */}
            <div className="surface-elevated rounded-2xl p-5 space-y-4 border border-app-border">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-violet-400 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Reservas
                </h4>
                <span className="text-xs font-bold text-emerald-400">
                  Total Guardado: {formatCurrency(totalGuardadoCaixinhas, currency, hide)} /{' '}
                  {formatCurrency(totalMetaCaixinhas, currency, hide)}
                </span>
              </div>

              <div className="space-y-3">
                {financialGoals.map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round((goal.valor_acumulado / goal.valor_meta) * 100)
                  );
                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold">{goal.titulo}</span>
                        <span className="text-app-muted">
                          <strong className="text-app-text">
                            {formatCurrency(goal.valor_acumulado, currency, hide)}
                          </strong>{' '}
                          de {formatCurrency(goal.valor_meta, currency, hide)} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: goal.cor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

