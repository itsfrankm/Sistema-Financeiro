import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  UserCheck,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Clock,
  UserPlus,
  Unlock,
  Trash2,
  Power,
  CheckCircle2,
  AlertTriangle,
  Users,
  Wallet,
  Sun,
  Moon,
  Save,
  Edit3,
  X,
  Cloud,
  CloudOff,
  Loader2,
  LogIn,
} from 'lucide-react';
import { MAX_LOGIN_ATTEMPTS, useFinance } from '../../context/FinanceContext';
import { UserRole } from '../../types/finance';

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// TELA DE LOGIN / CADASTRO MULTI-TENANT (NUVEM SUPABASE + PROTEÇÃO FORÇA BRUTA)
// ============================================================================
export const LoginScreen: React.FC = () => {
  const {
    login,
    registerAccount,
    getLockoutStatus,
    userSettings,
    toggleThemeColor,
    toggleThemeMode,
    isAuthLoading,
    isSupabaseReady,
    syncError,
  } = useFinance();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos para Criar Nova Conta
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const lockStatus = getLockoutStatus(identifier);

  // Atualiza o cronômetro regressivo de bloqueio a cada 1 segundo quando bloqueado
  useEffect(() => {
    if (!lockStatus.isLocked) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockStatus.isLocked]);

  const handleSwitchMode = (nextMode: 'login' | 'register') => {
    setAuthMode(nextMode);
    setFeedbackError(null);
    setFeedbackSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'login') {
        const result = await login(identifier, password);
        if (!result.success && result.error) {
          setFeedbackError(result.error);
        }
      } else {
        if (regPassword !== regConfirmPassword) {
          setFeedbackError('As senhas digitadas não coincidem.');
          return;
        }
        const res = await registerAccount({
          nome_exibicao: regDisplayName,
          username: regUsername,
          email: regEmail,
          password: regPassword,
        });

        if (!res.success) {
          setFeedbackError(res.error || 'Não foi possível criar sua conta.');
        } else if (res.requiresEmailConfirmation) {
          setFeedbackSuccess(
            'Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme-o para acessar sua conta de qualquer lugar.'
          );
          setAuthMode('login');
          setIdentifier(regEmail.trim().toLowerCase());
          setPassword('');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-app-bg text-app-text relative overflow-hidden p-4 sm:p-8">
      {/* Glow decorativo de fundo adaptável ao tema */}
      <div
        className="pointer-events-none fixed -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: 'var(--color-primary)' }}
      />
      <div
        className="pointer-events-none fixed -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />

      {/* Topbar de Tema na Tela de Login */}
      <header className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl btn-accent-theme flex items-center justify-center shadow-lg">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block leading-none">
              Gestor Financeiro
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleThemeColor()}
            className="surface-elevated hover:border-app-primary px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-app-accent" />
            <span>
              {userSettings.cor_tema === 'light-green'
                ? 'Verde Claro'
                : userSettings.cor_tema === 'purple-black'
                ? 'Roxo'
                : userSettings.cor_tema === 'deep-blue'
                ? 'Azul Escuro'
                : userSettings.cor_tema === 'amber-purple'
                ? 'Âmbar'
                : 'Preto e Branco'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => toggleThemeMode()}
            className="surface-elevated p-2 rounded-xl hover:border-app-primary transition-all"
            title="Alternar Modo Escuro / Claro"
          >
            {userSettings.modo_tema === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-violet-600" />
            )}
          </button>
        </div>
      </header>

      {/* Card Central de Autenticação / Cadastro */}
      <main className="relative z-10 my-auto py-8 w-full max-w-md mx-auto">
        {isAuthLoading ? (
          <div className="surface-card rounded-3xl p-8 border border-app-border flex flex-col items-center justify-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl btn-accent-theme flex items-center justify-center shadow-lg">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight">Conectando à sua conta</h2>
              <p className="text-xs text-app-muted">
                Carregando seus dados salvos na nuvem Supabase...
              </p>
            </div>
          </div>
        ) : (
          <div className="surface-card rounded-3xl p-6 sm:p-8 space-y-6 border border-app-border">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {authMode === 'login' ? 'Autenticação Segura' : 'Criar Nova Conta'}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    isSupabaseReady
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {isSupabaseReady ? (
                    <>
                      <Cloud className="w-3 h-3" />
                      <span>Nuvem Ativa</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3" />
                      <span>Modo Local</span>
                    </>
                  )}
                </span>
              </div>

              {/* Abas: Entrar vs Criar Conta */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl surface-elevated border border-app-border">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    authMode === 'login'
                      ? 'btn-accent-theme shadow-sm'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    authMode === 'register'
                      ? 'btn-accent-theme shadow-sm'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Criar Conta</span>
                </button>
              </div>
            </div>

            {/* Alerta de Bloqueio por Força Bruta (15 minutos após 5 tentativas) */}
            {authMode === 'login' && lockStatus.isLocked && (
              <div className="rounded-2xl p-4 bg-rose-500/15 border border-rose-500/40 text-rose-300 space-y-2 animate-pulse">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Proteção Contra Força Bruta Ativada</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Foram detectadas <strong>{MAX_LOGIN_ATTEMPTS} tentativas incorretas</strong>. Por segurança, este acesso está bloqueado temporariamente.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-rose-500/20 text-xs font-mono">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Liberação automática em:
                  </span>
                  <span className="text-sm font-extrabold text-rose-400">
                    {formatCountdown(lockStatus.remainingSeconds)}
                  </span>
                </div>
              </div>
            )}

            {/* Feedback de Sucesso (ex: Confirmação de e-mail enviada) */}
            {feedbackSuccess && (
              <div className="rounded-2xl p-3.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{feedbackSuccess}</p>
              </div>
            )}

            {/* Alerta de Erro de Credencial ou Sync */}
            {(!lockStatus.isLocked || authMode === 'register') && (feedbackError || syncError) && (
              <div className="rounded-2xl p-3.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium leading-relaxed">{feedbackError || syncError}</p>
                  {authMode === 'login' && lockStatus.failedAttempts > 0 && feedbackError && (
                    <p className="text-[11px] opacity-85">
                      Tentativas falhas registradas: {lockStatus.failedAttempts} de {MAX_LOGIN_ATTEMPTS}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Formulário de Login ou Cadastro na Nuvem */}
            {authMode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-muted block">
                    Usuário ou E-mail de Acesso
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Digite seu usuário ou e-mail"
                      autoComplete="username"
                      className="w-full surface-elevated rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-app-muted">
                      Senha de Acesso
                    </label>
                    {lockStatus.failedAttempts > 0 && !lockStatus.isLocked && (
                      <span className="text-[11px] text-amber-400 font-medium">
                        Tentativa {lockStatus.failedAttempts}/{MAX_LOGIN_ATTEMPTS}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={lockStatus.isLocked || isSubmitting}
                      autoComplete="current-password"
                      className="w-full surface-elevated rounded-xl pl-4 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary disabled:opacity-50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-app-muted hover:text-app-text"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={lockStatus.isLocked || isSubmitting}
                  className="w-full py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed btn-accent-theme"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Autenticando...'
                      : lockStatus.isLocked
                      ? `Bloqueado (${formatCountdown(lockStatus.remainingSeconds)})`
                      : 'Entrar'}
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-muted block">
                    Nome Completo / Exibição
                  </label>
                  <input
                    type="text"
                    required
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="Ex: Franklin Oliveira"
                    className="w-full surface-elevated rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-muted block">
                      Usuário (Login Rápido)
                    </label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="franklin"
                      autoComplete="username"
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-muted block">
                      E-mail
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="email"
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-muted block">
                      Senha (mín. 6)
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-muted block">
                      Confirmar Senha
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 btn-accent-theme"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Criando Conta...' : 'Criar Minha Conta'}</span>
                </button>
              </form>
            )}

            <p className="text-[11px] text-center text-app-muted pt-1 border-t border-app-border">
              {isSupabaseReady
                ? 'Seus lançamentos e contas ficam salvos na sua conta Supabase para acesso em qualquer dispositivo.'
                : 'Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para ativar o salvamento na nuvem.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

// ============================================================================
// COMPONENTE DE AUTOATENDIMENTO: ALTERAR MINHAS PRÓPRIAS CREDENCIAIS (LOGADO)
// ============================================================================
export const SelfCredentialsCard: React.FC = () => {
  const { currentUser, updateOwnCredentials } = useFinance();

  const [displayName, setDisplayName] = useState(currentUser?.nome_exibicao ?? '');
  const [username, setUsername] = useState(currentUser?.username ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.nome_exibicao);
      setUsername(currentUser.username);
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleSaveOwnCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword) {
      setFeedback({
        type: 'error',
        text: 'Informe sua senha atual para confirmar a alteração das credenciais.',
      });
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setFeedback({
        type: 'error',
        text: 'A confirmação da nova senha não coincide.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateOwnCredentials({
        currentPassword,
        newUsername: username,
        newEmail: email,
        newDisplayName: displayName,
        newPassword: newPassword || undefined,
      });

      if (!res.success) {
        setFeedback({ type: 'error', text: res.error || 'Erro ao atualizar credenciais.' });
      } else {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setFeedback({
          type: 'success',
          text: 'Suas credenciais de login e senha foram atualizadas e gravadas com segurança no banco!',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="surface-card rounded-2xl p-6 space-y-5 border border-app-border">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-app-accent flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Segurança da Conta • Banco de Dados
          </span>
          <h3 className="text-lg font-extrabold">Minhas Credenciais de Login & Senha</h3>
          <p className="text-xs text-app-muted">
            Altere seu usuário de acesso, e-mail ou senha a qualquer momento. As senhas são armazenadas com hash criptográfico no banco.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPasswords((p) => !p)}
          className="surface-elevated px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-app-muted hover:text-app-text"
        >
          {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showPasswords ? 'Ocultar Campos de Senha' : 'Ver Campos de Senha'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSaveOwnCredentials} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">Nome de Exibição</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">Usuário de Login</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">E-mail de Login</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-app-border">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-amber-400">
              Senha Atual (Obrigatória para salvar)
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">
              Nova Senha (Opcional)
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Deixe em branco para manter"
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">
              Confirmar Nova Senha
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="btn-accent-theme px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Gravando no Banco...' : 'Atualizar Minhas Credenciais'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// PAINEL EXCLUSIVO DO ADMIN: "GERENCIAR ACESSOS" (SEM EXIBIR SENHAS EM TEXTO PURO)
// ============================================================================
export const AccessManagementPanel: React.FC = () => {
  const {
    currentUser,
    isSupabaseReady,
    registeredUsers,
    loginAttempts,
    createAccessProfile,
    toggleProfileActive,
    deleteAccessProfile,
    resetLoginAttempts,
    adminUpdateUserCredentials,
  } = useFinance();

  const [nomeExibicao, setNomeExibicao] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Estado para edição de credenciais de um perfil pelo Admin
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');

  if (currentUser?.role !== 'admin') {
    return (
      <div className="surface-card rounded-2xl p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold">Acesso Restrito ao Administrador</h3>
        <p className="text-xs text-app-muted max-w-md mx-auto">
          Apenas perfis com privilégio <code>admin</code> podem visualizar ou provisionar novos acessos Multi-Tenant.
        </p>
      </div>
    );
  }

  if (isSupabaseReady) {
    return (
      <div className="surface-card rounded-3xl p-6 sm:p-8 space-y-4 border border-app-border max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">
              Contas Gerenciadas pelo Supabase Auth
            </h3>
            <p className="text-xs text-app-muted">
              No modo nuvem, não armazenamos senhas nem listas locais no navegador.
            </p>
          </div>
        </div>
        <div className="surface-elevated rounded-2xl p-4 text-xs text-app-muted space-y-2 leading-relaxed">
          <p>
            • Novos usuários podem criar sua própria conta diretamente na aba{' '}
            <strong className="text-app-text">Criar Conta</strong> da tela inicial de login.
          </p>
          <p>
            • Para gerenciar usuários, resetar senhas ou desativar acessos globalmente, utilize o painel{' '}
            <strong className="text-app-text">Authentication → Users</strong> no seu projeto Supabase.
          </p>
          <p>
            • Cada usuário enxerga e salva exclusivamente seus próprios dados graças ao isolamento{' '}
            <code className="text-app-accent">user_id = auth.uid()</code> (Row Level Security).
          </p>
        </div>
      </div>
    );
  }

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const res = createAccessProfile({
      nome_exibicao: nomeExibicao,
      username,
      email: email || `${username.trim().toLowerCase()}@financespro.com`,
      role,
      senha_hash: senha,
    });

    if (!res.success) {
      setStatusMsg({ type: 'error', text: res.error || 'Erro ao criar perfil.' });
      return;
    }

    setNomeExibicao('');
    setUsername('');
    setEmail('');
    setSenha('');
    setRole('member');
    setStatusMsg({
      type: 'success',
      text: 'Novo perfil provisionado com senha criptografada no banco!',
    });
  };

  const handleStartEditUser = (u: {
    id: string;
    username: string;
    email: string;
    nome_exibicao: string;
  }) => {
    setEditingUserId(u.id);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditDisplayName(u.nome_exibicao);
    setEditNewPassword('');
    setStatusMsg(null);
  };

  const handleSaveAdminEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;

    const res = adminUpdateUserCredentials({
      targetUserId: editingUserId,
      newUsername: editUsername,
      newEmail: editEmail,
      newDisplayName: editDisplayName,
      newPassword: editNewPassword || undefined,
    });

    if (!res.success) {
      setStatusMsg({ type: 'error', text: res.error || 'Erro ao atualizar perfil.' });
      return;
    }

    setEditingUserId(null);
    setEditNewPassword('');
    setStatusMsg({
      type: 'success',
      text: 'Credenciais do perfil atualizadas com sucesso no banco de dados!',
    });
  };

  return (
    <div className="space-y-6">
      {/* Card para o próprio usuário logado alterar suas próprias credenciais */}
      <SelfCredentialsCard />

      {/* Cabeçalho da Gestão de Acessos Multi-Tenant */}
      <div className="surface-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-app-accent">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-app-accent">
            <Users className="w-4 h-4" />
            Exclusivo Admin
          </span>
          <h2 className="text-xl font-extrabold">Gerenciar Acessos & Perfis Isolados</h2>
          <p className="text-xs text-app-muted">
            Nenhum perfil fica visível na tela de login. Crie ou redefina acessos abaixo.
          </p>
        </div>
        <div className="surface-elevated rounded-xl px-4 py-3 text-right shrink-0">
          <span className="text-[11px] text-app-muted block">Perfis no Banco</span>
          <span className="text-xl font-extrabold text-app-primary">
            {registeredUsers.length} Tenants
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Provisionamento de Novo Perfil */}
        <form
          onSubmit={handleCreateProfile}
          className="surface-card rounded-2xl p-6 space-y-4 lg:col-span-1 h-fit"
        >
          <h3 className="text-base font-bold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-app-accent" />
            Novo Perfil
          </h3>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">Nome de Exibição</label>
            <input
              type="text"
              required
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              placeholder="Ex: Dra. Mariana Silva"
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">Usuário (Login)</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: mariana"
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-muted">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: mariana@financespro.com"
              className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-app-muted">Senha Inicial</label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mín. 6 chars"
                className="w-full surface-elevated rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-app-muted">Privilégio</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full surface-elevated rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              >
                <option value="member">Membro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider btn-accent-theme shadow-md"
          >
            Provisionar Acesso
          </button>
        </form>

        {/* Lista de Perfis e Monitoramento de Força Bruta (Sem expor senhas!) */}
        <div className="surface-card rounded-2xl p-6 space-y-4 lg:col-span-2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-app-primary" />
            Perfis no Banco & Redefinição de Credenciais
          </h3>

          <div className="space-y-3">
            {registeredUsers.map((u) => {
              const attemptRecord =
                loginAttempts[u.username.toLowerCase()] ||
                loginAttempts[u.email.toLowerCase()];
              const isLocked =
                attemptRecord?.locked_until &&
                new Date(attemptRecord.locked_until).getTime() > Date.now();
              const isEditingThis = editingUserId === u.id;

              return (
                <div
                  key={u.id}
                  className="surface-elevated rounded-2xl p-4 space-y-3 border border-app-border"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{u.nome_exibicao}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            u.role === 'admin'
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                        {!u.ativo && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                            Suspenso
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                            Bloqueado (Força Bruta)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-app-muted">
                        Login: <strong className="text-app-text">@{u.username}</strong> • E-mail:{' '}
                        {u.email} <br></br>Senha: <code className="text-emerald-400">
                        •••••••• (Hash Protegido)</code>
                      </p>
                      <p className="text-[11px] text-app-muted">
                        Tenant ID: <code>{u.id}</code> • Falhas acumuladas:{' '}
                        <strong>{attemptRecord?.failed_attempts ?? 0}/5</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(attemptRecord?.failed_attempts ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            resetLoginAttempts(u.username);
                            resetLoginAttempts(u.email);
                          }}
                          title="Desbloquear e Zerar Tentativas de Login"
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Desbloquear</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          isEditingThis ? setEditingUserId(null) : handleStartEditUser(u)
                        }
                        title="Alterar Login / Redefinir Senha deste Perfil"
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold surface-card hover:border-app-primary flex items-center gap-1.5"
                      >
                        {isEditingThis ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>Fechar</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="w-3.5 h-3.5 text-app-accent" />
                            <span>Alterar Login/Senha</span>
                          </>
                        )}
                      </button>

                      {u.role !== 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleProfileActive(u.id)}
                            title={u.ativo ? 'Suspender Acesso' : 'Reativar Acesso'}
                            className="p-2 rounded-xl surface-card hover:border-app-primary text-app-muted hover:text-app-text"
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAccessProfile(u.id)}
                            title="Excluir Perfil e Dados Isolados"
                            className="p-2 rounded-xl surface-card hover:border-rose-500 text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sub-formulário para alterar Login / E-mail / Senha do perfil */}
                  {isEditingThis && (
                    <form
                      onSubmit={handleSaveAdminEdit}
                      className="pt-3 border-t border-app-border grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                    >
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-app-muted">
                          Nome de Exibição
                        </label>
                        <input
                          type="text"
                          required
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-full surface-card rounded-xl px-3 py-2 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-app-muted">
                          Novo Login
                        </label>
                        <input
                          type="text"
                          required
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full surface-card rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-app-muted">
                          Nova Senha (Opcional)
                        </label>
                        <input
                          type="password"
                          value={editNewPassword}
                          onChange={(e) => setEditNewPassword(e.target.value)}
                          placeholder="Nova senha..."
                          className="w-full surface-card rounded-xl px-3 py-2 text-xs"
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-primary-theme py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar no Banco</span>
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
