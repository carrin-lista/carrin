import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { userService } from '../../services/userService';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../stores/useAuthStore';

// Ícones básicos SVG para não depender de bibliotecas externas não mapeadas
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);

type AuthView = 'login' | 'signup' | 'forgot_password' | 'update_password';

export function Auth() {
  const { isRecoveringPassword, setIsRecoveringPassword } = useAuthStore();
  
  const [view, setView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Força a visualização para 'update_password' se o App avisar que estamos em recuperação
  useEffect(() => {
    if (isRecoveringPassword) {
      setView('update_password');
      setFeedback(null);
    }
  }, [isRecoveringPassword]);

  const handleNameChange = (val: string) => {
    const formattedName = val
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    setName(formattedName);
  };

  const handleUsernameChange = (val: string) => {
    let formatted = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (formatted.length > 0) {
      formatted = '@' + formatted;
    }
    setUsername(formatted);
  };

  const getPasswordStrength = () => {
    if (!password) return null;
    const specialCount = (password.match(/[!@#$]/g) || []).length;
    const hasInvalidSpecial = /[^a-zA-Z0-9!@#$]/.test(password);
    const hasValidLength = password.length >= 6;

    if (!hasValidLength) return { text: 'Muito curta (Mín 6)', color: 'bg-red-400', width: 'w-1/4' };
    if (hasInvalidSpecial) return { text: 'Caractere não permitido', color: 'bg-red-400', width: 'w-2/4' };
    if (specialCount === 0) return { text: 'Falta caractere especial (! @ # $)', color: 'bg-yellow-400', width: 'w-2/4' };
    if (specialCount > 1) return { text: 'Apenas 1 caractere especial permitido', color: 'bg-yellow-400', width: 'w-3/4' };
    
    if (password.length >= 8) return { text: 'Forte', color: 'bg-carrin-primary', width: 'w-full' };
    return { text: 'Boa', color: 'bg-green-400', width: 'w-3/4' };
  };

  const strength = (view === 'signup' || view === 'update_password') ? getPasswordStrength() : null;

  const getFriendlyErrorMessage = (error: any): string => {
    if (!error) return 'Ocorreu um erro inesperado. Tente novamente.';
    
    let msg = typeof error === 'string' ? error : error.message || error.error_description || JSON.stringify(error);
    
    if (!msg || msg === '{}' || msg === '[]' || msg === '[object Object]') {
      return 'Ocorreu um erro inesperado no servidor. Tente novamente.';
    }

    const lowerMsg = msg.toLowerCase();

    // Erros customizados
    if (lowerMsg.includes('nome e sobrenome')) return msg;
    if (lowerMsg.includes('muito curto')) return msg;
    if (lowerMsg.includes('requisitos de segurança')) return msg;
    if (lowerMsg.includes('já está em uso')) return msg;
    if (lowerMsg.includes('senhas não coincidem')) return msg;

    // Erros de conexão e Supabase Auth
    if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network error')) return 'Falha na conexão. Verifique sua internet e tente novamente.';
    if (lowerMsg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (lowerMsg.includes('user already registered')) return 'Este e-mail já está cadastrado em outra conta.';
    if (lowerMsg.includes('password should be at least')) return 'A senha não atende aos requisitos de segurança.';
    if (lowerMsg.includes('rate limit exceeded')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (lowerMsg.includes('security purposes')) return 'Aguarde alguns segundos antes de tentar novamente.';
    if (lowerMsg.includes('email not confirmed')) return 'Verifique seu e-mail e confirme a conta antes de entrar.';
    if (lowerMsg.includes('same password')) return 'A nova senha não pode ser igual à anterior.';
    if (lowerMsg.includes('recovery token') || lowerMsg.includes('token expired')) return 'O link de recuperação expirou ou é inválido. Solicite um novo.';

    console.error('Erro de autenticação mapeado:', msg);
    return 'Não foi possível completar a ação. Tente novamente.';
  };

  const validatePasswordRules = () => {
    const specialCount = (password.match(/[!@#$]/g) || []).length;
    const hasInvalidSpecial = /[^a-zA-Z0-9!@#$]/.test(password);
    if (password.length < 6 || specialCount !== 1 || hasInvalidSpecial) {
      throw new Error('A senha não atende aos requisitos de segurança.');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } 
      
      else if (view === 'signup') {
        const nomePartes = name.trim().split(/\s+/);
        if (nomePartes.length < 2) throw new Error('Por favor, informe seu nome e sobrenome.');
        if (username.length < 3) throw new Error('O nome de usuário escolhido é muito curto.');
        
        validatePasswordRules();

        const isAvailable = await userService.checkUsernameAvailability(username);
        if (!isAvailable) throw new Error('Este @username já está em uso. Escolha outro para continuar.');

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim(), username: username } }
        });
        
        if (error) throw error;
        setFeedback({ text: 'Conta criada! Verifique seu e-mail para confirmar e acessar.', type: 'success' });
      }

      else if (view === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setFeedback({ text: 'Confira seu e-mail. Se existir uma conta vinculada a esse endereço, enviaremos as instruções para redefinir sua senha.', type: 'success' });
      }

      else if (view === 'update_password') {
        if (password !== confirmPassword) throw new Error('As senhas não coincidem. Digite novamente.');
        validatePasswordRules();

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        
        setFeedback({ text: 'Senha atualizada! Sua nova senha foi salva com sucesso.', type: 'success' });
        
        // Libera o acesso ao app após 2 segundos, limpando o estado de recuperação
        setTimeout(() => {
          setIsRecoveringPassword(false);
          setView('login');
          setPassword('');
          setConfirmPassword('');
        }, 2000);
      }

    } catch (error: any) {
      setFeedback({ text: getFriendlyErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => {
    if (view === 'login') return 'Bem-vindo de volta.';
    if (view === 'signup') return 'Crie sua conta para começar.';
    if (view === 'forgot_password') return 'Recuperar senha';
    if (view === 'update_password') return 'Crie sua nova senha';
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white p-8 rounded-card shadow-sm w-full max-w-md text-center transition-all">
        
        <div className="flex justify-center w-full mb-3">
          <img 
            src="/carrinlogo.png" 
            alt="Carrin" 
            className="h-10 w-auto object-contain" 
          />
        </div>

        <p className={`text-carrin-dark ${view === 'forgot_password' || view === 'update_password' ? 'mb-2 font-bold text-lg' : 'mb-6'}`}>
          {renderHeader()}
        </p>
        
        {view === 'forgot_password' && !feedback && (
          <p className="text-sm text-gray-500 mb-6">Digite o e-mail cadastrado e enviaremos um link para você redefinir sua senha.</p>
        )}

        {feedback && (
          <div className={`mb-4 p-3 rounded-small text-sm font-bold ${feedback.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-carrin-primary border border-green-100'}`}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-2">
          {view === 'signup' && (
            <>
              <Input
                label="Nome completo"
                type="text"
                placeholder="Nome e sobrenome"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
              <Input
                label="Nome de usuário"
                type="text"
                placeholder="@username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
              />
            </>
          )}
          
          {view !== 'update_password' && (
            <Input
              label="E-mail"
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          
          {(view === 'login' || view === 'signup' || view === 'update_password') && (
            <div className="relative">
              <Input
                label={view === 'update_password' ? 'Nova Senha' : 'Senha'}
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo de 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                rightElement={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar senha">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
              />
              
              {strength && (
                <div className="flex flex-col items-start -mt-2 mb-4 w-full px-1">
                  <div className="flex w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div className={`h-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
                  </div>
                  <span className="text-xs font-medium text-gray-500 mt-1.5">{strength.text}</span>
                </div>
              )}
            </div>
          )}

          {view === 'update_password' && (
            <Input
              label="Confirmar Nova Senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          )}

          <div className="mt-2">
            <Button type="submit" disabled={loading || (feedback?.type === 'success' && view === 'update_password')}>
              {loading ? 'Aguarde...' : 
                view === 'login' ? 'Entrar' : 
                view === 'signup' ? 'Criar Conta' : 
                view === 'forgot_password' ? 'Enviar Link' : 
                'Salvar Nova Senha'
              }
            </Button>
          </div>
        </form>

        {view === 'login' && (
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { setView('forgot_password'); setFeedback(null); }}
              className="text-sm font-bold text-gray-500 hover:text-carrin-primary transition-colors"
            >
              Esqueci minha senha
            </button>
            <div className="h-px bg-gray-100 w-full my-2"></div>
            <button
              type="button"
              onClick={() => { setView('signup'); setFeedback(null); }}
              className="text-sm font-bold text-gray-500 hover:text-carrin-primary transition-colors"
            >
              Não tem uma conta? Cadastre-se
            </button>
          </div>
        )}

        {view === 'signup' && (
          <button
            type="button"
            onClick={() => { setView('login'); setFeedback(null); }}
            className="mt-6 text-sm font-bold text-gray-500 hover:text-carrin-primary transition-colors"
          >
            Já tem uma conta? Faça login
          </button>
        )}

        {view === 'forgot_password' && (
          <button
            type="button"
            onClick={() => { setView('login'); setFeedback(null); }}
            className="mt-6 text-sm font-bold text-gray-500 hover:text-carrin-primary transition-colors"
          >
            ← Voltar para o login
          </button>
        )}
        
        {view === 'update_password' && (
          <button
            type="button"
            onClick={() => { 
              setIsRecoveringPassword(false);
              setView('login');
              setFeedback(null);
            }}
            className="mt-6 text-sm font-bold text-gray-500 hover:text-carrin-primary transition-colors"
          >
            Cancelar e voltar
          </button>
        )}
      </div>
    </div>
  );
}