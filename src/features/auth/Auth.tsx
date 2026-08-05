import { useState } from 'react';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

// Ícones básicos SVG para não depender de bibliotecas externas não mapeadas
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Formata o Nome e Sobrenome (Primeira letra sempre maiúscula)
  const handleNameChange = (val: string) => {
    const formattedName = val
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    setName(formattedName);
  };

  // Manipulador de Username em tempo real (Força @, minúsculas, remove espaços e especiais)
  const handleUsernameChange = (val: string) => {
    let formatted = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (formatted.length > 0) {
      formatted = '@' + formatted;
    }
    setUsername(formatted);
  };

  // Cálculo da Força da Senha
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

  const strength = !isLogin ? getPasswordStrength() : null;

  // Escudo Tradutor de Erros do Backend
  const getFriendlyErrorMessage = (error: any): string => {
    if (!error) return 'Ocorreu um erro inesperado. Tente novamente.';
    
    // Extrai a mensagem de forma segura para evitar o bug do "{}"
    let msg = typeof error === 'string' ? error : error.message || error.error_description || JSON.stringify(error);
    
    if (!msg || msg === '{}' || msg === '[]' || msg === '[object Object]') {
      return 'Falha na conexão. Verifique sua internet e tente novamente.';
    }

    const lowerMsg = msg.toLowerCase();

    // Dicionário de tradução
    if (lowerMsg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (lowerMsg.includes('user already registered')) return 'Este e-mail já está cadastrado em outra conta.';
    if (lowerMsg.includes('password should be at least')) return 'A senha não atende aos requisitos de segurança.';
    if (lowerMsg.includes('rate limit exceeded')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (lowerMsg.includes('security purposes')) return 'Aguarde alguns segundos antes de tentar novamente.';
    if (lowerMsg.includes('email not confirmed')) return 'Verifique seu e-mail e confirme a conta antes de entrar.';

    // Fallback amigável genérico para não vazar código
    console.error('Erro de autenticação mapeado:', msg);
    return 'Não foi possível completar a ação. Tente novamente.';
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Validações de Cadastro
        const nomePartes = name.trim().split(/\s+/);
        if (nomePartes.length < 2) {
          throw new Error('Por favor, informe seu nome e sobrenome.');
        }

        if (username.length < 3) {
          throw new Error('O nome de usuário escolhido é muito curto.');
        }

        const specialCount = (password.match(/[!@#$]/g) || []).length;
        const hasInvalidSpecial = /[^a-zA-Z0-9!@#$]/.test(password);
        if (password.length < 6 || specialCount !== 1 || hasInvalidSpecial) {
          throw new Error('A senha não atende aos requisitos de segurança.');
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            data: { 
              full_name: name.trim(),
              username: username
            } 
          }
        });
        
        if (error) throw error;
        setFeedback({ text: 'Conta criada! Verifique seu e-mail para confirmar e acessar.', type: 'success' });
      }
    } catch (error: any) {
      setFeedback({ text: getFriendlyErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
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

        <p className="text-carrin-dark mb-6">
          {isLogin ? 'Bem-vindo de volta.' : 'Crie sua conta para começar.'}
        </p>

        {feedback && (
          <div className={`mb-4 p-3 rounded-small text-sm font-bold ${feedback.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-carrin-primary border border-green-100'}`}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-2">
          {!isLogin && (
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
          <Input
            label="E-mail"
            type="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <div className="relative">
            <Input
              label="Senha"
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
            {/* Medidor de força da senha em tempo real (apenas no cadastro) */}
            {!isLogin && strength && (
              <div className="flex flex-col items-start -mt-2 mb-4 w-full px-1">
                <div className="flex w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className={`h-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
                </div>
                <span className="text-xs font-medium text-gray-500 mt-1.5">{strength.text}</span>
              </div>
            )}
          </div>

          <div className="mt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Criar Conta')}
            </Button>
          </div>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setFeedback(null);
          }}
          className="mt-6 text-sm font-bold text-gray-500 hover:text-carrin-primary transition-colors"
        >
          {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
        </button>
      </div>
    </div>
  );
}