import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Building2,
  Banknote,
  TrendingUp,
  PiggyBank,
  Plus,
  ArrowLeftRight,
  SlidersHorizontal,
  Edit3,
  Trash2,
  CheckCircle2,
  CreditCard as CreditCardIcon,
  Calendar,
  AlertCircle,
  Sparkles,
  Check,
  X,
  Eye,
  EyeOff,
  Receipt,
  ShoppingBag,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Account, AccountType, CreditCard, TransactionNature } from '../../types/finance';
import { formatCurrency, formatMonthYearDisplay, shiftYearMonth } from '../../lib/utils';

const PRESET_COLORS = [
  '#8b5cf6', // Roxo Violet
  '#a855f7', // Roxo Destaque
  '#f59e0b', // Âmbar Royal
  '#10b981', // Esmeralda
  '#3b82f6', // Azul Royal
  '#ec4899', // Pink
  '#f97316', // Laranja
  '#06b6d4', // Ciano
  '#71717a', // Grafite
];

const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  corrente: {
    label: 'Conta Corrente',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    icon: Building2,
  },
  poupanca: {
    label: 'Conta Poupança',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: PiggyBank,
  },
  investimento: {
    label: 'Investimento & Reserva',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: TrendingUp,
  },
  dinheiro_fisico: {
    label: 'Carteira Física (Espécie)',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: Banknote,
  },
};

export const WalletsAndCardsView: React.FC = () => {
  const {
    accounts,
    creditCards,
    transactions,
    categories,
    selectedMonth,
    userSettings,
    totalSaldoGeral,
    addAccount,
    updateAccount,
    deleteAccount,
    adjustAccountBalance,
    transferBetweenAccounts,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    payCreditCardInvoice,
    addTransaction,
  } = useFinance();

  const hide = userSettings.ocultar_valores;
  const currency = userSettings.moeda;

  // Feedbacks globais da view
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setBannerMessage({ type, text });
    setTimeout(() => {
      setBannerMessage((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // ==========================================================================
  // 1. ESTADOS DOS MODAIS DE CONTAS (CRIAR/EDITAR, AJUSTE DE SALDO, TRANSFERÊNCIA)
  // ==========================================================================
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accNome, setAccNome] = useState('');
  const [accTipo, setAccTipo] = useState<AccountType>('corrente');
  const [accSaldoInicial, setAccSaldoInicial] = useState('0');
  const [accCor, setAccCor] = useState('#8b5cf6');
  const [accIncluirSoma, setAccIncluirSoma] = useState(true);

  // Modal de Ajuste Rápido de Saldo
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [newTargetBalance, setNewTargetBalance] = useState('');

  // Modal de Transferência entre Contas
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [transferDesc, setTransferDesc] = useState('');

  // ==========================================================================
  // 2. ESTADOS DOS MODAIS DE CARTÃO DE CRÉDITO (CRIAR/EDITAR, PAGAR FATURA, COMPRA)
  // ==========================================================================
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardNome, setCardNome] = useState('');
  const [cardAccountId, setCardAccountId] = useState('');
  const [cardLimite, setCardLimite] = useState('');
  const [cardDiaFechamento, setCardDiaFechamento] = useState('5');
  const [cardDiaVencimento, setCardDiaVencimento] = useState('12');
  const [cardCor, setCardCor] = useState('#8b5cf6');

  // Modal de Pagamento de Fatura
  const [payingInvoiceCard, setPayingInvoiceCard] = useState<{
    card: CreditCard;
    invoiceAmount: number;
    pendingCount: number;
  } | null>(null);
  const [selectedDebitAccountId, setSelectedDebitAccountId] = useState('');

  // Modal de Nova Compra no Cartão (demonstrando regra de fechamento)
  const [purchaseCard, setPurchaseCard] = useState<CreditCard | null>(null);
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    () => `${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`
  );
  const [purchaseCategoryId, setPurchaseCategoryId] = useState('');
  const [purchaseNatureza, setPurchaseNatureza] = useState<TransactionNature>('variavel');
  const [purchaseParcelas, setPurchaseParcelas] = useState(2);

  // ==========================================================================
  // SEPARA CONTAS BANCÁRIAS E CARTEIRA FÍSICA (DINHEIRO EM ESPÉCIE)
  // ==========================================================================
  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.tipo !== 'dinheiro_fisico'),
    [accounts]
  );

  const physicalWallets = useMemo(
    () => accounts.filter((a) => a.tipo === 'dinheiro_fisico'),
    [accounts]
  );

  const totalBancos = useMemo(
    () => bankAccounts.reduce((acc, item) => acc + item.saldo_atual, 0),
    [bankAccounts]
  );

  const totalEspecie = useMemo(
    () => physicalWallets.reduce((acc, item) => acc + item.saldo_atual, 0),
    [physicalWallets]
  );

  // ==========================================================================
  // CÁLCULO EM TEMPO REAL DOS CARTÕES DE CRÉDITO
  // ==========================================================================
  const creditCardsMetrics = useMemo(() => {
    return creditCards.map((card) => {
      const cardPendingTxs = transactions.filter(
        (tx) => tx.credit_card_id === card.id && tx.status === 'pendente'
      );

      // Limite Utilizado = soma de todas as compras pendentes no cartão
      const limiteUtilizado = Number(
        cardPendingTxs.reduce((sum, tx) => sum + tx.valor, 0).toFixed(2)
      );
      const limiteDisponivel = Math.max(
        0,
        Number((card.limite_total - limiteUtilizado).toFixed(2))
      );
      const percentualUso =
        card.limite_total > 0
          ? Math.min(100, Number(((limiteUtilizado / card.limite_total) * 100).toFixed(1)))
          : 0;

      // Fatura Atual (Mês Selecionado) — pendentes e pagas para visibilidade
      const currentMonthTxs = transactions.filter(
        (tx) =>
          tx.credit_card_id === card.id && tx.data_vencimento.startsWith(selectedMonth)
      );

      const faturaAtualPendente = Number(
        currentMonthTxs
          .filter((tx) => tx.status === 'pendente')
          .reduce((sum, tx) => sum + tx.valor, 0)
          .toFixed(2)
      );

      const faturaAtualPaga = Number(
        currentMonthTxs
          .filter((tx) => tx.status === 'pago')
          .reduce((sum, tx) => sum + tx.valor, 0)
          .toFixed(2)
      );

      // Próximas Faturas (compras após a competência atual / parcelamentos futuros)
      const nextInvoicesTxs = cardPendingTxs.filter(
        (tx) => tx.data_vencimento.slice(0, 7) > selectedMonth
      );

      const proximasFaturasTotal = Number(
        nextInvoicesTxs.reduce((sum, tx) => sum + tx.valor, 0).toFixed(2)
      );

      const linkedAccount = accounts.find((a) => a.id === card.account_id);

      return {
        card,
        linkedAccount,
        limiteUtilizado,
        limiteDisponivel,
        percentualUso,
        faturaAtualPendente,
        faturaAtualPaga,
        proximasFaturasTotal,
        currentMonthTxs,
        nextInvoicesTxs,
      };
    });
  }, [creditCards, transactions, selectedMonth, accounts]);

  const totalFaturasAbertasMes = useMemo(
    () => creditCardsMetrics.reduce((sum, m) => sum + m.faturaAtualPendente, 0),
    [creditCardsMetrics]
  );

  // ==========================================================================
  // HANDLERS: CONTAS BANCÁRIAS E CARTEIRA FÍSICA
  // ==========================================================================
  const handleOpenCreateAccount = (presetType: AccountType = 'corrente') => {
    setEditingAccount(null);
    setAccNome(presetType === 'dinheiro_fisico' ? 'Carteira Física (Espécie)' : '');
    setAccTipo(presetType);
    setAccSaldoInicial('0');
    setAccCor(presetType === 'dinheiro_fisico' ? '#06b6d4' : '#8b5cf6');
    setAccIncluirSoma(true);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccNome(acc.nome);
    setAccTipo(acc.tipo);
    setAccSaldoInicial(String(acc.saldo_inicial));
    setAccCor(acc.cor);
    setAccIncluirSoma(acc.incluir_na_soma_geral);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedInitial = parseFloat(accSaldoInicial.replace(',', '.')) || 0;
    if (accNome.trim().length < 2) {
      showFeedback('error', 'O nome da conta deve ter pelo menos 2 caracteres.');
      return;
    }

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        nome: accNome.trim(),
        tipo: accTipo,
        saldo_inicial: parsedInitial,
        cor: accCor,
        incluir_na_soma_geral: accIncluirSoma,
      });
      showFeedback('success', `Conta "${accNome.trim()}" atualizada com sucesso!`);
    } else {
      addAccount({
        nome: accNome.trim(),
        tipo: accTipo,
        saldo_inicial: parsedInitial,
        cor: accCor,
        incluir_na_soma_geral: accIncluirSoma,
      });
      showFeedback('success', `Nova conta "${accNome.trim()}" adicionada!`);
    }

    setIsAccountModalOpen(false);
  };

  const handleDeleteAccount = (acc: Account) => {
    deleteAccount(acc.id);
    setIsAccountModalOpen(false);
    showFeedback('success', `Conta "${acc.nome}" removida.`);
  };

  const handleOpenAdjustModal = (acc: Account) => {
    setAdjustingAccount(acc);
    setNewTargetBalance(String(acc.saldo_atual));
  };

  const handleConfirmBalanceAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccount) return;
    const targetVal = parseFloat(newTargetBalance.replace(',', '.'));
    if (Number.isNaN(targetVal)) return;

    adjustAccountBalance(adjustingAccount.id, targetVal);
    showFeedback(
      'success',
      `Saldo de "${adjustingAccount.nome}" ajustado imediatamente para ${formatCurrency(
        targetVal,
        currency
      )}!`
    );
    setAdjustingAccount(null);
  };

  const handleOpenTransferModal = (defaultFromId?: string, defaultToId?: string) => {
    const firstAcc = defaultFromId || bankAccounts[0]?.id || accounts[0]?.id || '';
    const secondAcc =
      defaultToId ||
      physicalWallets[0]?.id ||
      accounts.find((a) => a.id !== firstAcc)?.id ||
      '';
    setTransferFromId(firstAcc);
    setTransferToId(secondAcc);
    setTransferAmount('');
    setTransferDesc('');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = parseFloat(transferAmount.replace(',', '.'));
    const res = transferBetweenAccounts({
      fromAccountId: transferFromId,
      toAccountId: transferToId,
      amount: numericVal,
      date: transferDate,
      description: transferDesc,
    });

    if (!res.success) {
      showFeedback('error', res.error || 'Não foi possível realizar a transferência.');
      return;
    }

    const fromName = accounts.find((a) => a.id === transferFromId)?.nome;
    const toName = accounts.find((a) => a.id === transferToId)?.nome;
    showFeedback(
      'success',
      `Transferência de ${formatCurrency(
        numericVal,
        currency
      )} concluída (${fromName} → ${toName}) sem impactar despesas!`
    );
    setIsTransferModalOpen(false);
  };

  // ==========================================================================
  // HANDLERS: CARTÕES DE CRÉDITO, FATURAS E COMPRAS
  // ==========================================================================
  const handleOpenCreateCard = () => {
    setEditingCard(null);
    setCardNome('');
    setCardAccountId(bankAccounts[0]?.id || accounts[0]?.id || '');
    setCardLimite('10000');
    setCardDiaFechamento('5');
    setCardDiaVencimento('12');
    setCardCor('#8b5cf6');
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setCardNome(card.nome_cartao);
    setCardAccountId(card.account_id);
    setCardLimite(String(card.limite_total));
    setCardDiaFechamento(String(card.dia_fechamento));
    setCardDiaVencimento(String(card.dia_vencimento));
    setCardCor(card.cor);
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    const limiteVal = parseFloat(cardLimite.replace(',', '.'));
    const fechamento = Math.min(31, Math.max(1, parseInt(cardDiaFechamento, 10) || 5));
    const vencimento = Math.min(31, Math.max(1, parseInt(cardDiaVencimento, 10) || 12));

    if (!cardNome.trim() || Number.isNaN(limiteVal) || limiteVal <= 0) {
      showFeedback('error', 'Preencha o nome do cartão e um limite total maior que zero.');
      return;
    }

    if (editingCard) {
      updateCreditCard(editingCard.id, {
        nome_cartao: cardNome.trim(),
        account_id: cardAccountId || accounts[0]?.id || '',
        limite_total: limiteVal,
        dia_fechamento: fechamento,
        dia_vencimento: vencimento,
        cor: cardCor,
      });
      showFeedback('success', `Cartão "${cardNome.trim()}" atualizado!`);
    } else {
      addCreditCard({
        nome_cartao: cardNome.trim(),
        account_id: cardAccountId || accounts[0]?.id || '',
        limite_total: limiteVal,
        dia_fechamento: fechamento,
        dia_vencimento: vencimento,
        cor: cardCor,
      });
      showFeedback('success', `Cartão "${cardNome.trim()}" cadastrado com sucesso!`);
    }

    setIsCardModalOpen(false);
  };

  const handleOpenPayInvoiceModal = (
    card: CreditCard,
    invoiceAmount: number,
    pendingCount: number
  ) => {
    setPayingInvoiceCard({ card, invoiceAmount, pendingCount });
    setSelectedDebitAccountId(card.account_id || accounts[0]?.id || '');
  };

  const handleConfirmPayInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoiceCard) return;

    const result = payCreditCardInvoice(
      payingInvoiceCard.card.id,
      selectedMonth,
      selectedDebitAccountId
    );

    if (!result.success) {
      showFeedback('error', result.error || 'Erro ao pagar fatura.');
      setPayingInvoiceCard(null);
      return;
    }

    const debitAccName =
      accounts.find((a) => a.id === selectedDebitAccountId)?.nome || 'Conta selecionada';
    showFeedback(
      'success',
      `Fatura de ${payingInvoiceCard.card.nome_cartao} (${formatCurrency(
        result.totalPaid,
        currency
      )}) paga! ${result.paidCount} lançamento(s) baixado(s) e debitado(s) de ${debitAccName}.`
    );
    setPayingInvoiceCard(null);
  };

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.tipo === 'despesa'),
    [categories]
  );

  const handleOpenCardPurchaseModal = (card: CreditCard) => {
    setPurchaseCard(card);
    setPurchaseDesc('');
    setPurchaseAmount('');
    setPurchaseDate(`${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`);
    setPurchaseCategoryId(expenseCategories[0]?.id || '');
    setPurchaseNatureza('variavel');
    setPurchaseParcelas(2);
  };

  const handleCreateCardPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseCard) return;
    const numericVal = parseFloat(purchaseAmount.replace(',', '.'));
    if (!purchaseDesc.trim() || Number.isNaN(numericVal) || numericVal <= 0) return;

    const purchaseDay = Number(purchaseDate.split('-')[2]);
    const isAfterClosing = purchaseDay > purchaseCard.dia_fechamento;

    addTransaction({
      account_id: null,
      credit_card_id: purchaseCard.id,
      category_id: purchaseCategoryId || expenseCategories[0]?.id || 'cat_est_compras',
      descricao: purchaseDesc.trim(),
      valor: numericVal,
      tipo: 'despesa',
      natureza: purchaseNatureza,
      total_parcelas: purchaseNatureza === 'parcelada' ? Math.max(2, purchaseParcelas) : null,
      status: 'pendente',
      data_vencimento: purchaseDate,
      data_pagamento: null,
    });

    const targetMonthLabel = isAfterClosing
      ? formatMonthYearDisplay(shiftYearMonth(purchaseDate.slice(0, 7), 1))
      : formatMonthYearDisplay(purchaseDate.slice(0, 7));

    showFeedback(
      'success',
      isAfterClosing
        ? `Compra após o fechamento (dia ${purchaseCard.dia_fechamento}): lançada automaticamente para a fatura de ${targetMonthLabel}!`
        : `Compra lançada na fatura de ${targetMonthLabel} do cartão ${purchaseCard.nome_cartao}!`
    );
    setPurchaseCard(null);
  };

  return (
    <div className="space-y-8">
      {/* Banner de Feedback */}
      {bannerMessage && (
        <div
          className={`rounded-2xl p-4 flex items-center justify-between gap-3 border animate-in fade-in duration-200 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="p-1 rounded-lg hover:bg-black/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          RESUMO EXECUTIVO DE LIQUIDEZ & CRÉDITO
          ===================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5 space-y-2 border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between text-xs text-app-muted">
            <span>Saldo Geral</span>
            <Wallet className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight">
            {formatCurrency(totalSaldoGeral, currency, hide)}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-app-muted">
            <span>Contas Bancárias & Reserva</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-emerald-400">
            {formatCurrency(totalBancos, currency, hide)}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-app-muted">
            <span>Carteira Física (Espécie)</span>
            <Banknote className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-cyan-400">
            {formatCurrency(totalEspecie, currency, hide)}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5 space-y-2 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs text-app-muted">
            <span>Faturas Abertas ({formatMonthYearDisplay(selectedMonth)})</span>
            <CreditCardIcon className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-amber-400">
            {formatCurrency(totalFaturasAbertasMes, currency, hide)}
          </p>
        </div>
      </section>

      {/* =====================================================================
          PARTE 1: GESTÃO DE CARTEIRAS E CONTAS (BANCOS + DINHEIRO EM ESPÉCIE)
          ===================================================================== */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Carteiras Bancárias & Dinheiro Físico
            </h2>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenTransferModal()}
              className="surface-elevated hover:border-app-accent px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-app-text transition-all"
            >
              <ArrowLeftRight className="w-4 h-4 text-app-accent" />
              <span>Transferência entre Contas</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateAccount('corrente')}
              className="btn-primary-theme px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Conta / Carteira</span>
            </button>
          </div>
        </div>

        {/* Sub-bloco 1.1: Contas Bancárias (Corrente, Poupança, Investimento) */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankAccounts.map((acc) => {
              const meta = ACCOUNT_TYPE_META[acc.tipo];
              const Icon = meta.icon;

              return (
                <div
                  key={acc.id}
                  className="surface-card rounded-2xl overflow-hidden flex flex-col justify-between border border-app-border hover:border-app-primary/60 transition-all"
                >
                  {/* Barra de Identificação de Cor */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: acc.cor }} />

                  <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                            style={{ backgroundColor: acc.cor }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-base leading-snug">{acc.nome}</h4>
                            <span
                              className={`inline-block mt-0.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditAccount(acc)}
                          title="Editar Conta"
                          className="p-2 rounded-xl surface-elevated text-app-muted hover:text-app-text"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Saldo Atual e Saldo Inicial */}
                      <div className="pt-1">
                        <span className="text-[11px] text-app-muted block">Saldo Atual</span>
                        <p className="text-2xl font-extrabold tracking-tight">
                          {formatCurrency(acc.saldo_atual, currency, hide)}
                        </p>
                        <span className="text-[11px] text-app-muted">
                          Saldo inicial base: {formatCurrency(acc.saldo_inicial, currency, hide)}
                        </span>
                      </div>
                    </div>

                    {/* Rodapé do Card: Chave Soma Geral + Ações Rápidas */}
                    <div className="pt-3 border-t border-app-border space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-app-muted flex items-center gap-1.5">
                          {acc.incluir_na_soma_geral ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-app-muted" />
                          )}
                          Incluir no Saldo Geral
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateAccount(acc.id, {
                              incluir_na_soma_geral: !acc.incluir_na_soma_geral,
                            })
                          }
                          className={`w-10 h-5 rounded-full transition-colors p-0.5 ${
                            acc.incluir_na_soma_geral ? 'bg-violet-600' : 'bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                              acc.incluir_na_soma_geral ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAdjustModal(acc)}
                          className="py-2 px-2.5 rounded-xl text-xs font-semibold surface-elevated hover:border-app-primary flex items-center justify-center gap-1.5 transition-all"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-app-primary" />
                          <span>Ajustar Saldo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(acc.id)}
                          className="py-2 px-2.5 rounded-xl text-xs font-semibold surface-elevated hover:border-app-accent flex items-center justify-center gap-1.5 transition-all"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-app-accent" />
                          <span>Transferir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-bloco 1.2: Carteira Física (Dinheiro em Espécie Separado) */}
        <div className="surface-card rounded-2xl p-6 space-y-4 border border-cyan-500/25">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  Carteira Física (Dinheiro em Espécie)
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {bankAccounts.length > 0 && physicalWallets.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenTransferModal(bankAccounts[0].id, physicalWallets[0].id)
                  }
                  className="surface-elevated hover:border-cyan-400 px-3.5 py-2 rounded-xl text-xs font-bold text-cyan-300 flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Sacar do Banco p/ Espécie</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleOpenCreateAccount('dinheiro_fisico')}
                className="surface-elevated hover:border-app-primary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Carteira Física</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {physicalWallets.map((wallet) => (
              <div
                key={wallet.id}
                className="surface-elevated rounded-2xl p-4 flex flex-col justify-between gap-4 border border-app-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-base">{wallet.nome}</h4>
                    <p className="text-2xl font-extrabold mt-1">
                      {formatCurrency(wallet.saldo_atual, currency, hide)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEditAccount(wallet)}
                    className="p-2 rounded-xl surface-card text-app-muted hover:text-app-text"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-app-border text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-app-muted">
                    <input
                      type="checkbox"
                      checked={wallet.incluir_na_soma_geral}
                      onChange={(e) =>
                        updateAccount(wallet.id, {
                          incluir_na_soma_geral: e.target.checked,
                        })
                      }
                      className="accent-violet-500 rounded"
                    />
                    <span>Somar no Saldo Geral</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleOpenAdjustModal(wallet)}
                    className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Ajustar Valor</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          PARTE 2: GESTÃO INTELIGENTE DE CARTÕES DE CRÉDITO & FATURAS
          ===================================================================== */}
      <section className="space-y-5 pt-4 border-t border-app-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Cartões de Crédito
            </h2>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateCard}
            className="btn-accent-theme px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cartão de Crédito</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {creditCardsMetrics.map(
            ({
              card,
              linkedAccount,
              limiteUtilizado,
              limiteDisponivel,
              percentualUso,
              faturaAtualPendente,
              faturaAtualPaga,
              proximasFaturasTotal,
              currentMonthTxs,
              nextInvoicesTxs,
            }) => (
              <div
                key={card.id}
                className="surface-card rounded-3xl overflow-hidden border border-app-border flex flex-col justify-between"
              >
                {/* Header Visual Estilo Cartão Premium */}
                <div
                  className="p-6 text-white relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${card.cor}dd 0%, #121216 95%)`,
                  }}
                >
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold tracking-tight">
                        {card.nome_cartao}
                      </h3>
                      <p className="text-xs text-white/80">
                        Débito vinculado:{' '}
                        <strong>{linkedAccount?.nome || 'Conta Principal'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCard(card)}
                        title="Configurar Cartão"
                        className="p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white/90 transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteCreditCard(card.id);
                          showFeedback('success', `Cartão "${card.nome_cartao}" removido.`);
                        }}
                        title="Excluir Cartão"
                        className="p-2 rounded-xl bg-black/30 hover:bg-rose-500/60 text-white/90 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ciclos de Fechamento e Vencimento */}
                  <div className="relative z-10 mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-300" />
                        Fecha dia <strong>{String(card.dia_fechamento).padStart(2, '0')}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-violet-300" />
                        Vence dia <strong>{String(card.dia_vencimento).padStart(2, '0')}</strong>
                      </span>
                    </div>

                    <span className="text-[11px] bg-black/30 px-2.5 py-1 rounded-lg">
                      Limite Total: <strong>{formatCurrency(card.limite_total, currency, hide)}</strong>
                    </span>
                  </div>
                </div>

                {/* Corpo do Cartão: Barra de Limite Roxo/Âmbar + Fatura Atual vs Próximas Faturas */}
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  {/* Barra de Progresso Limite Utilizado vs Limite Disponível */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-app-muted font-medium">
                        Limite Utilizado:{' '}
                        <strong className="text-rose-400">
                          {formatCurrency(limiteUtilizado, currency, hide)}
                        </strong>{' '}
                        ({percentualUso}%)
                      </span>
                      <span className="text-app-muted font-medium">
                        Disponível:{' '}
                        <strong className="text-emerald-400">
                          {formatCurrency(limiteDisponivel, currency, hide)}
                        </strong>
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-black/40 overflow-hidden p-0.5 border border-app-border">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${percentualUso}%` }}
                      />
                    </div>
                  </div>

                  {/* Caixas Comparativas: Fatura Atual vs Próximas Faturas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="surface-elevated rounded-2xl p-4 space-y-1 border-l-4 border-l-violet-500">
                      <div className="flex items-center justify-between text-[11px] text-app-muted">
                        <span>Fatura Atual ({formatMonthYearDisplay(selectedMonth)})</span>
                        <Receipt className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <p className="text-xl font-extrabold text-app-text">
                        {formatCurrency(faturaAtualPendente, currency, hide)}
                      </p>
                      <span className="text-[11px] text-app-muted block">
                        {faturaAtualPaga > 0
                          ? `Já pago neste mês: ${formatCurrency(faturaAtualPaga, currency, hide)}`
                          : `Vencimento: ${String(card.dia_vencimento).padStart(2, '0')}/${selectedMonth.split('-')[1]}`}
                      </span>
                    </div>
                    <div className="surface-elevated rounded-2xl p-4 space-y-1 border-l-4 border-l-amber-500">
                      <div className="flex items-center justify-between text-[11px] text-app-muted">
                        <span>Próximas Faturas (Pós-Fechamento)</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <p className="text-xl font-extrabold text-amber-400">
                        {formatCurrency(proximasFaturasTotal, currency, hide)}
                      </p>
                      <span className="text-[11px] text-app-muted block">
                        {nextInvoicesTxs.length} Parcela de Compras Futuras
                      </span>
                    </div>
                  </div>

                  {/* Mini-lista de Compras da Fatura Atual */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-app-muted uppercase tracking-wider text-[11px]">
                        Itens na Fatura de {formatMonthYearDisplay(selectedMonth)} (
                        {currentMonthTxs.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenCardPurchaseModal(card)}
                        className="text-xs font-bold text-app-accent hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nova Compra no Cartão</span>
                      </button>
                    </div>

                    {currentMonthTxs.length === 0 ? (
                      <div className="surface-elevated rounded-xl p-3 text-center text-xs text-app-muted">
                        Nenhuma compra registrada para a fatura de{' '}
                        {formatMonthYearDisplay(selectedMonth)}.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {currentMonthTxs.map((tx) => (
                          <div
                            key={tx.id}
                            className="surface-elevated rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold truncate block">
                                {tx.descricao}
                              </span>
                              <span className="text-[10px] text-app-muted">
                                {tx.data_vencimento}
                                {tx.parcela_atual
                                  ? ` • Parcela ${tx.parcela_atual}/${tx.total_parcelas}`
                                  : ' • À vista'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold">
                                {formatCurrency(tx.valor, currency, hide)}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  tx.status === 'pago'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {tx.status === 'pago' ? 'Pago' : 'Aberta'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ações do Cartão: Lançar Compra + Botão "Pagar Fatura" */}
                  <div className="pt-3 border-t border-app-border flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCardPurchaseModal(card)}
                      className="surface-elevated hover:border-app-primary px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-app-primary" />
                      <span>Lançar Compra</span>
                    </button>

                    <button
                      type="button"
                      disabled={faturaAtualPendente <= 0}
                      onClick={() =>
                        handleOpenPayInvoiceModal(
                          card,
                          faturaAtualPendente,
                          currentMonthTxs.filter((t) => t.status === 'pendente').length
                        )
                      }
                      className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-amber-500 text-white"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {faturaAtualPendente > 0
                          ? `Pagar Fatura (${formatCurrency(faturaAtualPendente, currency, hide)})`
                          : 'Fatura Quitada'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================================================
          MODAL 1: CRIAR / EDITAR CONTA BANCÁRIA OU CARTEIRA FÍSICA
          ===================================================================== */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-5 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingAccount ? 'Editar Conta / Carteira' : 'Nova Conta / Carteira'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="p-2 rounded-xl surface-elevated text-app-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Nome da Instituição ou Carteira
                </label>
                <input
                  type="text"
                  required
                  value={accNome}
                  onChange={(e) => setAccNome(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, Carteira Física, Reserva..."
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">Tipo de Conta</label>
                  <select
                    value={accTipo}
                    onChange={(e) => setAccTipo(e.target.value as AccountType)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="investimento">Investimento / Reserva</option>
                    <option value="dinheiro_fisico">Carteira Física (Espécie)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={accSaldoInicial}
                    onChange={(e) => setAccSaldoInicial(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-app-muted block">
                  Cor de Identificação
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccCor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        accCor === c ? 'scale-110 border-white' : 'border-transparent opacity-75'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <label className="surface-elevated rounded-xl p-3.5 flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold block">
                    Incluir na soma do Saldo Geral
                  </span>
                  <span className="text-[11px] text-app-muted">
                    Se desativado, o saldo fica isolado do KPI principal
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={accIncluirSoma}
                  onChange={(e) => setAccIncluirSoma(e.target.checked)}
                  className="w-4 h-4 accent-violet-500"
                />
              </label>

              <div className="flex items-center justify-between pt-2">
                {editingAccount ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingAccount)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Conta</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-theme px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                  >
                    Salvar Conta
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: AJUSTE RÁPIDO DE SALDO
          ===================================================================== */}
      {adjustingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-sm rounded-3xl p-6 space-y-4 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Ajuste Rápido de Saldo</h3>
              <button
                type="button"
                onClick={() => setAdjustingAccount(null)}
                className="p-1.5 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-app-muted">
              Conta: <strong className="text-app-text">{adjustingAccount.nome}</strong> • Saldo
              atual: {formatCurrency(adjustingAccount.saldo_atual, currency)}
            </p>

            <form onSubmit={handleConfirmBalanceAdjustment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Novo Saldo Real Desejado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={newTargetBalance}
                  onChange={(e) => setNewTargetBalance(e.target.value)}
                  className="w-full surface-elevated rounded-xl px-4 py-3 text-lg font-extrabold focus:outline-none focus:ring-2 focus:ring-app-primary"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingAccount(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-accent-theme px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: TRANSFERÊNCIA ENTRE CONTAS (SEM CONTAR COMO DESPESA)
          ===================================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-5 border border-app-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-app-accent" />
                  Transferência entre Contas
                </h3>
                <p className="text-xs text-app-muted">
                  Saque do banco para a carteira física ou mova valores sem contar como despesa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-2 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-rose-400">
                    Sai da Conta (Origem)
                  </label>
                  <select
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome} ({formatCurrency(acc.saldo_atual, currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-400">
                    Entra na Conta (Destino)
                  </label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome} ({formatCurrency(acc.saldo_atual, currency)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Valor da Transferência (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">Data</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Observação (Opcional)
                </label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  placeholder="Ex: Saque Caixa 24h para Carteira Física"
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-accent-theme px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                >
                  Transferir Agora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CRIAR / EDITAR CARTÃO DE CRÉDITO
          ===================================================================== */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-5 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingCard ? 'Configurar Cartão de Crédito' : 'Novo Cartão de Crédito'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="p-2 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">Nome do Cartão</label>
                <input
                  type="text"
                  required
                  value={cardNome}
                  onChange={(e) => setCardNome(e.target.value)}
                  placeholder="Ex: Nubank Ultravioleta, Itaú Black, XP Visa..."
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Conta p/ Débito da Fatura
                  </label>
                  <select
                    value={cardAccountId}
                    onChange={(e) => setCardAccountId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Limite Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={cardLimite}
                    onChange={(e) => setCardLimite(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Dia de Fechamento (1-31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={cardDiaFechamento}
                    onChange={(e) => setCardDiaFechamento(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Dia de Vencimento (1-31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={cardDiaVencimento}
                    onChange={(e) => setCardDiaVencimento(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-app-muted block">
                  Cor do Cartão
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCardCor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        cardCor === c ? 'scale-110 border-white' : 'border-transparent opacity-75'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-accent-theme px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                >
                  Salvar Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: CONFIRMAR PAGAMENTO DE FATURA (BAIXA + DÉBITO NA CONTA)
          ===================================================================== */}
      {payingInvoiceCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-5 border border-app-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Pagar Fatura do Cartão</h3>
              <button
                type="button"
                onClick={() => setPayingInvoiceCard(null)}
                className="p-2 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="surface-elevated rounded-2xl p-4 space-y-1 border-l-4 border-l-amber-500">
              <span className="text-xs text-app-muted">
                {payingInvoiceCard.card.nome_cartao} • Competência{' '}
                {formatMonthYearDisplay(selectedMonth)}
              </span>
              <p className="text-2xl font-extrabold text-amber-400">
                {formatCurrency(payingInvoiceCard.invoiceAmount, currency)}
              </p>
              <span className="text-[11px] text-app-muted block">
                {payingInvoiceCard.pendingCount} lançamento(s) receberão baixa automática ("Pago")
              </span>
            </div>

            <form onSubmit={handleConfirmPayInvoice} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Debitar valor do saldo de qual conta bancária?
                </label>
                <select
                  value={selectedDebitAccountId}
                  onChange={(e) => setSelectedDebitAccountId(e.target.value)}
                  className="w-full surface-elevated rounded-xl px-3.5 py-3 text-sm font-semibold"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nome} (Saldo: {formatCurrency(acc.saldo_atual, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoiceCard(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-amber-500 text-white shadow-lg flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Pagamento e Debitar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: LANÇAR COMPRA NO CARTÃO (COM SIMULADOR DE DIA DE FECHAMENTO)
          ===================================================================== */}
      {purchaseCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="surface-card w-full max-w-md rounded-3xl p-6 space-y-4 border border-app-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold">
                  Nova Compra — {purchaseCard.nome_cartao}
                </h3>
                <p className="text-xs text-app-muted">
                  Fechamento todo dia{' '}
                  <strong>{String(purchaseCard.dia_fechamento).padStart(2, '0')}</strong> •
                  Vencimento dia{' '}
                  <strong>{String(purchaseCard.dia_vencimento).padStart(2, '0')}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseCard(null)}
                className="p-2 rounded-xl surface-elevated text-app-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso inteligente se a data escolhida é após o dia de fechamento */}
            {(() => {
              const chosenDay = Number(purchaseDate.split('-')[2] || 1);
              const isAfterClosing = chosenDay > purchaseCard.dia_fechamento;
              const targetMonth = isAfterClosing
                ? shiftYearMonth(purchaseDate.slice(0, 7), 1)
                : purchaseDate.slice(0, 7);

              return (
                <div
                  className={`rounded-2xl p-3 text-xs flex items-center gap-2.5 border ${
                    isAfterClosing
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : 'bg-violet-500/15 border-violet-500/35 text-violet-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    {isAfterClosing ? (
                      <>
                        Compra no dia <strong>{chosenDay}</strong> (após fechamento dia{' '}
                        {purchaseCard.dia_fechamento}): irá automaticamente para a{' '}
                        <strong>Próxima Fatura ({formatMonthYearDisplay(targetMonth)})</strong>.
                      </>
                    ) : (
                      <>
                        Compra até o fechamento (dia {purchaseCard.dia_fechamento}): entrará na{' '}
                        <strong>Fatura de {formatMonthYearDisplay(targetMonth)}</strong>.
                      </>
                    )}
                  </span>
                </div>
              );
            })()}

            <form onSubmit={handleCreateCardPurchase} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Descrição da Compra
                </label>
                <input
                  type="text"
                  required
                  value={purchaseDesc}
                  onChange={(e) => setPurchaseDesc(e.target.value)}
                  placeholder="Ex: Amazon, Restaurante, Notebook..."
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    {purchaseNatureza === 'parcelada' ? 'Valor da Parcela (R$)' : 'Valor (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">Data da Compra</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">Categoria</label>
                  <select
                    value={purchaseCategoryId}
                    onChange={(e) => setPurchaseCategoryId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">Condição</label>
                  <select
                    value={purchaseNatureza}
                    onChange={(e) => setPurchaseNatureza(e.target.value as TransactionNature)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="variavel">À vista (1x)</option>
                    <option value="parcelada">Parcelada (N vezes)</option>
                    <option value="fixa">Assinatura Recorrente</option>
                  </select>
                </div>
              </div>

              {purchaseNatureza === 'parcelada' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Quantidade de Parcelas
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={36}
                    value={purchaseParcelas}
                    onChange={(e) => setPurchaseParcelas(Number(e.target.value))}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPurchaseCard(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-accent-theme px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                >
                  Confirmar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

