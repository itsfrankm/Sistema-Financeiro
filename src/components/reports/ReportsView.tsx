import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { exportFinancePdf } from '../../utils/exportFinancePdf';
import { formatCurrency, formatMonthYearDisplay, shiftYearMonth } from '../../lib/utils';

type ReportPeriodLabel = 'Diário' | 'Semanal' | 'Mensal' | 'Anual';

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

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const ReportsView: React.FC = () => {
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
    rule503020Summary,
  } = useFinance();

  const [periodLabel, setPeriodLabel] = useState<ReportPeriodLabel>('Mensal');
  const [selectedDay, setSelectedDay] = useState<string>('01');
  const [selectedWeek, setSelectedWeek] = useState<WeekNumber>(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const holderName =
    userSettings.nome_exibicao || currentUser?.nome_exibicao || 'FinPlanner';
  const currency = userSettings.moeda || 'BRL';
  const hide = userSettings.ocultar_valores;
  const [selectedYear, selectedMonthNum] = selectedMonth.split('-');
  const daysInMonth = useMemo(() => {
    const y = Number(selectedYear) || 2026;
    const m = Number(selectedMonthNum) || 1;
    return new Date(y, m, 0).getDate();
  }, [selectedYear, selectedMonthNum]);

  const weekOptions = useMemo(() => getMonthWeeks(daysInMonth), [daysInMonth]);
  const maxWeekInMonth: WeekNumber = daysInMonth > 28 ? 5 : 4;

  // Garante que o dia e a semana permaneçam dentro do limite do mês atual
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
    if (periodLabel === 'Diário') {
      return `Dia ${selectedDay}/${selectedMonthNum}/${selectedYear}`;
    }
    if (periodLabel === 'Semanal') {
      const maxDay = Math.min(activeWeekObj.max, daysInMonth);
      const minStr = String(activeWeekObj.min).padStart(2, '0');
      const maxStr = String(maxDay).padStart(2, '0');
      return `Semana ${selectedWeek} (${minStr} a ${maxStr}/${selectedMonthNum}/${selectedYear})`;
    }
    if (periodLabel === 'Anual') {
      return `Ano ${selectedYear}`;
    }
    return formatMonthYearDisplay(selectedMonth);
  }, [
    periodLabel,
    selectedDay,
    selectedMonthNum,
    selectedYear,
    selectedWeek,
    activeWeekObj,
    daysInMonth,
    selectedMonth,
  ]);

  const periodTxs = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (periodLabel === 'Anual') {
          return tx.data_vencimento.startsWith(selectedYear);
        }
        if (periodLabel === 'Diário') {
          return tx.data_vencimento === `${selectedMonth}-${selectedDay}`;
        }
        if (periodLabel === 'Semanal') {
          if (!tx.data_vencimento.startsWith(selectedMonth)) return false;
          const d = Number(tx.data_vencimento.split('-')[2]);
          return d >= activeWeekObj.min && d <= activeWeekObj.max;
        }
        return tx.data_vencimento.startsWith(selectedMonth);
      })
      .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
  }, [
    transactions,
    periodLabel,
    selectedMonth,
    selectedYear,
    selectedDay,
    activeWeekObj,
  ]);

  const metrics = useMemo(() => {
    const saldoAtual = accounts
      .filter((a) => a.incluir_na_soma_geral)
      .reduce((s, a) => s + a.saldo_atual, 0);

    const receitasRecebidas = periodTxs
      .filter((t) => t.tipo === 'receita' && t.status === 'pago')
      .reduce((s, t) => s + t.valor, 0);
    const receitasPendentes = periodTxs
      .filter((t) => t.tipo === 'receita' && t.status === 'pendente')
      .reduce((s, t) => s + t.valor, 0);
    const receitasTotal = receitasRecebidas + receitasPendentes;

    const despesasPagas = periodTxs
      .filter((t) => t.tipo === 'despesa' && t.status === 'pago')
      .reduce((s, t) => s + t.valor, 0);
    const despesasPendentes = periodTxs
      .filter((t) => t.tipo === 'despesa' && t.status === 'pendente')
      .reduce((s, t) => s + t.valor, 0);
    const despesasTotal = despesasPagas + despesasPendentes;

    const saldoProjetado = saldoAtual + receitasPendentes - despesasPendentes;
    const economiaLiquida = receitasTotal - despesasTotal;
    const pctEconomia =
      receitasTotal > 0 ? ((economiaLiquida / receitasTotal) * 100).toFixed(1) : '0.0';

    return {
      saldoAtual,
      receitasRecebidas,
      receitasPendentes,
      receitasTotal,
      despesasPagas,
      despesasPendentes,
      despesasTotal,
      saldoProjetado,
      economiaLiquida,
      pctEconomia,
    };
  }, [accounts, periodTxs]);

  const periodRuleSummary = useMemo(() => {
    const pctEss = userSettings.pct_essencial ?? 50;
    const pctEst = userSettings.pct_estilo_vida ?? 30;
    const pctFut = userSettings.pct_futuro ?? 20;
    const recTotal = metrics.receitasTotal;

    const calcPilar = (ruleKey: 'essencial_50' | 'estilo_vida_30' | 'futuro_20', targetPct: number) => {
      const gasto = periodTxs
        .filter((tx) => {
          if (tx.tipo !== 'despesa') return false;
          const cat = categories.find((c) => c.id === tx.category_id);
          return cat?.regra_50_30_20 === ruleKey;
        })
        .reduce((s, tx) => s + tx.valor, 0);
      const ideal = (recTotal * targetPct) / 100;
      const percentualReceita = recTotal > 0 ? Math.round((gasto / recTotal) * 100) : 0;
      return { gasto, ideal, percentualReceita, targetPct };
    };

    return {
      essencial_50: calcPilar('essencial_50', pctEss),
      estilo_vida_30: calcPilar('estilo_vida_30', pctEst),
      futuro_20: calcPilar('futuro_20', pctFut),
    };
  }, [periodTxs, categories, metrics.receitasTotal, userSettings]);

  const budgetRows = useMemo(() => {
    return categories
      .filter((c) => c.tipo === 'despesa')
      .map((cat) => {
        const gasto = periodTxs
          .filter((tx) => tx.tipo === 'despesa' && tx.category_id === cat.id)
          .reduce((s, tx) => s + tx.valor, 0);
        const bdg = budgets.find(
          (b) => b.category_id === cat.id && b.mes_ano === selectedMonth
        );
        const teto = bdg?.valor_teto_planejado ?? 0;
        const pct = teto > 0 ? Math.round((gasto / teto) * 100) : gasto > 0 ? 100 : 0;
        return {
          id: cat.id,
          nome: cat.nome,
          regra:
            cat.regra_50_30_20 === 'essencial_50'
              ? '50% Essencial'
              : cat.regra_50_30_20 === 'estilo_vida_30'
              ? '30% Estilo'
              : '20% Futuro',
          gasto,
          teto,
          pct,
        };
      })
      .filter((r) => r.gasto > 0 || r.teto > 0)
      .slice(0, 8);
  }, [categories, periodTxs, budgets, selectedMonth]);

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

  const handleGeneratePdf = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await exportFinancePdf({
        holderName,
        periodLabel,
        selectedMonth,
        customCompetenceLabel: competenceDisplay,
        filteredTransactions: periodTxs,
        userSettings,
        accounts,
        creditCards,
        categories,
        budgets,
        transactions,
        rule503020Summary,
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Barra de Controle de Exportação PDF A4 */}
      <div className="surface-card rounded-3xl p-6 flex flex-col lg:flex-row items-center justify-between gap-4 border border-app-border">
        <div className="text-center lg:text-left shrink-0">
          <h2 className="text-2xl font-extrabold tracking-tight whitespace-nowrap">
            Relatórios Financeiros
          </h2>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-center lg:justify-end gap-2.5">
          {/* 1. Seletor de Período para o PDF */}
          <div className="surface-elevated h-10 p-1 rounded-2xl border border-app-border flex items-center gap-1 shrink-0">
            {(['Diário', 'Semanal', 'Mensal', 'Anual'] as ReportPeriodLabel[]).map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setPeriodLabel(lbl)}
                className={`h-full px-3 rounded-xl text-xs font-bold flex items-center justify-center whitespace-nowrap transition-all ${
                  periodLabel === lbl
                    ? 'btn-primary-theme shadow-md'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* 2. Seletor Específico de Dia, Semana, Mês ou Ano */}
          <div className="surface-elevated h-10 px-3 rounded-2xl border border-app-border flex items-center justify-center gap-2 text-xs shrink-0 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-app-primary shrink-0" />

            {periodLabel === 'Diário' && (
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

            {periodLabel === 'Semanal' && (
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

            {periodLabel === 'Mensal' && (
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

            {periodLabel === 'Anual' && (
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

          {/* 3. Botão Baixar Relatório PDF A4 */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isExporting}
            className="btn-primary-theme h-10 px-5 rounded-2xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 shrink-0 whitespace-nowrap disabled:opacity-60 transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando PDF A4...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Baixar Relatório</span>
              </>
            )}
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Relatório exportado com sucesso!
          </span>
        </div>
      )}

      {/* Preview Visual Fiel da Folha A4 (Cores HEX Sólidas #09090b, #121216, #8b5cf6, #f59e0b, #10b981, #f43f5e, #ffffff) */}
      <div className="overflow-x-auto">
        <div
          className="mx-auto rounded-3xl shadow-2xl border"
          style={{
            maxWidth: '860px',
            backgroundColor: '#09090b',
            color: '#ffffff',
            borderColor: '#27272a',
            padding: '24px',
          }}
        >
          {/* Cabeçalho do Relatório */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-5">
            <div>
              <h3 className="text-xl font-extrabold" style={{ color: '#ffffff' }}>
                Demonstrativo Financeiro Executivo
              </h3>
            </div>

            <div
              className="rounded-xl px-4 py-2.5 text-right"
              style={{ backgroundColor: '#121216', border: '1px solid #27272a' }}
            >
              <div className="text-[10px] font-bold uppercase" style={{ color: '#a1a1aa' }}>
                Período Analítico:{' '}
                <span style={{ color: '#f59e0b' }}>{periodLabel}</span>
              </div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: '#ffffff' }}>
                Competência: {competenceDisplay}
              </div>
              <div className="text-[10px] mt-0.5 flex items-center justify-end gap-1" style={{ color: '#a1a1aa' }}>
                <Calendar className="w-3 h-3" />
                <span>Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* 5 Cards Principais: 4 Indicadores + 5º Card Resumo da Regra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-5">
            <div
              className="rounded-2xl p-3 flex flex-col justify-between"
              style={{
                backgroundColor: '#121216',
                border: '1px solid #27272a',
                borderTop: '3px solid #8b5cf6',
              }}
            >
              <div>
                <div className="text-[9px] font-bold uppercase tracking-tight" style={{ color: '#a1a1aa' }}>
                  Saldo Atual (Realizado)
                </div>
                <div className="text-base font-extrabold mt-1.5" style={{ color: '#ffffff' }}>
                  {formatCurrency(metrics.saldoAtual, currency, hide)}
                </div>
              </div>
              <div className="text-[9px] mt-1.5" style={{ color: '#a1a1aa' }}>
                Contas Bancárias + Carteira Física
              </div>
            </div>

            <div
              className="rounded-2xl p-3 flex flex-col justify-between"
              style={{
                backgroundColor: '#121216',
                border: '1px solid #27272a',
                borderTop: '3px solid #10b981',
              }}
            >
              <div>
                <div className="text-[9px] font-bold uppercase tracking-tight" style={{ color: '#a1a1aa' }}>
                  Receitas do Período
                </div>
                <div className="text-base font-extrabold mt-1.5" style={{ color: '#10b981' }}>
                  {formatCurrency(metrics.receitasTotal, currency, hide)}
                </div>
              </div>
              <div className="text-[9px] mt-1.5 leading-snug" style={{ color: '#a1a1aa' }}>
                Recebido: {formatCurrency(metrics.receitasRecebidas, currency, hide)}
                <br />
                Previsto: {formatCurrency(metrics.receitasPendentes, currency, hide)}
              </div>
            </div>

            <div
              className="rounded-2xl p-3 flex flex-col justify-between"
              style={{
                backgroundColor: '#121216',
                border: '1px solid #27272a',
                borderTop: '3px solid #f43f5e',
              }}
            >
              <div>
                <div className="text-[9px] font-bold uppercase tracking-tight" style={{ color: '#a1a1aa' }}>
                  Despesas do Período
                </div>
                <div className="text-base font-extrabold mt-1.5" style={{ color: '#f43f5e' }}>
                  {formatCurrency(metrics.despesasTotal, currency, hide)}
                </div>
              </div>
              <div className="text-[9px] mt-1.5 leading-snug" style={{ color: '#a1a1aa' }}>
                Pago: {formatCurrency(metrics.despesasPagas, currency, hide)}
                <br />
                Previsto: {formatCurrency(metrics.despesasPendentes, currency, hide)}
              </div>
            </div>

            <div
              className="rounded-2xl p-3 flex flex-col justify-between"
              style={{
                backgroundColor: '#121216',
                border: '1px solid #f59e0b',
                borderTop: '3px solid #f59e0b',
              }}
            >
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-tight" style={{ color: '#f59e0b' }}>
                  Saldo Projetado
                </div>
                <div className="text-base font-extrabold mt-1.5" style={{ color: '#ffffff' }}>
                  {formatCurrency(metrics.saldoProjetado, currency, hide)}
                </div>
              </div>
              <div className="text-[9px] font-bold mt-1.5 leading-snug" style={{ color: '#f59e0b' }}>
                Economia Líquida: {metrics.pctEconomia}%
                <br />({formatCurrency(metrics.economiaLiquida, currency, hide)})
              </div>
            </div>

            {/* 5º Card: Resumo da Regra */}
            <div
              className="rounded-2xl p-3 flex flex-col justify-between space-y-1.5"
              style={{
                backgroundColor: '#121216',
                border: '1px solid #27272a',
                borderTop: '3px solid #38bdf8',
              }}
            >
              <div
                className="text-[9px] font-extrabold uppercase tracking-tight pb-1"
                style={{ color: '#ffffff', borderBottom: '1px solid #27272a' }}
              >
                Resumo da Regra
              </div>

              <div className="space-y-1.5">
                {[
                  {
                    label: 'Essencial',
                    color: '#8b5cf6',
                    data: periodRuleSummary.essencial_50,
                  },
                  {
                    label: 'Estilo',
                    color: '#f59e0b',
                    data: periodRuleSummary.estilo_vida_30,
                  },
                  {
                    label: 'Futuro',
                    color: '#10b981',
                    data: periodRuleSummary.futuro_20,
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-1 text-[8.5px] font-bold">
                      <span className="truncate" style={{ color: item.color }}>
                        {item.label}
                      </span>
                      <span className="whitespace-nowrap" style={{ color: '#ffffff' }}>
                        {formatCurrency(item.data.gasto, currency, hide)} ({item.data.percentualReceita}%)
                      </span>
                    </div>
                    <div
                      className="w-full h-1 rounded-full overflow-hidden"
                      style={{ backgroundColor: '#09090b' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (item.data.percentualReceita / (item.data.targetPct || 1)) * 100)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Teto de Orçamento por Categoria (Largura Total 100% Mais Detalhado) */}
          <div
            className="rounded-2xl p-4 mb-5 break-inside-avoid"
            style={{ backgroundColor: '#121216', border: '1px solid #27272a' }}
          >
            <div
              className="text-xs font-extrabold uppercase pb-2 mb-2 flex items-center justify-between"
              style={{ color: '#ffffff', borderBottom: '1px solid #27272a' }}
            >
              <span>Teto de Orçamento por Categoria</span>
              <span className="text-[10px] font-normal normal-case" style={{ color: '#a1a1aa' }}>
                Acompanhamento detalhado de gastos por categoria e limite mensal
              </span>
            </div>

            <table className="w-full table-fixed text-xs">
              <thead>
                <tr style={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>
                  <th className="w-[38%] py-2 pr-4 text-left">Categoria</th>
                  <th className="w-[22%] py-2 px-3 text-left">Bloco</th>
                  <th className="w-[20%] py-2 px-4 text-right">Gasto</th>
                  <th className="w-[20%] py-2 pl-4 text-right">Teto</th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((b) => {
                  const statusColor =
                    b.teto > 0 && b.pct >= 100
                      ? '#f43f5e'
                      : b.teto > 0 && b.pct >= 75
                      ? '#f59e0b'
                      : '#10b981';
                  return (
                    <tr
                      key={b.id}
                      className="break-inside-avoid"
                      style={{ borderBottom: '1px solid #27272a' }}
                    >
                      <td className="py-2 pr-4 font-bold truncate" style={{ color: '#ffffff' }}>
                        {b.nome}
                      </td>
                      <td className="py-2 px-3 truncate" style={{ color: '#a1a1aa' }}>
                        {b.regra}
                      </td>
                      <td
                        className="py-2 px-4 text-right font-bold whitespace-nowrap"
                        style={{ color: statusColor }}
                      >
                        {formatCurrency(b.gasto, currency, hide)}
                      </td>
                      <td className="py-2 pl-4 text-right whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                        {b.teto > 0 ? formatCurrency(b.teto, currency, hide) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tabela de Lançamentos do Período (Página 1: até 14 lançamentos) */}
          <div
            className="rounded-2xl p-4 break-inside-avoid"
            style={{ backgroundColor: '#121216', border: '1px solid #27272a' }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2"
              style={{ borderBottom: '1px solid #27272a' }}
            >
              <span className="text-xs font-extrabold uppercase" style={{ color: '#ffffff' }}>
                Extrato de Lançamentos do Período
              </span>
            </div>

            <table className="w-full table-fixed text-xs">
              <thead>
                <tr
                  className="uppercase text-[10px]"
                  style={{ backgroundColor: '#09090b', color: '#a1a1aa' }}
                >
                  <th className="w-[12%] py-2 px-2 text-left whitespace-nowrap">Data</th>
                  <th className="w-[27%] py-2 px-2 text-left">Descrição</th>
                  <th className="w-[17%] py-2 px-2 text-left">Categoria</th>
                  <th className="w-[17%] py-2 px-2 text-left">Conta / Cartão</th>
                  <th className="w-[10%] py-2 px-2 text-left whitespace-nowrap">Status</th>
                  <th className="w-[17%] py-2 px-2 text-right whitespace-nowrap">Valor</th>
                </tr>
              </thead>
              <tbody>
                {periodTxs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-xs"
                      style={{ color: '#a1a1aa' }}
                    >
                      Nenhum lançamento registrado neste período.
                    </td>
                  </tr>
                ) : (
                  periodTxs.slice(0, 14).map((tx) => {
                    const cat = categoryMap.get(tx.category_id);
                    const originName = tx.credit_card_id
                      ? cardMap.get(tx.credit_card_id)?.nome_cartao || 'Cartão'
                      : tx.account_id
                      ? accountMap.get(tx.account_id)?.nome || 'Conta'
                      : 'Conta';
                    const valColor =
                      tx.tipo === 'receita'
                        ? '#10b981'
                        : tx.tipo === 'transferencia'
                        ? '#8b5cf6'
                        : '#f43f5e';
                    const prefix =
                      tx.tipo === 'receita' ? '+ ' : tx.tipo === 'transferencia' ? '⇄ ' : '- ';
                    const parcelaSuffix =
                      tx.natureza === 'parcelada' && tx.parcela_atual
                        ? ` (${tx.parcela_atual}/${tx.total_parcelas})`
                        : '';

                    return (
                      <tr
                        key={tx.id}
                        className="break-inside-avoid"
                        style={{ borderBottom: '1px solid #27272a' }}
                      >
                        <td
                          className="py-1.5 px-2 font-mono text-[11px] whitespace-nowrap"
                          style={{ color: '#a1a1aa' }}
                        >
                          {formatDateBr(tx.data_vencimento)}
                        </td>
                        <td className="py-1.5 px-2 font-bold truncate" style={{ color: '#ffffff' }}>
                          {tx.descricao}
                          {parcelaSuffix}
                        </td>
                        <td className="py-1.5 px-2 truncate" style={{ color: '#a1a1aa' }}>
                          {cat?.nome || 'Transferência'}
                        </td>
                        <td className="py-1.5 px-2 truncate" style={{ color: '#a1a1aa' }}>
                          {originName}
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <span
                            className="font-bold text-[11px] whitespace-nowrap"
                            style={{ color: tx.status === 'pago' ? '#10b981' : '#f59e0b' }}
                          >
                            {tx.status === 'pago' ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td
                          className="py-1.5 px-2 text-right font-extrabold whitespace-nowrap"
                          style={{ color: valColor }}
                        >
                          {prefix}
                          {formatCurrency(tx.valor, currency, hide)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Página 1 */}
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]"
            style={{ color: '#a1a1aa' }}
          >
          </div>
        </div>

        {/* PÁGINAS COMPLEMENTARES (PÁGINA 2, 3, ...): Quando houver mais de 14 lançamentos */}
        {Array.from(
          { length: Math.ceil(Math.max(0, periodTxs.length - 14) / 28) },
          (_, pageIdx) => {
            const startIdx = 14 + pageIdx * 28;
            const pageRows = periodTxs.slice(startIdx, startIdx + 28);
            const pageNum = pageIdx + 2;
            const totalPages = 1 + Math.ceil(Math.max(0, periodTxs.length - 14) / 28);

            return (
              <div
                key={`continuation-page-${pageNum}`}
                className="mx-auto rounded-3xl shadow-2xl border mt-6"
                style={{
                  maxWidth: '860px',
                  backgroundColor: '#09090b',
                  color: '#ffffff',
                  borderColor: '#27272a',
                  padding: '24px',
                }}
              >
                {/* Cabeçalho Compacto da Página de Continuação */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-4"
                  style={{ borderBottom: '2px solid #8b5cf6' }}
                >
                  <div>
                    <h4 className="text-base font-extrabold" style={{ color: '#ffffff' }}>
                      Planejamento & Demonstrativo Financeiro
                    </h4>
                  </div>

                  <div
                    className="rounded-xl px-3.5 py-2 text-right"
                    style={{ backgroundColor: '#121216', border: '1px solid #27272a' }}
                  >
                    <div className="text-[10px] font-bold uppercase" style={{ color: '#a1a1aa' }}>
                      Período: <span style={{ color: '#f59e0b' }}>{periodLabel}</span>
                    </div>
                    <div className="text-xs font-extrabold mt-0.5" style={{ color: '#ffffff' }}>
                      Competência: {competenceDisplay}
                    </div>
                  </div>
                </div>

                {/* Tabela de Continuação dos Lançamentos */}
                <div
                  className="rounded-2xl p-4 break-inside-avoid"
                  style={{ backgroundColor: '#121216', border: '1px solid #27272a' }}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2"
                    style={{ borderBottom: '1px solid #27272a' }}
                  >
                    <span className="text-xs font-extrabold uppercase" style={{ color: '#ffffff' }}>
                      Extrato de Lançamentos do Período
                    </span>
                  </div>

                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <tr
                        className="uppercase text-[10px]"
                        style={{ backgroundColor: '#09090b', color: '#a1a1aa' }}
                      >
                        <th className="w-[12%] py-2 px-2 text-left whitespace-nowrap">Data</th>
                        <th className="w-[27%] py-2 px-2 text-left">Descrição</th>
                        <th className="w-[17%] py-2 px-2 text-left">Categoria</th>
                        <th className="w-[17%] py-2 px-2 text-left">Conta / Cartão</th>
                        <th className="w-[10%] py-2 px-2 text-left whitespace-nowrap">Status</th>
                        <th className="w-[17%] py-2 px-2 text-right whitespace-nowrap">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((tx) => {
                        const cat = categoryMap.get(tx.category_id);
                        const originName = tx.credit_card_id
                          ? cardMap.get(tx.credit_card_id)?.nome_cartao || 'Cartão'
                          : tx.account_id
                          ? accountMap.get(tx.account_id)?.nome || 'Conta'
                          : 'Conta';
                        const valColor =
                          tx.tipo === 'receita'
                            ? '#10b981'
                            : tx.tipo === 'transferencia'
                            ? '#8b5cf6'
                            : '#f43f5e';
                        const prefix =
                          tx.tipo === 'receita'
                            ? '+ '
                            : tx.tipo === 'transferencia'
                            ? '⇄ '
                            : '- ';
                        const parcelaSuffix =
                          tx.natureza === 'parcelada' && tx.parcela_atual
                            ? ` (${tx.parcela_atual}/${tx.total_parcelas})`
                            : '';

                        return (
                          <tr
                            key={tx.id}
                            className="break-inside-avoid"
                            style={{ borderBottom: '1px solid #27272a' }}
                          >
                            <td
                              className="py-1.5 px-2 font-mono text-[11px] whitespace-nowrap"
                              style={{ color: '#a1a1aa' }}
                            >
                              {formatDateBr(tx.data_vencimento)}
                            </td>
                            <td
                              className="py-1.5 px-2 font-bold truncate"
                              style={{ color: '#ffffff' }}
                            >
                              {tx.descricao}
                              {parcelaSuffix}
                            </td>
                            <td className="py-1.5 px-2 truncate" style={{ color: '#a1a1aa' }}>
                              {cat?.nome || 'Transferência'}
                            </td>
                            <td className="py-1.5 px-2 truncate" style={{ color: '#a1a1aa' }}>
                              {originName}
                            </td>
                            <td className="py-1.5 px-2 whitespace-nowrap">
                              <span
                                className="font-bold text-[11px] whitespace-nowrap"
                                style={{
                                  color: tx.status === 'pago' ? '#10b981' : '#f59e0b',
                                }}
                              >
                                {tx.status === 'pago' ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            <td
                              className="py-1.5 px-2 text-right font-extrabold whitespace-nowrap"
                              style={{ color: valColor }}
                            >
                              {prefix}
                              {formatCurrency(tx.valor, currency, hide)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé da Página de Continuação */}
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]"
                  style={{ color: '#a1a1aa' }}
                >
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};
