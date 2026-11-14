import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Palette,
  Moon,
  Sun,
  Download,
  Upload,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertCircle,
  Camera,
  Sparkles,
  Coins,
  Target,
  Save,
  Eye,
  EyeOff,
  FileJson,
  ShieldCheck,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { ThemeColor } from '../../types/finance';
import { SelfCredentialsCard } from '../auth/LoginScreen';
import { formatCurrency } from '../../lib/utils';

const THEME_PALETTES: {
  id: ThemeColor;
  name: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
  checkTextHex?: string;
}[] = [
  {
    id: 'light-green',
    name: 'Verde Claro',
    description: 'Visual moderno, leve e focado em agilidade operacional',
    primaryHex: '#10b981',
    secondaryHex: '#34d399',
  },
  {
    id: 'purple-black',
    name: 'Roxo',
    description: 'Identidade tecnológica vibrante com alto destaque nos menus e botões',
    primaryHex: '#7c3aed',
    secondaryHex: '#a78bfa',
  },
  {
    id: 'deep-blue',
    name: 'Azul Escuro',
    description: 'Estilo corporativo clássico com contraste elevado e leitura precisa',
    primaryHex: '#2563eb',
    secondaryHex: '#3b82f6',
  },
  {
    id: 'amber-purple',
    name: 'Ambar',
    description: 'Tons quentes de energia e destaque industrial para bancadas técnicas',
    primaryHex: '#d97706',
    secondaryHex: '#f59e0b',
  },
  {
    id: 'monochrome',
    name: 'Preto e Branco',
    description: 'Acabamento minimalista, neutro e sofisticado em alto contraste',
    primaryHex: '#ffffff',
    secondaryHex: '#71717a',
    checkTextHex: '#09090b',
  },
];

export const SettingsView: React.FC = () => {
  const {
    currentUser,
    userSettings,
    updateUserSettings,
    toggleThemeColor,
    toggleThemeMode,
    toggleHideValues,
    exportBackupJson,
    importBackupJson,
    resetToDemoData,
    rule503020Summary,
    isSupabaseReady,
    isSyncing,
    lastSyncedAt,
    syncError,
    syncWithSupabase,
  } = useFinance();

  const monthlyIncome = rule503020Summary.receitaLiquidaMes || 8500;

  // Inicializa o percentual de meta de economia mensal com base nas receitas do mês ou 20% padrão
  const initialSavingsPct =
    monthlyIncome > 0
      ? Math.min(80, Math.max(1, Math.round((userSettings.meta_economia_mensal / monthlyIncome) * 100)))
      : 20;

  const [nomeExibicao, setNomeExibicao] = useState(
    userSettings.nome_exibicao || currentUser?.nome_exibicao || 'Titular'
  );
  const [avatarUrl, setAvatarUrl] = useState(userSettings.avatar_url || '');
  const [moeda, setMoeda] = useState<'BRL' | 'USD' | 'EUR'>(
    (userSettings.moeda as 'BRL' | 'USD' | 'EUR') || 'BRL'
  );
  const [metaPercentual, setMetaPercentual] = useState<number>(initialSavingsPct);
  const [metaValorReais, setMetaValorReais] = useState<number>(
    userSettings.meta_economia_mensal || Math.round(monthlyIncome * 0.2)
  );

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputAvatarRef = useRef<HTMLInputElement | null>(null);
  const fileInputBackupRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNomeExibicao(userSettings.nome_exibicao || currentUser?.nome_exibicao || 'Titular');
    setAvatarUrl(userSettings.avatar_url || '');
    setMoeda((userSettings.moeda as 'BRL' | 'USD' | 'EUR') || 'BRL');
    setMetaValorReais(userSettings.meta_economia_mensal || 1700);
    if (monthlyIncome > 0 && userSettings.meta_economia_mensal > 0) {
      setMetaPercentual(
        Math.min(
          90,
          Math.max(1, Math.round((userSettings.meta_economia_mensal / monthlyIncome) * 100))
        )
      );
    }
  }, [userSettings, currentUser, monthlyIncome]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const handlePercentChange = (pct: number) => {
    const clamped = Math.min(90, Math.max(0, pct));
    setMetaPercentual(clamped);
    setMetaValorReais(Number(((monthlyIncome * clamped) / 100).toFixed(2)));
  };

  const handleReaisChange = (val: number) => {
    const positive = Math.max(0, val);
    setMetaValorReais(positive);
    if (monthlyIncome > 0) {
      setMetaPercentual(Math.min(100, Math.round((positive / monthlyIncome) * 100)));
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'A imagem deve ter no máximo 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nomeExibicao.trim();
    if (trimmedName.length < 2) {
      showToast('error', 'O Nome de Exibição deve ter pelo menos 2 caracteres.');
      return;
    }

    updateUserSettings({
      nome_exibicao: trimmedName,
      avatar_url: avatarUrl.trim(),
      moeda,
      meta_economia_mensal: Number(metaValorReais) || 0,
    });

    showToast('success', 'Perfil, moeda e meta de economia atualizados com sucesso!');
  };

  const handleExportBackup = () => {
    try {
      const jsonContent = exportBackupJson();
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeUser = (currentUser?.username || 'usuario').replace(/[^a-z0-9_-]/gi, '_');
      a.href = url;
      a.download = `FinPlanner_Backup_${safeUser}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'Backup JSON exportado com sucesso!');
    } catch {
      showToast('error', 'Falha ao gerar o arquivo de backup JSON.');
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const result = importBackupJson(reader.result);
        showToast(
          result.success ? 'success' : 'error',
          result.success
            ? 'Backup JSON importado e restaurado com sucesso!'
            : result.error || 'Falha ao importar o backup JSON.'
        );
      }
      if (fileInputBackupRef.current) {
        fileInputBackupRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho da Aba */}
      <div className="surface-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personalização, Temas, Segurança & Backup</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Perfil, Aparência & Dados
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nomeExibicao}
              className="w-12 h-12 rounded-2xl object-cover border-2 border-violet-500/40 shadow-md"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
              {nomeExibicao.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold">{nomeExibicao}</p>
            <p className="text-[11px] text-app-muted">
              Conta: <strong className="text-app-text">@{currentUser?.username}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Status de Persistência na Nuvem Supabase */}
      <div className="surface-card rounded-3xl p-5 border border-app-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isSupabaseReady
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {isSupabaseReady ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold tracking-tight">
              {isSupabaseReady
                ? 'Conta Conectada à Nuvem (Supabase PostgreSQL)'
                : 'Persistência Local Ativa (Aguardando chaves .env)'}
            </h3>
            <p className="text-xs text-app-muted">
              {isSupabaseReady
                ? syncError
                  ? syncError
                  : lastSyncedAt
                  ? `Última sincronização com sua conta: ${new Date(lastSyncedAt).toLocaleString('pt-BR')}`
                  : 'Todos os lançamentos, contas e configurações são gravados diretamente no seu usuário.'
                : 'Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (ou na Vercel) para salvar na nuvem.'}
            </p>
          </div>
        </div>

        {isSupabaseReady && (
          <button
            type="button"
            disabled={isSyncing}
            onClick={async () => {
              await syncWithSupabase();
              showToast('success', 'Dados sincronizados com sua conta na nuvem Supabase!');
            }}
            className="surface-elevated hover:border-app-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-app-border transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-app-primary ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
          </button>
        )}
      </div>

      {/* 1. Paleta de Cores Principal (5 Cards Horizontais + Modo Escuro / Claro) */}
      <div className="surface-card rounded-3xl p-6 space-y-5 border border-app-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-app-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-app-primary" />
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                Paleta de Cores
              </h3>
            </div>
            <p className="text-xs text-app-muted">
              Escolha a cor principal do sistema. Ela é aplicada em todos os botões principais, menus ativos, destaques e gráficos.
            </p>
          </div>

          {/* Alternador Modo Escuro (Dark) / Modo Claro (Light) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => toggleThemeMode('dark')}
              className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                userSettings.modo_tema === 'dark'
                  ? 'sidebar-nav-active shadow-sm'
                  : 'border-app-border surface-elevated text-app-muted hover:text-app-text'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Modo Escuro</span>
            </button>

            <button
              type="button"
              onClick={() => toggleThemeMode('light')}
              className={`px-3.5 py-2.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                userSettings.modo_tema === 'light'
                  ? 'sidebar-nav-active shadow-sm'
                  : 'border-app-border surface-elevated text-app-muted hover:text-app-text'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Modo Claro</span>
            </button>
          </div>
        </div>

        {/* Grid de 5 Cards no estilo executivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {THEME_PALETTES.map((palette) => {
            const isSelected = userSettings.cor_tema === palette.id;
            const isMonochromeLight =
              palette.id === 'monochrome' && userSettings.modo_tema === 'light';
            const displayPrimary = isMonochromeLight ? '#0a0a0a' : palette.primaryHex;
            const displaySecondary = isMonochromeLight ? '#52525b' : palette.secondaryHex;
            const checkFg = isMonochromeLight
              ? '#ffffff'
              : palette.checkTextHex || '#ffffff';

            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => toggleThemeColor(palette.id)}
                style={
                  isSelected
                    ? {
                        borderColor: displayPrimary,
                        boxShadow: `0 0 0 1px ${displayPrimary}40`,
                      }
                    : undefined
                }
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'surface-elevated'
                    : 'border-app-border surface-elevated hover:border-app-primary/50 opacity-90 hover:opacity-100'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Topo: 2 Swatches Quadrados Arredondados + Check Ativo */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-9 h-9 rounded-xl shadow-sm border border-black/10"
                        style={{ backgroundColor: displayPrimary }}
                      />
                      <span
                        className="w-6 h-6 rounded-lg shadow-sm border border-black/10"
                        style={{ backgroundColor: displaySecondary }}
                      />
                    </div>

                    {isSelected && (
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
                        style={{
                          backgroundColor: displayPrimary,
                          color: checkFg,
                        }}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  {/* Título e Descrição */}
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-app-text">
                      {palette.name}
                    </p>
                    <p className="text-[11px] text-app-muted leading-relaxed">
                      {palette.description}
                    </p>
                  </div>
                </div>

                {/* Rodapé: Mini Barras de Gráfico + Ativa / Aplicar */}
                <div className="pt-3 border-t border-app-border flex items-center justify-between">
                  <div className="flex items-end gap-1 h-5">
                    <span
                      className="w-2 h-2.5 rounded-t-sm"
                      style={{ backgroundColor: displayPrimary }}
                    />
                    <span
                      className="w-2 h-4 rounded-t-sm"
                      style={{ backgroundColor: displaySecondary }}
                    />
                    <span
                      className="w-2 h-5 rounded-t-sm"
                      style={{ backgroundColor: displayPrimary }}
                    />
                    <span
                      className="w-2 h-3.5 rounded-t-sm"
                      style={{ backgroundColor: displaySecondary }}
                    />
                  </div>

                  <span
                    className={`text-[11px] font-semibold ${
                      isSelected ? 'text-app-text' : 'text-app-muted'
                    }`}
                  >
                    {isSelected ? 'Ativa' : 'Aplicar'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Edição de Perfil, Foto/Logo, Moeda Padrão e Meta de Economia Mensal (%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-12 surface-card rounded-3xl p-6 space-y-5 border border-app-border"
        >
          <div className="flex items-center justify-between border-b border-app-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold">Perfil do Titular & Meta de Economia</h3>
                <p className="text-xs text-app-muted">
                  Estes dados também aparecem no cabeçalho dos seus relatórios executivos.
                </p>
              </div>
            </div>
          </div>

          {/* Foto / Logo + Nome de Exibição */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-4 flex flex-col items-center gap-2 p-3 rounded-2xl surface-elevated border border-app-border">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Preview Avatar"
                  className="w-16 h-16 rounded-2xl object-cover border border-violet-500/40"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-xl">
                  {nomeExibicao.slice(0, 2).toUpperCase()}
                </div>
              )}

              <input
                ref={fileInputAvatarRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputAvatarRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 flex items-center gap-1 transition-all"
                >
                  <Camera className="w-3 h-3" />
                  <span>Enviar Foto</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-400 hover:bg-rose-500/10"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-8 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  Nome de Exibição (Titular / Empresa)
                </label>
                <input
                  type="text"
                  value={nomeExibicao}
                  onChange={(e) => setNomeExibicao(e.target.value)}
                  placeholder="Ex: Franklin Planejamento"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-app-bg border border-app-border text-sm focus:outline-none focus:border-app-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-app-muted">
                  URL da Foto ou Logo (opcional)
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://exemplo.com/minha-foto.png ou envie arquivo ao lado"
                  className="w-full px-3.5 py-2 rounded-xl bg-app-bg border border-app-border text-xs focus:outline-none focus:border-app-primary"
                />
              </div>
            </div>
          </div>

          {/* Moeda Padrão (BRL) e Modo Privacidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-app-muted flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Moeda Padrão do Sistema</span>
              </label>
              <select
                value={moeda}
                onChange={(e) => setMoeda(e.target.value as 'BRL' | 'USD' | 'EUR')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-app-bg border border-app-border text-sm font-semibold focus:outline-none focus:border-app-primary"
              >
                <option value="BRL">BRL (R$ — Real Brasileiro)</option>
                <option value="USD">USD ($ — Dólar Americano)</option>
                <option value="EUR">EUR (€ — Euro Europeu)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-app-muted flex items-center gap-1.5">
                {userSettings.ocultar_valores ? (
                  <EyeOff className="w-3.5 h-3.5 text-violet-400" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Modo Privacidade Global</span>
              </label>
              <button
                type="button"
                onClick={toggleHideValues}
                className="w-full px-3.5 py-2.5 rounded-xl surface-elevated border border-app-border text-xs font-bold flex items-center justify-between hover:border-app-primary transition-all"
              >
                <span>
                  {userSettings.ocultar_valores
                    ? 'Valores Ocultos (R$ ••••••)'
                    : 'Valores Visíveis na Tela'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    userSettings.ocultar_valores
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {userSettings.ocultar_valores ? 'Ativado' : 'Desativado'}
                </span>
              </button>
            </div>
          </div>

          {/* Meta de Economia Mensal (%) e Equivalente em R$ */}
          <div className="p-4 rounded-2xl surface-elevated border border-app-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Meta de Economia Mensal (%)</span>
              </label>
              <span className="text-xs font-extrabold text-emerald-400">
                {metaPercentual}% das Receitas ({formatCurrency(metaValorReais, moeda)})
              </span>
            </div>

            <input
              type="range"
              min={5}
              max={60}
              step={1}
              value={metaPercentual}
              onChange={(e) => handlePercentChange(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] text-app-muted">Meta Percentual (% ao mês)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={metaPercentual}
                    onChange={(e) => handlePercentChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-app-bg border border-app-border text-xs font-bold"
                  />
                  <span className="text-xs font-bold text-app-muted">%</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-app-muted">Valor Alvo Mensal ({moeda})</span>
                <input
                  type="number"
                  min={0}
                  step="50"
                  value={metaValorReais}
                  onChange={(e) => handleReaisChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-app-bg border border-app-border text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="btn-primary-theme px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações do Perfil</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Seção de Backup JSON (Exportar / Importar / Resetar Demo) */}
      <div className="surface-card rounded-3xl p-6 border border-app-border">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold">
                Backup & Portabilidade de Dados
              </h3>
              <p className="text-xs text-app-muted">
                Exporte todas as suas contas, cartões, categorias, lançamentos, orçamentos e metas ou restaure um backup anterior.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center xl:justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportBackup}
              className="btn-primary-theme h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Exportar Backup JSON</span>
            </button>

            <input
              ref={fileInputBackupRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackupFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputBackupRef.current?.click()}
              className="surface-elevated hover:border-emerald-500/60 h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-app-border transition-all whitespace-nowrap"
            >
              <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Importar Backup JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetToDemoData();
                showToast('success', 'Dados de demonstração restaurados com sucesso!');
              }}
              className="surface-elevated hover:border-amber-500/60 h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-app-muted hover:text-app-text border border-app-border transition-all whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Restaurar Dados Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Alteração Segura de Credenciais (Login e Senha do Próprio Usuário) */}
      <SelfCredentialsCard />
    </div>
  );
};
