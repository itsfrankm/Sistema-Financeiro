import React, { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Building2,
  Banknote,
  CreditCard as CreditCardIcon,
  Calendar,
  Repeat,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  TransactionNature,
  TransactionStatus,
  TransactionType,
} from '../../types/finance';
import { formatCurrency, formatMonthYearDisplay, shiftYearMonth } from '../../lib/utils';

// Schema Zod para validação rigorosa do formulário de Lançamento
const TransactionFormSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(2, 'A descrição deve ter pelo menos 2 caracteres.'),
  valor: z
    .number({ invalid_type_error: 'Informe um valor numérico válido.' })
    .positive('O valor deve ser maior que R$ 0,00.'),
  data_vencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida (AAAA-MM-DD).'),
  category_id: z.string().min(1, 'Selecione uma categoria.'),
  paymentMethod: z.enum(['bank_account', 'physical_wallet', 'credit_card']),
  targetId: z.string().min(1, 'Selecione a conta, carteira ou cartão.'),
  natureza: z.enum(['variavel', 'fixa', 'parcelada']),
  total_parcelas: z.number().int().min(2).max(24).optional(),
  status: z.enum(['pago', 'pendente']),
});

const TransferFormSchema = z
  .object({
    descricao: z.string().trim().optional(),
    valor: z
      .number({ invalid_type_error: 'Informe um valor numérico válido.' })
      .positive('O valor da transferência deve ser maior que R$ 0,00.'),
    data_vencimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
    fromAccountId: z.string().min(1, 'Selecione a conta de origem.'),
    toAccountId: z.string().min(1, 'Selecione a conta de destino.'),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'A conta de destino deve ser diferente da conta de origem.',
    path: ['toAccountId'],
  });

type PaymentMethodKind = 'bank_account' | 'physical_wallet' | 'credit_card';

export const TransactionModal: React.FC = () => {
  const {
    isQuickTransactionOpen,
    setIsQuickTransactionOpen,
    editingTransaction,
    setEditingTransaction,
    selectedMonth,
    userSettings,
    accounts,
    creditCards,
    categories,
    addTransaction,
    updateTransaction,
    transferBetweenAccounts,
  } = useFinance();

  const isOpen = isQuickTransactionOpen || Boolean(editingTransaction);

  // Abas superiores: Despesa | Receita | Transferência
  const [tipo, setTipo] = useState<TransactionType>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(
    () => `${selectedMonth}-${String(new Date().getDate()).padStart(2, '0')}`
  );
  const [categoryId, setCategoryId] = useState('');

  // Forma de Pagamento: Conta Bancária | Carteira Física | Cartão de Crédito
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKind>('bank_account');
  const [targetId, setTargetId] = useState('');

  // Campos de Transferência
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  // Natureza: Variável / Único | Fixa Mensal | Compra Parcelada (2x até 24x)
  const [natureza, setNatureza] = useState<TransactionNature>('variavel');
  const [totalParcelas, setTotalParcelas] = useState<number>(2);
  const [status, setStatus] = useState<TransactionStatus>('pago');

  // Erros de validação Zod
  const [zodErrors, setZodErrors] = useState<Record<string, string>>({});

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.tipo !== 'dinheiro_fisico'),
    [accounts]
  );
  const physicalWallets = useMemo(
    () => accounts.filter((a) => a.tipo === 'dinheiro_fisico'),
    [accounts]
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        tipo === 'receita' ? c.tipo === 'receita' : c.tipo === 'despesa'
      ),
    [categories, tipo]
  );

  // Sincroniza estado inicial ao abrir para Criação ou Edição
  useEffect(() => {
    if (!isOpen) return;
    setZodErrors({});

    if (editingTransaction) {
      setTipo(editingTransaction.tipo);
      setDescricao(editingTransaction.descricao);
      setValor(String(editingTransaction.valor));
      setDataVencimento(editingTransaction.data_vencimento);
      setCategoryId(editingTransaction.category_id);
      setNatureza(editingTransaction.natureza);
      setTotalParcelas(editingTransaction.total_parcelas ?? 2);
      setStatus(editingTransaction.status);

      if (editingTransaction.credit_card_id) {
        setPaymentMethod('credit_card');
        setTargetId(editingTransaction.credit_card_id);
      } else {
        const linkedAcc = accounts.find((a) => a.id === editingTransaction.account_id);
        if (linkedAcc?.tipo === 'dinheiro_fisico') {
          setPaymentMethod('physical_wallet');
          setTargetId(linkedAcc.id);
        } else {
          setPaymentMethod('bank_account');
          setTargetId(editingTransaction.account_id || bankAccounts[0]?.id || '');
        }
      }
    } else {
      // Modo Novo Lançamento
      setTipo('despesa');
      setDescricao('');
      setValor('');
      const defaultDay = String(new Date().getDate()).padStart(2, '0');
      setDataVencimento(`${selectedMonth}-${defaultDay}`);
      const firstExpenseCat =
        categories.find((c) => c.tipo === 'despesa')?.id || categories[0]?.id || '';
      setCategoryId(firstExpenseCat);
      setPaymentMethod('bank_account');
      setTargetId(bankAccounts[0]?.id || accounts[0]?.id || '');
      setFromAccountId(bankAccounts[0]?.id || accounts[0]?.id || '');
      setToAccountId(
        physicalWallets[0]?.id ||
          accounts.find((a) => a.id !== (bankAccounts[0]?.id || ''))?.id ||
          ''
      );
      setNatureza('variavel');
      setTotalParcelas(2);
      setStatus('pago');
    }
  }, [isOpen, editingTransaction, selectedMonth, accounts, bankAccounts, physicalWallets, categories]);

  // Atualiza targetId padrão ao trocar forma de pagamento
  const handleSelectPaymentMethod = (method: PaymentMethodKind) => {
    setPaymentMethod(method);
    setZodErrors((prev) => ({ ...prev, targetId: '' }));
    if (method === 'bank_account') {
      setTargetId(bankAccounts[0]?.id || accounts[0]?.id || '');
    } else if (method === 'physical_wallet') {
      setTargetId(physicalWallets[0]?.id || accounts[0]?.id || '');
    } else if (method === 'credit_card') {
      setTargetId(creditCards[0]?.id || '');
      setStatus('pendente'); // Compras no cartão entram como fatura pendente até o pagamento
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    setIsQuickTransactionOpen(false);
    setEditingTransaction(null);
    setZodErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setZodErrors({});

    const parsedValor = parseFloat(valor.replace(',', '.'));

    // Fluxo 1: Transferência entre Contas
    if (tipo === 'transferencia') {
      const validation = TransferFormSchema.safeParse({
        descricao,
        valor: parsedValor,
        data_vencimento: dataVencimento,
        fromAccountId,
        toAccountId,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          const key = String(err.path[0] || 'form');
          fieldErrors[key] = err.message;
        });
        setZodErrors(fieldErrors);
        return;
      }

      const res = transferBetweenAccounts({
        fromAccountId: validation.data.fromAccountId,
        toAccountId: validation.data.toAccountId,
        amount: validation.data.valor,
        date: validation.data.data_vencimento,
        description: validation.data.descricao,
      });

      if (!res.success) {
        setZodErrors({ form: res.error || 'Erro ao realizar transferência.' });
        return;
      }

      handleClose();
      return;
    }

    // Fluxo 2: Despesa ou Receita (Validado com Zod)
    const effectiveCategoryId =
      categoryId || filteredCategories[0]?.id || categories[0]?.id || '';

    const validation = TransactionFormSchema.safeParse({
      descricao,
      valor: parsedValor,
      data_vencimento: dataVencimento,
      category_id: effectiveCategoryId,
      paymentMethod,
      targetId,
      natureza,
      total_parcelas: natureza === 'parcelada' ? totalParcelas : undefined,
      status: paymentMethod === 'credit_card' ? 'pendente' : status,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const key = String(err.path[0] || 'form');
        fieldErrors[key] = err.message;
      });
      setZodErrors(fieldErrors);
      return;
    }

    const validData = validation.data;
    const isCard = validData.paymentMethod === 'credit_card';

    if (editingTransaction) {
      updateTransaction(editingTransaction.id, {
        descricao: validData.descricao,
        valor: validData.valor,
        data_vencimento: validData.data_vencimento,
        category_id: validData.category_id,
        account_id: isCard ? null : validData.targetId,
        credit_card_id: isCard ? validData.targetId : null,
        tipo,
        natureza: validData.natureza,
        status: validData.status,
        data_pagamento: validData.status === 'pago' ? validData.data_vencimento : null,
      });
    } else {
      addTransaction({
        account_id: isCard ? null : validData.targetId,
        credit_card_id: isCard ? validData.targetId : null,
        category_id: validData.category_id,
        descricao: validData.descricao,
        valor: validData.valor,
        tipo,
        natureza: validData.natureza,
        total_parcelas:
          validData.natureza === 'parcelada' ? validData.total_parcelas ?? 2 : null,
        status: validData.status,
        data_vencimento: validData.data_vencimento,
        data_pagamento: validData.status === 'pago' ? validData.data_vencimento : null,
      });
    }

    handleClose();
  };

  const selectedCardObj =
    paymentMethod === 'credit_card'
      ? creditCards.find((cc) => cc.id === targetId)
      : null;

  const numericPreviewVal = parseFloat(valor.replace(',', '.')) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      {/* Modal Centralizado (Web) / Gaveta Deslizante Bottom Sheet (Mobile) */}
      <div className="surface-card w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 space-y-5 border border-app-border shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Handle visual de Bottom Sheet no Mobile */}
        <div className="w-12 h-1.5 rounded-full bg-zinc-700 mx-auto sm:hidden" />

        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-app-accent flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Motor Inteligente de Lançamentos
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
              {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl surface-elevated text-app-muted hover:text-app-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor Superior com 3 Abas Rápidas: Despesa (Vermelho), Receita (Esmeralda), Transferência (Roxo/Azul) */}
        {!editingTransaction && (
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl surface-elevated border border-app-border">
            <button
              type="button"
              onClick={() => {
                setTipo('despesa');
                const firstExp = categories.find((c) => c.tipo === 'despesa')?.id || '';
                setCategoryId(firstExp);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                tipo === 'despesa'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4 shrink-0" />
              <span>Despesa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTipo('receita');
                if (paymentMethod === 'credit_card') {
                  handleSelectPaymentMethod('bank_account');
                }
                const firstRec = categories.find((c) => c.tipo === 'receita')?.id || '';
                setCategoryId(firstRec);
              }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                tipo === 'receita'
                  ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4 shrink-0" />
              <span>Receita</span>
            </button>

            <button
              type="button"
              onClick={() => setTipo('transferencia')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                tipo === 'transferencia'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              <span>Transferência</span>
            </button>
          </div>
        )}

        {zodErrors.form && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{zodErrors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* =================================================================
              MODO A: FORMULÁRIO DE TRANSFERÊNCIA ENTRE CONTAS
              ================================================================= */}
          {tipo === 'transferencia' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-rose-400">
                    Conta de Origem (Sai de)
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome} ({formatCurrency(acc.saldo_atual, userSettings.moeda)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-emerald-400">
                    Conta de Destino (Entra em)
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome} ({formatCurrency(acc.saldo_atual, userSettings.moeda)})
                      </option>
                    ))}
                  </select>
                  {zodErrors.toAccountId && (
                    <span className="text-[11px] text-rose-400 block">
                      {zodErrors.toAccountId}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Valor da Transferência (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {zodErrors.valor && (
                    <span className="text-[11px] text-rose-400 block">{zodErrors.valor}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Data da Transferência
                  </label>
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Descrição / Observação (Opcional)
                </label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Saque para Carteira Física, Reserva..."
                  className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            </>
          ) : (
            /* =================================================================
               MODO B: FORMULÁRIO DE DESPESA OU RECEITA (COM ZOD E PARCELAMENTO)
               ================================================================= */
            <>
              {/* Descrição e Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Descrição do Lançamento
                  </label>
                  <input
                    type="text"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder={
                      tipo === 'receita'
                        ? 'Ex: Salário Mensal, Consultoria, Dividendos...'
                        : 'Ex: Supermercado, Aluguel, Monitor Dell...'
                    }
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  />
                  {zodErrors.descricao && (
                    <span className="text-[11px] text-rose-400 block">
                      {zodErrors.descricao}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    {natureza === 'parcelada' ? 'Valor da Parcela (R$)' : 'Valor (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-app-primary"
                  />
                  {zodErrors.valor && (
                    <span className="text-[11px] text-rose-400 block">{zodErrors.valor}</span>
                  )}
                </div>
              </div>

              {/* Data de Vencimento/Competência e Categoria 50-30-20 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Data de Vencimento / Competência
                  </label>
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  />
                  {zodErrors.data_vencimento && (
                    <span className="text-[11px] text-rose-400 block">
                      {zodErrors.data_vencimento}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                  >
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                        {cat.percentual_meta
                          ? ` • [${cat.percentual_meta}%]`
                          : userSettings.usar_regra_50_30_20 &&
                            cat.tipo === 'despesa' &&
                            cat.regra_50_30_20
                          ? cat.regra_50_30_20 === 'essencial_50'
                            ? ` • [${userSettings.pct_essencial ?? 50}% Essencial]`
                            : cat.regra_50_30_20 === 'estilo_vida_30'
                            ? ` • [${userSettings.pct_estilo_vida ?? 30}% Estilo de Vida]`
                            : ` • [${userSettings.pct_futuro ?? 20}% Futuro]`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Forma de Pagamento: Conta Bancária, Carteira Física ou Cartão de Crédito */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-app-muted block">
                  Forma de Movimentação / Origem
                </label>
                <div
                  className={`grid gap-2 ${
                    tipo === 'despesa' ? 'grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('bank_account')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'bank_account'
                        ? 'border-app-primary bg-app-elevated text-app-text shadow-sm'
                        : 'border-app-border text-app-muted hover:text-app-text'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="truncate">Conta Bancária</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('physical_wallet')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'physical_wallet'
                        ? 'border-cyan-400 bg-app-elevated text-cyan-300 shadow-sm'
                        : 'border-app-border text-app-muted hover:text-app-text'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">Carteira Física</span>
                  </button>

                  {tipo === 'despesa' && (
                    <button
                      type="button"
                      onClick={() => handleSelectPaymentMethod('credit_card')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'credit_card'
                          ? 'border-amber-400 bg-app-elevated text-amber-300 shadow-sm'
                          : 'border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      <CreditCardIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Cartão de Crédito</span>
                    </button>
                  )}
                </div>

                {/* Select da Conta, Carteira Física ou Cartão correspondente */}
                <div>
                  {paymentMethod === 'bank_account' && (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                    >
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.nome} (Saldo: {formatCurrency(acc.saldo_atual, userSettings.moeda)})
                        </option>
                      ))}
                    </select>
                  )}

                  {paymentMethod === 'physical_wallet' && (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                    >
                      {(physicalWallets.length > 0 ? physicalWallets : accounts).map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.nome} (Espécie: {formatCurrency(acc.saldo_atual, userSettings.moeda)})
                        </option>
                      ))}
                    </select>
                  )}

                  {paymentMethod === 'credit_card' && (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm"
                    >
                      {creditCards.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.nome_cartao} (Fecha dia {cc.dia_fechamento} • Vence dia{' '}
                          {cc.dia_vencimento})
                        </option>
                      ))}
                    </select>
                  )}
                  {zodErrors.targetId && (
                    <span className="text-[11px] text-rose-400 block mt-1">
                      {zodErrors.targetId}
                    </span>
                  )}
                </div>

                {/* Aviso automático de dia de fechamento quando for Cartão de Crédito */}
                {selectedCardObj && dataVencimento && (
                  <div className="rounded-xl px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {Number(dataVencimento.split('-')[2]) >
                      selectedCardObj.dia_fechamento ? (
                        <>
                          Compra após o fechamento (dia {selectedCardObj.dia_fechamento}): cairá
                          automaticamente na fatura de{' '}
                          <strong>
                            {formatMonthYearDisplay(
                              shiftYearMonth(dataVencimento.slice(0, 7), 1)
                            )}
                          </strong>
                          .
                        </>
                      ) : (
                        <>
                          Compra dentro do ciclo atual: entrará na fatura de{' '}
                          <strong>
                            {formatMonthYearDisplay(dataVencimento.slice(0, 7))}
                          </strong>
                          .
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Seletor de Natureza do Lançamento: a) Variável/Único, b) Fixa Mensal, c) Compra Parcelada */}
              {!editingTransaction && (
                <div className="space-y-2.5 pt-1">
                  <label className="text-xs font-semibold text-app-muted block">
                    Natureza do Lançamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNatureza('variavel')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        natureza === 'variavel'
                          ? 'border-app-primary bg-app-elevated text-app-text'
                          : 'border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      <span className="text-xs font-bold block">Variável / Único</span>
                      <span className="text-[10px] text-app-muted">Apenas neste mês</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNatureza('fixa')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        natureza === 'fixa'
                          ? 'border-violet-400 bg-app-elevated text-violet-300'
                          : 'border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        Fixa Mensal
                      </span>
                      <span className="text-[10px] text-app-muted">Projeta 12 meses</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNatureza('parcelada')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        natureza === 'parcelada'
                          ? 'border-amber-400 bg-app-elevated text-amber-300'
                          : 'border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        Parcelada
                      </span>
                      <span className="text-[10px] text-app-muted">De 2x até 24x</span>
                    </button>
                  </div>

                  {/* Se for Compra Parcelada: seletor de 2x até 24x + resumo automático */}
                  {natureza === 'parcelada' && (
                    <div className="surface-elevated rounded-2xl p-4 space-y-3 border border-amber-500/30">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <label className="text-xs font-bold text-amber-300 block">
                            Número de Parcelas (2x até 24x)
                          </label>
                          <p className="text-[11px] text-app-muted">
                            Gera automaticamente as parcelas <code>1/{totalParcelas}</code> até{' '}
                            <code>
                              {totalParcelas}/{totalParcelas}
                            </code>{' '}
                            nos meses consecutivos.
                          </p>
                        </div>

                        <select
                          value={totalParcelas}
                          onChange={(e) => setTotalParcelas(Number(e.target.value))}
                          className="surface-card rounded-xl px-3 py-2 text-sm font-extrabold text-amber-400 border border-amber-500/40"
                        >
                          {Array.from({ length: 23 }, (_, idx) => idx + 2).map((n) => (
                            <option key={n} value={n}>
                              {n}x
                            </option>
                          ))}
                        </select>
                      </div>

                      {numericPreviewVal > 0 && (
                        <div className="pt-2 border-t border-app-border flex items-center justify-between text-xs">
                          <span className="text-app-muted">Comprometimento Total:</span>
                          <span className="font-extrabold text-amber-400">
                            {totalParcelas}x de{' '}
                            {formatCurrency(numericPreviewVal, userSettings.moeda)} ={' '}
                            {formatCurrency(
                              numericPreviewVal * totalParcelas,
                              userSettings.moeda
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {natureza === 'fixa' && (
                    <div className="surface-elevated rounded-xl px-3.5 py-2.5 text-[11px] text-violet-300 flex items-center gap-2 border border-violet-500/30">
                      <Repeat className="w-4 h-4 shrink-0" />
                      <span>
                        Lançamento fixo recorrente: será repetido automaticamente nos próximos 12 meses para projeção de fluxo de caixa.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle: Já foi pago/recebido? (Pago vs Pendente) */}
              {paymentMethod !== 'credit_card' && (
                <div className="surface-elevated rounded-2xl p-3.5 flex items-center justify-between border border-app-border">
                  <div className="flex items-center gap-2.5">
                    {status === 'pago' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-bold block">
                        {tipo === 'receita' ? 'Já foi recebido?' : 'Já foi pago?'}
                      </span>
                      <span className="text-[11px] text-app-muted">
                        {status === 'pago'
                          ? 'Status: Liquidado (Atualiza o saldo real da conta imediatamente)'
                          : 'Status: Pendente (Agendado para baixa futura com 1 clique)'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setStatus((prev) => (prev === 'pago' ? 'pendente' : 'pago'))
                    }
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      status === 'pago'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {status === 'pago' ? 'Pago ✓' : 'Pendente'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold surface-elevated text-app-muted hover:text-app-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
                tipo === 'receita'
                  ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                  : tipo === 'transferencia'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-500 hover:brightness-110'
                  : 'bg-gradient-to-r from-violet-600 to-amber-500 hover:brightness-110'
              }`}
            >
              {editingTransaction
                ? 'Salvar Alterações'
                : tipo === 'transferencia'
                ? 'Confirmar Transferência'
                : natureza === 'parcelada'
                ? `Gerar ${totalParcelas} Parcelas`
                : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

