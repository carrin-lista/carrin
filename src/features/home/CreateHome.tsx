import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { homeService } from '../../services/homeService';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

export function CreateHome({ onHomeCreated }: { onHomeCreated: (id: string) => void }) {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validação Defensiva Forte: Garante que temos o ID real do usuário
    if (!user || !user.id) {
      setErrorMsg("Sua sessão ainda está carregando ou expirou. Tente recarregar a página.");
      return;
    }

    // 2. Previne nomes vazios com espaços
    if (!name.trim()) {
      setErrorMsg("Por favor, digite um nome para a casa.");
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);
    
    try {
      const newHome = await homeService.createHome(name.trim(), user.id);
      
      if (newHome && newHome.id) {
        onHomeCreated(newHome.id);
      } else {
        throw new Error("Falha de sincronização. A casa não retornou um ID válido.");
      }
    } catch (error: any) {
      // 3. Log Técnico Silencioso (Para depuração no console)
      console.error("Erro interno ao criar a casa:", error);
      
      // 4. Mensagem Amigável (Oculta o erro real do Supabase/Postgres)
      setErrorMsg("Não foi possível criar sua Casa no momento. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-carrin-bg">
      <div className="bg-white p-8 rounded-card shadow-sm w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-carrin-dark mb-2">Configure sua Casa</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Como vocês chamam o lar de vocês? (ex: Casa Santana)
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-small text-sm font-medium bg-red-50 text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate}>
          <Input
            label="Nome da Casa"
            placeholder="Digite o nome..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="mt-6">
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar minha Casa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}