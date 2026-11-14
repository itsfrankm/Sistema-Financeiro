import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  Account,
  Budget,
  Category,
  CreditCard,
  Transaction,
  UserSettings,
} from '../types/finance';
import { Rule503020Breakdown } from '../context/FinanceContext';
import { formatCurrency, formatMonthYearDisplay } from '../lib/utils';

export interface ExportFinancePdfParams {
  holderName: string;
  periodLabel: 'Diário' | 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  selectedMonth: string;
  customCompetenceLabel?: string;
  filteredTransactions?: Transaction[];
  userSettings: UserSettings;
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  rule503020Summary: Rule503020Breakdown;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Gera e faz o download do Relatório e Planejamento Executivo em 1 folha A4 Retrato
 * com margens exatas de 8mm e cores HEX 100% sólidas (#09090b, #121216, #8b5cf6, #f59e0b, #10b981, #f43f5e, #ffffff).
 */
export async function exportFinancePdf(params: ExportFinancePdfParams): Promise<void> {
  const {
    holderName,
    periodLabel,
    selectedMonth,
    customCompetenceLabel,
    filteredTransactions,
    userSettings,
    accounts,
    creditCards,
    categories,
    budgets,
    transactions,
    rule503020Summary,
  } = params;

  const currency = userSettings.moeda || 'BRL';
  const selectedYear = selectedMonth.slice(0, 4);
  const competenceDisplay =
    customCompetenceLabel ||
    (periodLabel === 'Anual'
      ? `Ano ${selectedYear}`
      : formatMonthYearDisplay(selectedMonth));

  // Filtra lançamentos do período
  const periodTxs = (
    filteredTransactions ??
    transactions.filter((tx) =>
      periodLabel === 'Anual'
        ? tx.data_vencimento.startsWith(selectedYear)
        : tx.data_vencimento.startsWith(selectedMonth)
    )
  ).sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));

  // Cálculos dos 4 Indicadores Principais
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

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const cardMap = new Map(creditCards.map((cc) => [cc.id, cc]));

  // Resumo de Teto de Orçamento por Categoria (Mês Selecionado)
  const expenseCategories = categories.filter((c) => c.tipo === 'despesa');
  const budgetRows = expenseCategories
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

  // Paginação automática: até 14 lançamentos na Página 1 (junto com os cards e orçamento)
  // e até 28 lançamentos por página complementar (Página 2, 3, ...)
  const FIRST_PAGE_LIMIT = 14;
  const NEXT_PAGE_LIMIT = 28;

  const firstPageRows = periodTxs.slice(0, FIRST_PAGE_LIMIT);
  const extraPagesRows: { rows: Transaction[]; startIndex: number; endIndex: number }[] = [];

  for (let i = FIRST_PAGE_LIMIT; i < periodTxs.length; i += NEXT_PAGE_LIMIT) {
    const slice = periodTxs.slice(i, i + NEXT_PAGE_LIMIT);
    extraPagesRows.push({
      rows: slice,
      startIndex: i + 1,
      endIndex: i + slice.length,
    });
  }

  const totalPages = 1 + extraPagesRows.length;

  const emittedAt = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const renderTransactionsRowsHtml = (rows: Transaction[]) => {
    if (rows.length === 0) {
      return `<tr><td colspan="6" style="padding: 14px; text-align: center; color: #a1a1aa;">Nenhum lançamento registrado neste período.</td></tr>`;
    }

    return rows
      .map((tx) => {
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

        return `
          <tr style="border-bottom: 1px solid #27272a; break-inside: avoid;">
            <td style="padding: 5px 8px; color: #a1a1aa; font-family: monospace; white-space: nowrap;">
              ${formatDateBr(tx.data_vencimento)}
            </td>
            <td style="padding: 5px 8px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(tx.descricao + parcelaSuffix)}
            </td>
            <td style="padding: 5px 8px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(cat?.nome || 'Transferência')}
            </td>
            <td style="padding: 5px 8px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(originName)}
            </td>
            <td style="padding: 5px 8px; white-space: nowrap;">
              <span style="color: ${tx.status === 'pago' ? '#10b981' : '#f59e0b'}; font-weight: 700; white-space: nowrap;">
                ${tx.status === 'pago' ? 'Pago' : 'Pendente'}
              </span>
            </td>
            <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: ${valColor}; white-space: nowrap;">
              ${prefix}${formatCurrency(tx.valor, currency)}
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const renderTransactionsTableHeadHtml = () => `
    <thead>
      <tr style="background-color: #09090b; color: #a1a1aa; text-transform: uppercase; text-align: left;">
        <th style="width: 12%; padding: 6px 8px; border-bottom: 1px solid #27272a; white-space: nowrap;">Data</th>
        <th style="width: 27%; padding: 6px 8px; border-bottom: 1px solid #27272a;">Descrição</th>
        <th style="width: 17%; padding: 6px 8px; border-bottom: 1px solid #27272a;">Categoria</th>
        <th style="width: 17%; padding: 6px 8px; border-bottom: 1px solid #27272a;">Conta / Cartão</th>
        <th style="width: 10%; padding: 6px 8px; border-bottom: 1px solid #27272a; white-space: nowrap;">Status</th>
        <th style="width: 17%; padding: 6px 8px; border-bottom: 1px solid #27272a; text-align: right; white-space: nowrap;">Valor</th>
      </tr>
    </thead>
  `;

  const firstPageSubtitle =
    totalPages > 1
      ? `Exibindo 1 a ${firstPageRows.length} de ${periodTxs.length} lançamentos • Continua na página 2`
      : `Exibindo ${firstPageRows.length} de ${periodTxs.length} lançamentos da competência`;

  // Cria container offscreen que abrigará cada folha A4 individualmente
  const hostWrapper = document.createElement('div');
  hostWrapper.style.position = 'fixed';
  hostWrapper.style.left = '-9999px';
  hostWrapper.style.top = '0';
  hostWrapper.style.width = '794px';
  hostWrapper.style.backgroundColor = '#09090b';
  hostWrapper.style.color = '#ffffff';
  hostWrapper.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";

  const createPageElement = (innerHtml: string) => {
    const pageEl = document.createElement('div');
    pageEl.style.width = '794px'; // Proporção A4 Retrato exata em 96 DPI
    pageEl.style.backgroundColor = '#09090b';
    pageEl.style.color = '#ffffff';
    pageEl.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
    pageEl.style.padding = '24px';
    pageEl.style.boxSizing = 'border-box';
    pageEl.innerHTML = innerHtml;
    return pageEl;
  };

  // PÁGINA 1: Cabeçalho + 5 Cards + Teto de Orçamento + Primeiros 14 Lançamentos
  const page1Html = `
    <div style="background-color: #09090b; color: #ffffff; border: 1px solid #27272a; border-radius: 16px; padding: 20px; box-sizing: border-box;">
      <!-- CABEÇALHO EXECUTIVO -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #8b5cf6; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <div style="display: inline-block; background-color: #8b5cf6; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 6px; margin-bottom: 4px;">
            Gestor Financeiro • Relatório Executivo A4
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">
            Planejamento & Demonstrativo Financeiro
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #a1a1aa;">
            Titular: <strong style="color: #ffffff;">${escapeHtml(holderName)}</strong>
          </p>
        </div>
        <div style="text-align: right; background-color: #121216; border: 1px solid #27272a; border-radius: 10px; padding: 8px 14px;">
          <div style="font-size: 10px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">
            Período Analítico: <span style="color: #f59e0b;">${escapeHtml(periodLabel)}</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-top: 2px;">
            Competência: ${escapeHtml(competenceDisplay)}
          </div>
          <div style="font-size: 10px; color: #a1a1aa; margin-top: 2px;">
            Emissão: ${escapeHtml(emittedAt)}
          </div>
        </div>
      </div>

      <!-- OS 5 CARDS PRINCIPAIS (4 INDICADORES + RESUMO DA REGRA) -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px;">
        <div style="background-color: #121216; border: 1px solid #27272a; border-top: 3px solid #8b5cf6; border-radius: 12px; padding: 10px;">
          <div style="font-size: 9px; color: #a1a1aa; font-weight: 700; text-transform: uppercase;">
            Saldo Atual (Realizado)
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 6px; white-space: nowrap;">
            ${formatCurrency(saldoAtual, currency)}
          </div>
          <div style="font-size: 8.5px; color: #a1a1aa; margin-top: 4px;">
            Disponível em contas + espécie
          </div>
        </div>

        <div style="background-color: #121216; border: 1px solid #27272a; border-top: 3px solid #10b981; border-radius: 12px; padding: 10px;">
          <div style="font-size: 9px; color: #a1a1aa; font-weight: 700; text-transform: uppercase;">
            Receitas do Período
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #10b981; margin-top: 6px; white-space: nowrap;">
            ${formatCurrency(receitasTotal, currency)}
          </div>
          <div style="font-size: 8.5px; color: #a1a1aa; margin-top: 4px; line-height: 1.3;">
            Recebido: ${formatCurrency(receitasRecebidas, currency)}<br/>Prev.: ${formatCurrency(receitasPendentes, currency)}
          </div>
        </div>

        <div style="background-color: #121216; border: 1px solid #27272a; border-top: 3px solid #f43f5e; border-radius: 12px; padding: 10px;">
          <div style="font-size: 9px; color: #a1a1aa; font-weight: 700; text-transform: uppercase;">
            Despesas do Período
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #f43f5e; margin-top: 6px; white-space: nowrap;">
            ${formatCurrency(despesasTotal, currency)}
          </div>
          <div style="font-size: 8.5px; color: #a1a1aa; margin-top: 4px; line-height: 1.3;">
            Pago: ${formatCurrency(despesasPagas, currency)}<br/>Pend.: ${formatCurrency(despesasPendentes, currency)}
          </div>
        </div>

        <div style="background-color: #121216; border: 1px solid #f59e0b; border-top: 3px solid #f59e0b; border-radius: 12px; padding: 10px;">
          <div style="font-size: 9px; color: #f59e0b; font-weight: 800; text-transform: uppercase;">
            Saldo Projetado
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 6px; white-space: nowrap;">
            ${formatCurrency(saldoProjetado, currency)}
          </div>
          <div style="font-size: 8.5px; color: #f59e0b; margin-top: 4px; font-weight: 700; line-height: 1.3;">
            Economia Líquida: ${pctEconomia}%<br/>(${formatCurrency(economiaLiquida, currency)})
          </div>
        </div>

        <!-- 5º Card: Resumo da Regra -->
        <div style="background-color: #121216; border: 1px solid #27272a; border-top: 3px solid #38bdf8; border-radius: 12px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #ffffff; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #27272a; padding-bottom: 3px;">
            Resumo da Regra
          </div>

          <div style="margin-bottom: 5px;">
            <div style="display: flex; justify-content: space-between; font-size: 8px; margin-bottom: 2px;">
              <span style="color: #8b5cf6; font-weight: 700;">Essencial</span>
              <span style="color: #ffffff; font-weight: 700; white-space: nowrap;">
                ${formatCurrency(rule503020Summary.essencial_50.gasto, currency)} (${rule503020Summary.essencial_50.percentualReceita}%)
              </span>
            </div>
            <div style="width: 100%; height: 4px; background-color: #09090b; border-radius: 999px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, (rule503020Summary.essencial_50.percentualReceita / 50) * 100)}%; background-color: #8b5cf6;"></div>
            </div>
          </div>

          <div style="margin-bottom: 5px;">
            <div style="display: flex; justify-content: space-between; font-size: 8px; margin-bottom: 2px;">
              <span style="color: #f59e0b; font-weight: 700;">Estilo</span>
              <span style="color: #ffffff; font-weight: 700; white-space: nowrap;">
                ${formatCurrency(rule503020Summary.estilo_vida_30.gasto, currency)} (${rule503020Summary.estilo_vida_30.percentualReceita}%)
              </span>
            </div>
            <div style="width: 100%; height: 4px; background-color: #09090b; border-radius: 999px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, (rule503020Summary.estilo_vida_30.percentualReceita / 30) * 100)}%; background-color: #f59e0b;"></div>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 8px; margin-bottom: 2px;">
              <span style="color: #10b981; font-weight: 700;">Futuro</span>
              <span style="color: #ffffff; font-weight: 700; white-space: nowrap;">
                ${formatCurrency(rule503020Summary.futuro_20.gasto, currency)} (${rule503020Summary.futuro_20.percentualReceita}%)
              </span>
            </div>
            <div style="width: 100%; height: 4px; background-color: #09090b; border-radius: 999px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, (rule503020Summary.futuro_20.percentualReceita / 20) * 100)}%; background-color: #10b981;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- TETO DE ORÇAMENTO POR CATEGORIA (LARGURA 100%) -->
      <div style="background-color: #121216; border: 1px solid #27272a; border-radius: 12px; padding: 12px; margin-bottom: 16px; break-inside: avoid;">
        <div style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #27272a; padding-bottom: 6px;">
          Teto de Orçamento por Categoria
        </div>
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="color: #a1a1aa; text-align: left; border-bottom: 1px solid #27272a;">
              <th style="width: 38%; padding: 5px 10px 5px 0;">Categoria</th>
              <th style="width: 22%; padding: 5px 8px;">Bloco</th>
              <th style="width: 20%; padding: 5px 10px; text-align: right;">Gasto</th>
              <th style="width: 20%; padding: 5px 0 5px 10px; text-align: right;">Teto</th>
            </tr>
          </thead>
          <tbody>
            ${budgetRows
              .map((b) => {
                const statusColor =
                  b.teto > 0 && b.pct >= 100
                    ? '#f43f5e'
                    : b.teto > 0 && b.pct >= 75
                    ? '#f59e0b'
                    : '#10b981';
                return `
                  <tr style="border-bottom: 1px solid #27272a; break-inside: avoid;">
                    <td style="padding: 5px 10px 5px 0; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml(b.nome)}
                    </td>
                    <td style="padding: 5px 8px; color: #a1a1aa; white-space: nowrap;">${escapeHtml(b.regra)}</td>
                    <td style="padding: 5px 10px; text-align: right; font-weight: 700; color: ${statusColor}; white-space: nowrap;">
                      ${formatCurrency(b.gasto, currency)}
                    </td>
                    <td style="padding: 5px 0 5px 10px; text-align: right; color: #a1a1aa; white-space: nowrap;">
                      ${b.teto > 0 ? formatCurrency(b.teto, currency) : '—'}
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- TABELA DE LANÇAMENTOS DO PERÍODO (PÁGINA 1) -->
      <div style="background-color: #121216; border: 1px solid #27272a; border-radius: 12px; padding: 12px; break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #27272a; padding-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
            Extrato de Lançamentos do Período (${periodTxs.length} registros)
          </span>
          <span style="font-size: 10px; color: #a1a1aa;">
            ${escapeHtml(firstPageSubtitle)}
          </span>
        </div>

        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10px;">
          ${renderTransactionsTableHeadHtml()}
          <tbody>
            ${renderTransactionsRowsHtml(firstPageRows)}
          </tbody>
        </table>
      </div>

      <!-- RODAPÉ -->
      <div style="margin-top: 12px; display: flex; justify-content: space-between; font-size: 9px; color: #a1a1aa;">
        <span>Gestor Financeiro • Sistema Planejador Financeiro Web & Mobile</span>
        <span>Documento gerado eletronicamente em formato A4</span>
      </div>
    </div>
  `;

  const pageElements: HTMLElement[] = [createPageElement(page1Html)];

  // PÁGINAS COMPLEMENTARES (PÁGINA 2, 3, ...): Continuação dos Lançamentos
  extraPagesRows.forEach((extraPage, idx) => {
    const pageNum = idx + 2;
    const continuationHtml = `
      <div style="background-color: #09090b; color: #ffffff; border: 1px solid #27272a; border-radius: 16px; padding: 20px; box-sizing: border-box;">
        <!-- CABEÇALHO COMPACTO DE CONTINUAÇÃO -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #8b5cf6; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <div style="display: inline-block; background-color: #8b5cf6; color: #ffffff; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 6px; margin-bottom: 3px;">
              Gestor Financeiro
            </div>
            <h2 style="margin: 0; font-size: 16px; font-weight: 800; color: #ffffff;">
              Planejamento & Demonstrativo Financeiro —Titular: ${escapeHtml(holderName)}
            </h2>
          </div>
          <div style="text-align: right; background-color: #121216; border: 1px solid #27272a; border-radius: 10px; padding: 6px 12px;">
            <div style="font-size: 9.5px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">
              Período: <span style="color: #f59e0b;">${escapeHtml(periodLabel)}</span>
            </div>
            <div style="font-size: 11.5px; font-weight: 800; color: #ffffff; margin-top: 2px;">
              Competência: ${escapeHtml(competenceDisplay)}
            </div>
          </div>
        </div>

        <!-- TABELA DE LANÇAMENTOS (CONTINUAÇÃO) -->
        <div style="background-color: #121216; border: 1px solid #27272a; border-radius: 12px; padding: 12px; break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #27272a; padding-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
              Extrato de Lançamentos do Período — Continuação (${periodTxs.length} registros)
            </span>
            <span style="font-size: 10px; color: #a1a1aa;">
              Exibindo ${extraPage.startIndex} a ${extraPage.endIndex} de ${periodTxs.length} lançamentos
            </span>
          </div>

          <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10px;">
            ${renderTransactionsTableHeadHtml()}
            <tbody>
              ${renderTransactionsRowsHtml(extraPage.rows)}
            </tbody>
          </table>
        </div>

        <!-- RODAPÉ -->
        <div style="margin-top: 12px; display: flex; justify-content: space-between; font-size: 9px; color: #a1a1aa;">
          <span>Gestor Financeiro • Sistema Planejador Financeiro Web & Mobile</span>
          <span>Documento gerado eletronicamente em formato A4 Retrato (Margem 8mm) • Página ${pageNum} de ${totalPages}</span>
        </div>
      </div>
    `;
    pageElements.push(createPageElement(continuationHtml));
  });

  pageElements.forEach((el) => hostWrapper.appendChild(el));
  document.body.appendChild(hostWrapper);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Folha A4 Retrato: 210mm x 297mm | Margens exatas de 8mm -> Área útil: 194mm x 281mm
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 8;
    const maxContentWidthMm = pageWidthMm - marginMm * 2; // 194mm
    const maxContentHeightMm = pageHeightMm - marginMm * 2; // 281mm

    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await html2canvas(pageElements[i], {
        backgroundColor: '#09090b',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.width / imgProps.height;

      let renderWidthMm = maxContentWidthMm;
      let renderHeightMm = renderWidthMm / ratio;

      // Garante que cada página caiba na altura útil da folha A4 Retrato
      if (renderHeightMm > maxContentHeightMm) {
        renderHeightMm = maxContentHeightMm;
        renderWidthMm = renderHeightMm * ratio;
      }

      const offsetX = marginMm + (maxContentWidthMm - renderWidthMm) / 2;
      const offsetY = marginMm;

      pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidthMm, renderHeightMm);
    }

    pdf.save(`FinPlanner_Relatorio_${selectedMonth}_${periodLabel.toLowerCase()}.pdf`);
  } finally {
    document.body.removeChild(hostWrapper);
  }
}

