import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Target,
  Sliders,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Tag,
  ShieldCheck,
  Plane,
  Laptop,
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
  Briefcase,
  X,
  Check,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useFinance } from '../../context/FinanceContext';
import {
  Category,
  CategoryType,
  FinancialGoal,
  Rule503020,
} from '../../types/finance';
import { formatCurrency, formatMonthYearDisplay } from '../../lib/utils';

const ICON_OPTIONS: { name: string; icon: React.ElementType }[] = [
  { name: 'Home', icon: Home },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Car', icon: Car },
  { name: 'HeartPulse', icon: HeartPulse },
  { name: 'Zap', icon: Zap },
  { name: 'Utensils', icon: Utensils },
  { name: 'Compass', icon: Compass },
  { name: 'Tv', icon: Tv },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'PiggyBank', icon: PiggyBank },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Laptop', icon: Laptop },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'Plane', icon: Plane },
  { name: 'Target', icon: Target },
  { name: 'Tag', icon: Tag },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map((item) => [item.name, item.icon])
);

const COLOR_SWATCHES = [
  '#8b5cf6',
  '#a855f7',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#14b8a6',
];

function calculateMonthsRemaining(targetIsoDate: string): number {
  const now = new Date();
  const [yearStr, monthStr] = targetIsoDate.split('-');
  const targetYear = Number(yearStr);
  const targetMonth = Number(monthStr) - 1;
  if (Number.isNaN(targetYear) || Number.isNaN(targetMonth)) return 1;

  const diffMonths =
    (targetYear - now.getFullYear()) * 12 + (targetMonth - now.getMonth());
  return Math.max(1, diffMonths);
}

export const PlanningView: React.FC = () => {
  const {
    categories,
    budgets,
    transactions,
    financialGoals,
    selectedMonth,
    userSettings,
    updateUserSettings,
    receitasMes,
    despesasMes,
    rule503020Summary,
    upsertBudget,
    deleteBudget,
    addCategory,
    updateCategory,
    deleteCategory,
    addFinancialGoal,
    updateFinancialGoal,
    contributeToGoal,
    deleteFinancialGoal,
  } = useFinance();

  const hide = userSettings.ocultar_valores;
  const currency = userSettings.moeda;
  const isRuleEnabled = Boolean(userSettings.usar_regra_50_30_20);

  const pctEssencial = userSettings.pct_essencial ?? 50;
  const pctEstilo = userSettings.pct_estilo_vida ?? 30;
  const pctFuturo = userSettings.pct_futuro ?? 20;

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const notify = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Estado para configurar as porcentagens dos 3 pilares (ex: 50 / 30 / 20 ou personalizado)
  const [isCustomizingPillarPcts, setIsCustomizingPillarPcts] = useState(false);
  const [inputPctEssencial, setInputPctEssencial] = useState(String(pctEssencial));
  const [inputPctEstilo, setInputPctEstilo] = useState(String(pctEstilo));
  const [inputPctFuturo, setInputPctFuturo] = useState(String(pctFuturo));

  const ruleMetaDynamic: Record<
    Rule503020,
    {
      title: string;
      shortBadge: string;
      subtitle: string;
      targetPct: number;
      color: string;
      badgeClass: string;
    }
  > = useMemo(
    () => ({
      essencial_50: {
        title: `${pctEssencial}% Necessidades Essenciais`,
        shortBadge: `${pctEssencial}% Essencial`,
        subtitle: 'Moradia, Contas, Alimentação, Transporte, Saúde',
        targetPct: pctEssencial,
        color: '#8b5cf6',
        badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
      },
      estilo_vida_30: {
        title: `${pctEstilo}% Estilo de Vida e Desejos`,
        shortBadge: `${pctEstilo}% Estilo de Vida`,
        subtitle: 'Lazer, Restaurantes, Assinaturas, Compras pessoais',
        targetPct: pctEstilo,
        color: '#d97706',
        badgeClass: 'badge-amber-executive',
      },
      futuro_20: {
        title: `${pctFuturo}% Futuro, Caixinhas e Quitação`,
        shortBadge: `${pctFuturo}% Futuro & Metas`,
        subtitle: 'Investimentos, Reserva de Emergência, Metas',
        targetPct: pctFuturo,
        color: '#10b981',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      },
    }),
    [pctEssencial, pctEstilo, pctFuturo]
  );

  // ==========================================================================
  // 1. ESTADOS DE META / LIMITE POR CATEGORIA & MODAL DE CATEGORIA
  // ==========================================================================
  const [editingBudgetCat, setEditingBudgetCat] = useState<{
    category: Category;
    currentLimit: number;
    currentPercent: number | null;
  } | null>(null);
  const [limitMode, setLimitMode] = useState<'none' | 'percent' | 'fixed'>('none');
  const [budgetInputVal, setBudgetInputVal] = useState('');
  const [budgetPercentVal, setBudgetPercentVal] = useState('');

  // Modal Criar / Editar Categoria (Simples ou com Porcentagem/Pilar opcional)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<CategoryType>('despesa');
  const [catRegra, setCatRegra] = useState<Rule503020 | 'nenhum'>('nenhum');
  const [catPercentualMeta, setCatPercentualMeta] = useState<string>('');
  const [catIcone, setCatIcone] = useState('Tag');
  const [catCor, setCatCor] = useState('#8b5cf6');

  // ==========================================================================
  // 2. ESTADOS DE CAIXINHAS E METAS FINANCEIRAS (FINANCIAL GOALS)
  // ==========================================================================
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [goalTitulo, setGoalTitulo] = useState('');
  const [goalValorMeta, setGoalValorMeta] = useState('');
  const [goalValorAcumulado, setGoalValorAcumulado] = useState('0');
  const [goalDataAlvo, setGoalDataAlvo] = useState('2027-12-31');
  const [goalCor, setGoalCor] = useState('#8b5cf6');
  const [goalIcone, setGoalIcone] = useState('ShieldCheck');

  const [goalOperation, setGoalOperation] = useState<{
    goal: FinancialGoal;
    mode: 'deposit' | 'withdraw';
  } | null>(null);
  const [operationAmount, setOperationAmount] = useState('');

  // ==========================================================================
  // CÁLCULO DAS CATEGORIAS DE DESPESA (CATEGORIZAÇÃO LIVRE + % AUTOMÁTICA)
  // ==========================================================================
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.tipo === 'despesa'),
    [categories]
  );

  const categoryBudgetsData = useMemo(() => {
    const monthExpenses = transactions.filter(
      (tx) => tx.tipo === 'despesa' && tx.data_vencimento.startsWith(selectedMonth)
    );

    const totalDespesas = despesasMes > 0 ? despesasMes : 1;
    const baseReceita = receitasMes > 0 ? receitasMes : 0;

    return expenseCategories.map((cat) => {
      const gastoAtual = Number(
        monthExpenses
          .filter((tx) => tx.category_id === cat.id)
          .reduce((sum, tx) => sum + tx.valor, 0)
          .toFixed(2)
      );

      const budgetObj = budgets.find(
        (b) => b.category_id === cat.id && b.mes_ano === selectedMonth
      );

      // Se a categoria possui uma porcentagem definida pelo usuário (ex: 15% da renda),
      // o teto planejado se ajusta automaticamente com base na receita do mês!
      const hasPercentRule =
        typeof cat.percentual_meta === 'number' && cat.percentual_meta > 0;

      const tetoPlanejado = hasPercentRule
        ? Number(((baseReceita * (cat.percentual_meta ?? 0)) / 100).toFixed(2))
        : budgetObj?.valor_teto_planejado ?? 0;

      const saldoRestante = Number((tetoPlanejado - gastoAtual).toFixed(2));
      const percentualUsoTeto =
        tetoPlanejado > 0
          ? Number(((gastoAtual / tetoPlanejado) * 100).toFixed(1))
          : 0;

      // Participação da categoria no total de gastos do mês (para modo categorização pura)
      const participacaoNosGastos =
        gastoAtual > 0 ? Number(((gastoAtual / totalDespesas) * 100).toFixed(1)) : 0;

      const participacaoNaReceita =
        baseReceita > 0 ? Number(((gastoAtual / baseReceita) * 100).toFixed(1)) : 0;

      let statusLevel: 'healthy' | 'warning' | 'exceeded' | 'unplanned' = 'unplanned';
      if (tetoPlanejado > 0 || hasPercentRule) {
        if (tetoPlanejado > 0 && percentualUsoTeto >= 100) statusLevel = 'exceeded';
        else if (tetoPlanejado > 0 && percentualUsoTeto >= 75) statusLevel = 'warning';
        else statusLevel = 'healthy';
      }

      return {
        category: cat,
        budgetId: budgetObj?.id ?? null,
        hasPercentRule,
        gastoAtual,
        tetoPlanejado,
        saldoRestante,
        percentual: percentualUsoTeto,
        participacaoNosGastos,
        participacaoNaReceita,
        statusLevel,
      };
    });
  }, [expenseCategories, transactions, budgets, selectedMonth, despesasMes, receitasMes]);

  // Dados para o Gráfico de Barras Comparativo dos Pilares (Recharts)
  const chartData503020 = useMemo(() => {
    return [
      {
        name: `${pctEssencial}% Essenciais`,
        Ideal: Number(rule503020Summary.essencial_50.ideal.toFixed(2)),
        Real: Number(rule503020Summary.essencial_50.gasto.toFixed(2)),
      },
      {
        name: `${pctEstilo}% Estilo de Vida`,
        Ideal: Number(rule503020Summary.estilo_vida_30.ideal.toFixed(2)),
        Real: Number(rule503020Summary.estilo_vida_30.gasto.toFixed(2)),
      },
      {
        name: `${pctFuturo}% Futuro & Metas`,
        Ideal: Number(rule503020Summary.futuro_20.ideal.toFixed(2)),
        Real: Number(rule503020Summary.futuro_20.gasto.toFixed(2)),
      },
    ];
  }, [rule503020Summary, pctEssencial, pctEstilo, pctFuturo]);

  // Diagnóstico Inteligente ajustado às porcentagens definidas pelo usuário
  const diagnosticMessages = useMemo(() => {
    const alerts: { type: 'ok' | 'warn' | 'danger'; title: string; detail: string }[] = [];

    if (receitasMes <= 0) {
      alerts.push({
        type: 'warn',
        title: 'Sem receitas registradas neste mês',
        detail:
          'Registre sua renda/salário do mês para que os limites percentuais sejam calculados automaticamente.',
      });
      return alerts;
    }

    if (rule503020Summary.essencial_50.percentualReceita > pctEssencial) {
      alerts.push({
        type: 'danger',
        title: `Pilar ${pctEssencial}% Essenciais acima do limite (${rule503020Summary.essencial_50.percentualReceita}%)`,
        detail: `Seus custos essenciais superaram o limite configurado de ${formatCurrency(
          rule503020Summary.essencial_50.ideal,
          currency,
          hide
        )} em ${formatCurrency(
          rule503020Summary.essencial_50.gasto - rule503020Summary.essencial_50.ideal,
          currency,
          hide
        )}.`,
      });
    } else {
      alerts.push({
        type: 'ok',
        title: `Pilar ${pctEssencial}% Essenciais sob controle (${rule503020Summary.essencial_50.percentualReceita}%)`,
        detail: `Folga disponível de ${formatCurrency(
          Math.max(0, rule503020Summary.essencial_50.ideal - rule503020Summary.essencial_50.gasto),
          currency,
          hide
        )} dentro da meta de ${pctEssencial}%.`,
      });
    }

    if (rule503020Summary.estilo_vida_30.percentualReceita > pctEstilo) {
      alerts.push({
        type: 'danger',
        title: `Pilar ${pctEstilo}% Estilo de Vida acima do limite (${rule503020Summary.estilo_vida_30.percentualReceita}%)`,
        detail: `Seus gastos ultrapassaram a meta configurada de ${pctEstilo}% (${formatCurrency(
          rule503020Summary.estilo_vida_30.ideal,
          currency,
          hide
        )}).`,
      });
    } else {
      alerts.push({
        type: 'ok',
        title: `Pilar ${pctEstilo}% Estilo de Vida saudável (${rule503020Summary.estilo_vida_30.percentualReceita}%)`,
        detail: `Seus gastos estão dentro do limite planejado de ${pctEstilo}% da renda.`,
      });
    }

    if (rule503020Summary.futuro_20.percentualReceita < pctFuturo) {
      alerts.push({
        type: 'warn',
        title: `Aportes para o Futuro em ${rule503020Summary.futuro_20.percentualReceita}% (Meta: ${pctFuturo}%)`,
        detail: `Faltam ${formatCurrency(
          Math.max(0, rule503020Summary.futuro_20.ideal - rule503020Summary.futuro_20.gasto),
          currency,
          hide
        )} neste mês para atingir os ${pctFuturo}% planejados.`,
      });
    } else {
      alerts.push({
        type: 'ok',
        title: `Meta de ${pctFuturo}% para o Futuro atingida (${rule503020Summary.futuro_20.percentualReceita}%)`,
        detail: `Você já destinou ${formatCurrency(
          rule503020Summary.futuro_20.gasto,
          currency,
          hide
        )} para investimentos e reservas neste mês.`,
      });
    }

    return alerts;
  }, [receitasMes, rule503020Summary, currency, hide, pctEssencial, pctEstilo, pctFuturo]);

  // ==========================================================================
  // HANDLERS: PORCENTAGENS DOS PILARES, LIMITES DE CATEGORIA E CATEGORIAS
  // ==========================================================================
  const handleToggleRuleEnabled = () => {
    const nextState = !isRuleEnabled;
    updateUserSettings({ usar_regra_50_30_20: nextState });
    notify(
      nextState
        ? 'Divisão por pilares de porcentagem ativada!'
        : 'Modo Categorização Livre ativado (sem exigência de pilares).'
    );
  };

  const handleSaveCustomPillarPcts = (e: React.FormEvent) => {
    e.preventDefault();
    const ePct = Math.max(0, Math.min(100, Number(inputPctEssencial) || 0));
    const sPct = Math.max(0, Math.min(100, Number(inputPctEstilo) || 0));
    const fPct = Math.max(0, Math.min(100, Number(inputPctFuturo) || 0));

    updateUserSettings({
      pct_essencial: ePct,
      pct_estilo_vida: sPct,
      pct_futuro: fPct,
      usar_regra_50_30_20: true,
    });
    setIsCustomizingPillarPcts(false);
    notify(`Proporção atualizada para ${ePct}% / ${sPct}% / ${fPct}% em todo o aplicativo!`);
  };

  const handleOpenLimitModal = (
    cat: Category,
    currentFixedLimit: number,
    currentPercent: number | null
  ) => {
    setEditingBudgetCat({
      category: cat,
      currentLimit: currentFixedLimit,
      currentPercent,
    });
    if (typeof currentPercent === 'number' && currentPercent > 0) {
      setLimitMode('percent');
      setBudgetPercentVal(String(currentPercent));
      setBudgetInputVal(
        String(Number(((receitasMes * currentPercent) / 100).toFixed(2)))
      );
    } else if (currentFixedLimit > 0) {
      setLimitMode('fixed');
      setBudgetInputVal(String(currentFixedLimit));
      setBudgetPercentVal('');
    } else {
      setLimitMode('none');
      setBudgetInputVal('');
      setBudgetPercentVal('');
    }
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudgetCat) return;
    const cat = editingBudgetCat.category;

    if (limitMode === 'none') {
      updateCategory(cat.id, { percentual_meta: null });
      const existingBdg = budgets.find(
        (b) => b.category_id === cat.id && b.mes_ano === selectedMonth
      );
      if (existingBdg) {
        deleteBudget(existingBdg.id);
      }
      notify(`"${cat.nome}" configurada apenas para categorização livre (sem limite fixo ou %).`);
    } else if (limitMode === 'percent') {
      const pct = Math.max(0.1, Math.min(100, parseFloat(budgetPercentVal.replace(',', '.')) || 0));
      updateCategory(cat.id, { percentual_meta: pct });
      const calculatedLimit = Number(((receitasMes * pct) / 100).toFixed(2));
      upsertBudget(cat.id, selectedMonth, calculatedLimit);
      notify(
        `Meta de "${cat.nome}" definida em ${pct}% da receita (${formatCurrency(
          calculatedLimit,
          currency
        )} neste mês)!`
      );
    } else {
      const numericLimit = Math.max(0, parseFloat(budgetInputVal.replace(',', '.')) || 0);
      updateCategory(cat.id, { percentual_meta: null });
      upsertBudget(cat.id, selectedMonth, numericLimit);
      notify(
        `Limite de "${cat.nome}" atualizado para ${formatCurrency(
          numericLimit,
          currency
        )} em ${formatMonthYearDisplay(selectedMonth)}!`
      );
    }
    setEditingBudgetCat(null);
  };

  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCatNome('');
    setCatTipo('despesa');
    setCatRegra('nenhum');
    setCatPercentualMeta('');
    setCatIcone('Tag');
    setCatCor('#8b5cf6');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatNome(cat.nome);
    setCatTipo(cat.tipo);
    setCatRegra(cat.regra_50_30_20 ?? 'nenhum');
    setCatPercentualMeta(
      typeof cat.percentual_meta === 'number' && cat.percentual_meta > 0
        ? String(cat.percentual_meta)
        : ''
    );
    setCatIcone(cat.icone);
    setCatCor(cat.cor);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (catNome.trim().length < 2) return;

    const parsedPct = parseFloat(catPercentualMeta.replace(',', '.'));
    const validPct =
      !Number.isNaN(parsedPct) && parsedPct > 0 && parsedPct <= 100
        ? Number(parsedPct.toFixed(1))
        : null;
    const validRegra: Rule503020 | null =
      catRegra === 'nenhum' ? null : catRegra;

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        nome: catNome.trim(),
        tipo: catTipo,
        regra_50_30_20: validRegra,
        percentual_meta: validPct,
        icone: catIcone,
        cor: catCor,
      });
      notify(`Categoria "${catNome.trim()}" atualizada!`);
    } else {
      addCategory({
        nome: catNome.trim(),
        tipo: catTipo,
        regra_50_30_20: validRegra,
        percentual_meta: validPct,
        icone: catIcone,
        cor: catCor,
      });
      notify(`Nova categoria "${catNome.trim()}" criada!`);
    }

    setIsCategoryModalOpen(false);
  };

  // ==========================================================================
  // HANDLERS: CAIXINHAS E METAS FINANCEIRAS (FINANCIAL GOALS)
  // ==========================================================================
  const handleOpenNewGoal = () => {
    setEditingGoal(null);
    setGoalTitulo('');
    setGoalValorMeta('');
    setGoalValorAcumulado('0');
    setGoalDataAlvo('2027-12-31');
    setGoalCor('#8b5cf6');
    setGoalIcone('ShieldCheck');
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setGoalTitulo(goal.titulo);
    setGoalValorMeta(String(goal.valor_meta));
    setGoalValorAcumulado(String(goal.valor_acumulado));
    setGoalDataAlvo(goal.data_alvo);
    setGoalCor(goal.cor);
    setGoalIcone(goal.icone);
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const valorMetaNum = parseFloat(goalValorMeta.replace(',', '.')) || 0;
    const valorAcumNum = parseFloat(goalValorAcumulado.replace(',', '.')) || 0;
    if (goalTitulo.trim().length < 2 || valorMetaNum <= 0) return;

    if (editingGoal) {
      updateFinancialGoal(editingGoal.id, {
        titulo: goalTitulo.trim(),
        valor_meta: valorMetaNum,
        valor_acumulado: Math.max(0, valorAcumNum),
        data_alvo: goalDataAlvo,
        cor: goalCor,
        icone: goalIcone,
      });
      notify(`Caixinha "${goalTitulo.trim()}" atualizada!`);
    } else {
      addFinancialGoal({
        titulo: goalTitulo.trim(),
        valor_meta: valorMetaNum,
        valor_acumulado: Math.max(0, valorAcumNum),
        data_alvo: goalDataAlvo,
        cor: goalCor,
        icone: goalIcone,
      });
      notify(`Nova Caixinha "${goalTitulo.trim()}" criada com sucesso!`);
    }

    setIsGoalModalOpen(false);
  };

  const handleConfirmGoalOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalOperation) return;
    const val = parseFloat(operationAmount.replace(',', '.'));
    if (Number.isNaN(val) || val <= 0) return;

    const signedDelta = goalOperation.mode === 'deposit' ? val : -val;
    contributeToGoal(goalOperation.goal.id, signedDelta);

    notify(
      goalOperation.mode === 'deposit'
        ? `+ ${formatCurrency(val, currency)} guardados na caixinha "${goalOperation.goal.titulo}"!`
        : `- ${formatCurrency(val, currency)} resgatados da caixinha "${goalOperation.goal.titulo}".`
    );
    setGoalOperation(null);
    setOperationAmount('');
  };

  return (
    <div className="space-y-8">
      {/* Notificação Flutuante */}
      {feedbackMsg && (
        <div className="rounded-2xl p-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 rounded-lg hover:bg-black/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          SEÇÃO 1 (PRINCIPAL): CATEGORIZAÇÃO DE GASTOS & PORCENTAGENS OPCIONAIS
          ===================================================================== */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Categorias de Despesas & Limites Opcionais
            </h2>
          </div>

          <button
            type="button"
            onClick={handleOpenNewCategory}
            className="btn-primary-theme px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Categoria</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryBudgetsData.map(
            ({
              category,
              hasPercentRule,
              gastoAtual,
              tetoPlanejado,
              saldoRestante,
              percentual,
              participacaoNosGastos,
              participacaoNaReceita,
              statusLevel,
            }) => {
              const CatIcon = ICON_MAP[category.icone] || Tag;
              const ruleKey = category.regra_50_30_20;
              const ruleInfo = ruleKey ? ruleMetaDynamic[ruleKey] : null;
              const hasActiveLimit = tetoPlanejado > 0 || hasPercentRule;

              const barColor =
                statusLevel === 'exceeded'
                  ? '#f43f5e'
                  : statusLevel === 'warning'
                  ? '#d97706'
                  : statusLevel === 'healthy'
                  ? '#10b981'
                  : category.cor;

              const statusBadge =
                statusLevel === 'exceeded'
                  ? {
                      text: 'Limite Excedido',
                      cls: 'bg-rose-500/15 text-rose-400 border-rose-500/35',
                    }
                  : statusLevel === 'warning'
                  ? {
                      text: 'Alerta (75%+)',
                      cls: 'badge-amber-executive',
                    }
                  : statusLevel === 'healthy'
                  ? {
                      text: hasPercentRule
                        ? `Meta ${category.percentual_meta}% Ativa`
                        : 'Dentro do Limite',
                      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    }
                  : {
                      text: `${participacaoNosGastos}% dos gastos`,
                      cls: 'theme-badge-subtle',
                    };

              return (
                <div
                  key={category.id}
                  className="surface-card rounded-2xl p-5 space-y-4 border border-app-border flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: category.cor }}
                        >
                          <CatIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate">{category.nome}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {hasPercentRule && (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md theme-badge-subtle">
                                Meta: {category.percentual_meta}% da renda
                              </span>
                            )}
                            {isRuleEnabled && ruleInfo && (
                              <span
                                className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${ruleInfo.badgeClass}`}
                              >
                                {ruleInfo.shortBadge}
                              </span>
                            )}
                            {!hasPercentRule && (!isRuleEnabled || !ruleInfo) && (
                              <span className="text-[11px] text-app-muted">
                                Categorização livre
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEditCategory(category)}
                        title="Editar Categoria"
                        className="p-1.5 rounded-lg surface-elevated text-app-muted hover:text-app-text shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Resumo de Gasto da Categoria */}
                    <div className="surface-elevated rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-app-muted">
                          {hasActiveLimit ? 'Gasto Atual / Meta' : 'Total Gasto no Mês'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusBadge.cls}`}
                        >
                          {statusBadge.text}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base font-extrabold">
                          {formatCurrency(gastoAtual, currency, hide)}
                        </span>
                        {hasActiveLimit ? (
                          <span className="text-xs text-app-muted">
                            de{' '}
                            <strong className="text-app-text">
                              {formatCurrency(tetoPlanejado, currency, hide)}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-app-muted">
                            {receitasMes > 0
                              ? `${participacaoNaReceita}% da receita do mês`
                              : `${participacaoNosGastos}% das despesas`}
                          </span>
                        )}
                      </div>

                      {/* Barra de Progresso (Ajusta-se à % definida ou mostra participação nos gastos) */}
                      <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              hasActiveLimit ? percentual : participacaoNosGastos
                            )}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>

                      {hasActiveLimit && tetoPlanejado > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-app-muted">{percentual}% utilizado</span>
                          <span
                            className={`font-bold ${
                              saldoRestante < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {saldoRestante >= 0
                              ? `Livre: ${formatCurrency(saldoRestante, currency, hide)}`
                              : `Excedido: ${formatCurrency(Math.abs(saldoRestante), currency, hide)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botão Opcional para Definir % ou Limite */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenLimitModal(
                        category,
                        tetoPlanejado,
                        category.percentual_meta ?? null
                      )
                    }
                    className="w-full py-2 rounded-xl text-xs font-semibold surface-elevated hover:border-app-primary text-app-text flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Percent className="w-3.5 h-3.5 text-app-accent" />
                    <span>
                      {hasPercentRule
                        ? `Ajustar Meta (${category.percentual_meta}% da Renda)`
                        : tetoPlanejado > 0
                        ? 'Ajustar Limite'
                        : 'Definir Limite'}
                    </span>
                  </button>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* =====================================================================
          SEÇÃO 2 (OPCIONAL): DIVISÃO POR PILARES DE PORCENTAGEM (50-30-20 OU CUSTOM)
          ===================================================================== */}
      <section className="space-y-5 pt-4 border-t border-app-border">
        <div className="surface-card rounded-3xl p-5 border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-app-accent" />
              <h3 className="text-base font-bold">
                Divisão por Pilares de Porcentagem
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isRuleEnabled && (
              <button
                type="button"
                onClick={() => {
                  setInputPctEssencial(String(pctEssencial));
                  setInputPctEstilo(String(pctEstilo));
                  setInputPctFuturo(String(pctFuturo));
                  setIsCustomizingPillarPcts((prev) => !prev);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold surface-elevated hover:border-app-primary flex items-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-app-accent" />
                <span>Personalizar Porcentagem</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleRuleEnabled}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isRuleEnabled
                  ? 'surface-elevated text-app-muted hover:text-rose-400'
                  : 'btn-primary-theme shadow-sm'
              }`}
            >
              {isRuleEnabled
                ? 'Desativar Regra de Porcentagem'
                : 'Ativar Divisão por Porcentagem'}
            </button>
          </div>
        </div>

        {/* Sub-painel para personalizar as porcentagens dos 3 pilares */}
        {isRuleEnabled && isCustomizingPillarPcts && (
          <form
            onSubmit={handleSaveCustomPillarPcts}
            className="surface-card rounded-3xl p-5 border border-app-border space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">
                  Personalizar Porcentagens dos Pilares
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInputPctEssencial('50');
                  setInputPctEstilo('30');
                  setInputPctFuturo('20');
                }}
                className="text-xs text-app-accent hover:underline font-semibold"
              >
                Restaurar 50-30-20 padrão
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  % Necessidades Essenciais
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={inputPctEssencial}
                  onChange={(e) => setInputPctEssencial(e.target.value)}
                  className="w-full surface-elevated rounded-xl px-3.5 py-2 text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  % Estilo de Vida e Desejos
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={inputPctEstilo}
                  onChange={(e) => setInputPctEstilo(e.target.value)}
                  className="w-full surface-elevated rounded-xl px-3.5 py-2 text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  % Futuro, Reserva & Metas
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={inputPctFuturo}
                  onChange={(e) => setInputPctFuturo(e.target.value)}
                  className="w-full surface-elevated rounded-xl px-3.5 py-2 text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-app-muted">
                Soma atual:{' '}
                <strong
                  className={
                    Number(inputPctEssencial) +
                      Number(inputPctEstilo) +
                      Number(inputPctFuturo) ===
                    100
                      ? 'text-emerald-400'
                      : 'text-amber-executive'
                  }
                >
                  {Number(inputPctEssencial || 0) +
                    Number(inputPctEstilo || 0) +
                    Number(inputPctFuturo || 0)}
                  %
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizingPillarPcts(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-theme px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Aplicar Porcentagens
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Exibe os 3 Cards e Gráficos somente se o usuário ativar a Divisão por Porcentagem */}
        {isRuleEnabled && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {(['essencial_50', 'estilo_vida_30', 'futuro_20'] as Rule503020[]).map(
                (key) => {
                  const meta = ruleMetaDynamic[key];
                  const bucket = rule503020Summary[key];
                  const isOverIdeal =
                    key !== 'futuro_20' && bucket.gasto > bucket.ideal && bucket.ideal > 0;
                  const barRatio =
                    bucket.ideal > 0
                      ? Math.min(100, Math.round((bucket.gasto / bucket.ideal) * 100))
                      : 0;

                  return (
                    <div
                      key={key}
                      className="surface-card rounded-3xl p-6 space-y-4 border border-app-border flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${meta.badgeClass}`}
                          >
                            {meta.shortBadge}
                          </span>
                          <span
                            className={`text-xs font-extrabold ${
                              isOverIdeal ? 'text-rose-400' : 'text-app-text'
                            }`}
                          >
                            {bucket.percentualReceita}% da Renda
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold">{meta.title}</h3>
                        <p className="text-[11px] text-app-muted leading-relaxed">
                          {meta.subtitle}
                        </p>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-2 gap-2 surface-elevated rounded-2xl p-3">
                          <div>
                            <span className="text-[10px] uppercase text-app-muted block">
                              Gasto Real
                            </span>
                            <span
                              className={`text-sm sm:text-base font-extrabold ${
                                isOverIdeal ? 'text-rose-400' : 'text-app-text'
                              }`}
                            >
                              {formatCurrency(bucket.gasto, currency, hide)}
                            </span>
                          </div>
                          <div className="border-l border-app-border pl-3">
                            <span className="text-[10px] uppercase text-app-muted block">
                              Meta ({meta.targetPct}%)
                            </span>
                            <span className="text-sm sm:text-base font-extrabold text-app-muted">
                              {formatCurrency(bucket.ideal, currency, hide)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-app-muted">
                            <span>Consumo do Pilar</span>
                            <span className="font-bold">{barRatio}% da meta</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-black/40 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${barRatio}%`,
                                backgroundColor: isOverIdeal ? '#f43f5e' : meta.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="surface-card rounded-3xl p-6 lg:col-span-3 space-y-4 border border-app-border">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-app-muted">
                    Comparativo Gráfico: Meta ({pctEssencial}-{pctEstilo}-{pctFuturo}) vs. Realizado
                  </h3>
                  <p className="text-xs text-app-muted">
                    Os valores ideais se ajustam automaticamente de acordo com as porcentagens definidas
                  </p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData503020}
                      margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (hide ? '•••' : `R$${v}`)}
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          formatCurrency(Number(value), currency, hide)
                        }
                        contentStyle={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                          borderRadius: '14px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        dataKey="Ideal"
                        name="Meta Recomendada"
                        fill="var(--color-primary)"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="Real"
                        name="Gasto / Aporte Real"
                        fill="var(--color-accent)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-card rounded-3xl p-6 lg:col-span-2 space-y-4 border border-app-border flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-app-accent" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">
                      Diagnóstico de Porcentagens
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {diagnosticMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl p-3.5 text-xs space-y-1 border ${
                          msg.type === 'danger'
                            ? 'bg-rose-500/12 border-rose-500/30 text-rose-300'
                            : msg.type === 'warn'
                            ? 'alert-amber-executive'
                            : 'bg-emerald-500/12 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <p className="font-bold flex items-center gap-1.5">
                          {msg.type === 'danger' || msg.type === 'warn' ? (
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-executive" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          )}
                          <span>{msg.title}</span>
                        </p>
                        <p className="text-[11px] opacity-90 leading-relaxed">{msg.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* =====================================================================
          SEÇÃO 3: CAIXINHAS E METAS FINANCEIRAS (FINANCIAL GOALS)
          ===================================================================== */}
      <section className="space-y-5 pt-4 border-t border-app-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-app-accent flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Cofres & Objetivos de Médio/Longo Prazo
            </span>
            <h2 className="text-xl font-extrabold tracking-tight">
              Caixinhas e Metas Financeiras ({financialGoals.length})
            </h2>
            <p className="text-xs text-app-muted">
              Acompanhe quanto falta, data limite e quanto guardar por mês automaticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenNewGoal}
            className="btn-primary-theme px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Caixinha / Meta</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {financialGoals.map((goal) => {
            const GoalIcon = ICON_MAP[goal.icone] || Target;
            const pct =
              goal.valor_meta > 0
                ? Math.min(100, Math.round((goal.valor_acumulado / goal.valor_meta) * 100))
                : 0;
            const faltaGuardar = Math.max(0, goal.valor_meta - goal.valor_acumulado);
            const mesesRestantes = calculateMonthsRemaining(goal.data_alvo);
            const aporteMensalNecessario =
              faltaGuardar > 0 ? Number((faltaGuardar / mesesRestantes).toFixed(2)) : 0;

            return (
              <div
                key={goal.id}
                className="surface-card rounded-3xl overflow-hidden border border-app-border flex flex-col justify-between"
              >
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: goal.cor }}
                />

                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                          style={{ backgroundColor: goal.cor }}
                        >
                          <GoalIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base leading-snug">
                            {goal.titulo}
                          </h3>
                          <span className="text-[11px] text-app-muted flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-app-accent" />
                            Data-alvo: {goal.data_alvo.split('-').reverse().join('/')} (
                            {mesesRestantes} {mesesRestantes === 1 ? 'mês' : 'meses'})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditGoal(goal)}
                          className="p-1.5 rounded-xl surface-elevated text-app-muted hover:text-app-text"
                          title="Editar Meta"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteFinancialGoal(goal.id);
                            notify(`Caixinha "${goal.titulo}" removida.`);
                          }}
                          className="p-1.5 rounded-xl surface-elevated text-rose-400 hover:bg-rose-500/15"
                          title="Excluir Meta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-app-muted block">
                            Já Guardado
                          </span>
                          <p className="text-2xl font-extrabold text-app-text">
                            {formatCurrency(goal.valor_acumulado, currency, hide)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-app-muted block">
                            Valor Alvo
                          </span>
                          <p className="text-sm font-bold text-app-muted">
                            {formatCurrency(goal.valor_meta, currency, hide)}
                          </p>
                        </div>
                      </div>

                      <div className="w-full h-2.5 rounded-full bg-black/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: goal.cor,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-app-accent">{pct}% concluído</span>
                        <span className="text-app-muted">
                          Faltam: {formatCurrency(faltaGuardar, currency, hide)}
                        </span>
                      </div>
                    </div>

                    <div className="alert-amber-executive rounded-2xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-executive block">
                        Plano de Aporte Mensal Sugerido
                      </span>
                      {faltaGuardar > 0 ? (
                        <p className="text-xs text-app-text">
                          Guarde{' '}
                          <strong className="text-sm font-extrabold text-amber-executive">
                            {formatCurrency(aporteMensalNecessario, currency, hide)} / mês
                          </strong>{' '}
                          pelos próximos {mesesRestantes}{' '}
                          {mesesRestantes === 1 ? 'mês' : 'meses'}.
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-emerald-400">
                          Objetivo 100% alcançado! Parabéns!
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-app-border">
                    <button
                      type="button"
                      onClick={() => {
                        setGoalOperation({ goal, mode: 'deposit' });
                        setOperationAmount(String(aporteMensalNecessario || 500));
                      }}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>+ Guardar Valor</span>
                    </button>

                    <button
                      type="button"
                      disabled={goal.valor_acumulado <= 0}
                      onClick={() => {
                        setGoalOperation({ goal, mode: 'withdraw' });
                        setOperationAmount('');
                      }}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold surface-elevated hover:border-rose-400 text-rose-300 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      <span>- Resgatar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          MODAL 1: DEFINIR PORCENTAGEM (%) OU LIMITE OPCIONAL DA CATEGORIA
          ===================================================================== */}
      {editingBudgetCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-4 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                Configurar Categoria: {editingBudgetCat.category.nome}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBudgetCat(null)}
                className="p-1.5 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              {/* Seletor de Modo: Apenas Categorizar | Porcentagem da Renda (%) | Valor Fixo (R$) */}
              <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl surface-elevated border border-app-border">
                <button
                  type="button"
                  onClick={() => setLimitMode('none')}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                    limitMode === 'none'
                      ? 'btn-primary-theme shadow-sm'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  Só Categorizar
                </button>
                <button
                  type="button"
                  onClick={() => setLimitMode('percent')}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                    limitMode === 'percent'
                      ? 'btn-primary-theme shadow-sm'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  Porcentagem (%)
                </button>
                <button
                  type="button"
                  onClick={() => setLimitMode('fixed')}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                    limitMode === 'fixed'
                      ? 'btn-primary-theme shadow-sm'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  Valor Fixo (R$)
                </button>
              </div>

              {limitMode === 'none' && (
                <div className="p-4 rounded-2xl surface-elevated text-xs text-app-muted space-y-1">
                  <p className="font-semibold text-app-text">
                    Modo Somente Categorização
                  </p>
                  <p>
                    Esta categoria será usada apenas para classificar e somar seus lançamentos, sem exigir porcentagem nem limite máximo.
                  </p>
                </div>
              )}

              {limitMode === 'percent' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-muted">
                      Porcentagem da Receita Mensal (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="100"
                        required
                        autoFocus
                        value={budgetPercentVal}
                        onChange={(e) => setBudgetPercentVal(e.target.value)}
                        placeholder="Ex: 15"
                        className="w-full surface-elevated rounded-xl px-4 py-3 text-lg font-extrabold focus:outline-none focus:ring-2 focus:ring-app-primary"
                      />
                      <span className="text-lg font-extrabold text-app-muted">%</span>
                    </div>
                  </div>
                  <p className="text-xs text-app-muted">
                    Equivale automaticamente a{' '}
                    <strong className="text-app-text">
                      {formatCurrency(
                        (receitasMes * (parseFloat(budgetPercentVal) || 0)) / 100,
                        currency,
                        hide
                      )}
                    </strong>{' '}
                    com base na receita deste mês ({formatCurrency(receitasMes, currency, hide)}).
                  </p>
                </div>
              )}

              {limitMode === 'fixed' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Limite Fixo Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    value={budgetInputVal}
                    onChange={(e) => setBudgetInputVal(e.target.value)}
                    placeholder="Ex: 1200,00"
                    className="w-full surface-elevated rounded-xl px-4 py-3 text-lg font-extrabold focus:outline-none focus:ring-2 focus:ring-app-primary"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBudgetCat(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-theme px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  Salvar Configuração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: GERENCIADOR DE CATEGORIAS (PORCENTAGEM E PILAR OPCIONAIS)
          ===================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-5 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  required
                  value={catNome}
                  onChange={(e) => setCatNome(e.target.value)}
                  placeholder="Ex: Alimentação, Academia, Transporte..."
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">Tipo</label>
                  <select
                    value={catTipo}
                    onChange={(e) => setCatTipo(e.target.value as CategoryType)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Meta em % (Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={catPercentualMeta}
                    onChange={(e) => setCatPercentualMeta(e.target.value)}
                    placeholder="Sem % definida"
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              {catTipo === 'despesa' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Pilar de Porcentagem (Opcional)
                  </label>
                  <select
                    value={catRegra}
                    onChange={(e) =>
                      setCatRegra(e.target.value as Rule503020 | 'nenhum')
                    }
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="nenhum">
                      Nenhum (Apenas Categorização Livre)
                    </option>
                    <option value="essencial_50">
                      {pctEssencial}% Necessidades Essenciais
                    </option>
                    <option value="estilo_vida_30">
                      {pctEstilo}% Estilo de Vida
                    </option>
                    <option value="futuro_20">
                      {pctFuturo}% Futuro & Metas
                    </option>
                  </select>
                </div>
              )}

              {/* Seletor de Ícone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-muted block">Ícone</label>
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1">
                  {ICON_OPTIONS.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCatIcone(item.name)}
                        className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${
                          catIcone === item.name
                            ? 'border-app-accent bg-app-elevated text-app-accent'
                            : 'border-app-border text-app-muted hover:text-app-text'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-muted block">Cor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatCor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${
                        catCor === c ? 'scale-110 border-white' : 'border-transparent opacity-75'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingCategory ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteCategory(editingCategory.id);
                      setIsCategoryModalOpen(false);
                      notify(`Categoria "${editingCategory.nome}" excluída.`);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-400"
                  >
                    Excluir
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-theme px-5 py-2.5 rounded-xl text-xs font-semibold"
                  >
                    Salvar Categoria
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: CRIAR / EDITAR CAIXINHA OU META FINANCEIRA
          ===================================================================== */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-5 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingGoal ? 'Editar Caixinha / Meta' : 'Nova Caixinha / Meta'}
              </h3>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="p-2 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Título do Objetivo
                </label>
                <input
                  type="text"
                  required
                  value={goalTitulo}
                  onChange={(e) => setGoalTitulo(e.target.value)}
                  placeholder="Ex: Reserva de Emergência, Trocar de Carro, Viagem..."
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={goalValorMeta}
                    onChange={(e) => setGoalValorMeta(e.target.value)}
                    placeholder="20000,00"
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Valor Já Guardado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={goalValorAcumulado}
                    onChange={(e) => setGoalValorAcumulado(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">Data Limite</label>
                <input
                  type="date"
                  required
                  value={goalDataAlvo}
                  onChange={(e) => setGoalDataAlvo(e.target.value)}
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-muted block">
                  Cor da Caixinha
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setGoalCor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${
                        goalCor === c ? 'scale-110 border-white' : 'border-transparent opacity-75'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-theme px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm"
                >
                  Salvar Caixinha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: + GUARDAR VALOR OU - RESGATAR DA CAIXINHA
          ===================================================================== */}
      {goalOperation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-sm rounded-3xl p-6 space-y-4 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {goalOperation.mode === 'deposit'
                  ? '+ Guardar Valor na Caixinha'
                  : '- Resgatar Valor da Caixinha'}
              </h3>
              <button
                type="button"
                onClick={() => setGoalOperation(null)}
                className="p-1.5 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-app-muted">
              Caixinha: <strong className="text-app-text">{goalOperation.goal.titulo}</strong> •
              Saldo acumulado:{' '}
              <strong>{formatCurrency(goalOperation.goal.valor_acumulado, currency)}</strong>
            </p>

            <form onSubmit={handleConfirmGoalOperation} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Valor da Operação (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={operationAmount}
                  onChange={(e) => setOperationAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full surface-elevated rounded-xl px-4 py-3 text-lg font-extrabold focus:outline-none focus:ring-2 focus:ring-app-primary"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGoalOperation(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    goalOperation.mode === 'deposit'
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {goalOperation.mode === 'deposit'
                      ? 'Confirmar Aporte'
                      : 'Confirmar Resgate'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
