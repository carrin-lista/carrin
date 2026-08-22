import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supportService } from '../../services/supportService';
import { supabase } from '../../services/supabase';
import { ChevronLeft, Plus, Send, Clock, CheckCircle, MessageSquare, AlertCircle } from 'lucide-react';

interface SupportProps {
  onBack: () => void;
}

const CATEGORIES = [
  { id: 'account', label: 'Problema com minha conta' },
  { id: 'home', label: 'Problema com minha Casa' },
  { id: 'shopping_list', label: 'Lista de compras' },
  { id: 'notifications', label: 'Notificações' },
  { id: 'billing', label: 'Assinatura / pagamento' },
  { id: 'technical', label: 'Erro no aplicativo' },
  { id: 'suggestion', label: 'Sugestão' },
  { id: 'question', label: 'Dúvida' },
  { id: 'other', label: 'Outro' },
];

export function Support({ onBack }: SupportProps) {
  const { user, homeId } = useAuthStore();
  
  const [view, setView] = useState<'list' | 'new' | 'chat'>('list');
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form Novo Chamado
  const [category, setCategory] = useState('other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Form Chat
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 🚀 NOVO: Estados de Digitação
  const [adminTyping, setAdminTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (view === 'list') loadTickets();
    
    if (view === 'chat' && selectedTicket) {
      loadMessages();

      // 🚀 INÍCIO DO REALTIME (POSTGRES + BROADCAST)
      const channel = supabase.channel(`ticket_${selectedTicket.id}`)
        // 1. Ouve novas respostas da equipe no banco
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${selectedTicket.id}` },
          () => {
            loadMessages();
          }
        )
        // 2. Ouve o Broadcast de Digitação do Admin
        .on(
          'broadcast',
          { event: 'admin_typing' },
          (payload) => {
            if (payload.payload.isTyping) {
              setAdminTyping(true);
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 3000);
            } else {
              setAdminTyping(false);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        clearTimeout(typingTimeoutRef.current);
      };
    }
  }, [view, selectedTicket]);

  useEffect(() => {
    if (view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, adminTyping]); // Atualiza o scroll também quando o "digitando..." aparece

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await supportService.getTickets(user.id);
      setTickets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedTicket) return;
    try {
      const data = await supportService.getTicketMessages(selectedTicket.id);
      setMessages(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !description.trim()) return;
    
    setSubmitting(true);
    try {
      await supportService.createTicket(user.id, homeId || null, category, subject.trim(), description.trim());
      setView('list');
      setCategory('other');
      setSubject('');
      setDescription('');
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar chamado.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Otimismo na UI
    
    // Dispara que parou de digitar ao enviar
    supabase.channel(`ticket_${selectedTicket.id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping: false }
    });
    
    // Adiciona temporariamente na tela
    setMessages(prev => [...prev, { id: 'temp', message: messageText, sender_user_id: user.id, created_at: new Date().toISOString() }]);

    try {
      await supportService.sendMessage(selectedTicket.id, user.id, messageText);
      loadMessages(); // Recarrega do banco
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar mensagem.');
      loadMessages(); // Reverte a mensagem temporária em caso de erro
    }
  };

  // 🚀 NOVO: Função para avisar o console que o cliente está digitando
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (selectedTicket) {
      supabase.channel(`ticket_${selectedTicket.id}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { isTyping: e.target.value.length > 0 }
      });
    }
  };

  const getStatusUI = (status: string) => {
    switch (status) {
      case 'resolved': return { label: 'Resolvido', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle size={12} /> };
      case 'in_progress': return { label: 'Em atendimento', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock size={12} /> };
      default: return { label: 'Aberto', color: 'text-amber-600', bg: 'bg-amber-50', icon: <AlertCircle size={12} /> };
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header Dinâmico */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => {
            if (view === 'new' || view === 'chat') setView('list');
            else onBack();
          }} 
          className="p-2 -ml-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-carrin-dark"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-carrin-dark mb-0.5">
            {view === 'list' ? 'Ajuda e Suporte' : view === 'new' ? 'Novo Chamado' : 'Conversa'}
          </h1>
          <p className="text-gray-500 text-xs">
            {view === 'list' ? 'Fale com a equipe Carrin' : view === 'new' ? 'Descreva o que aconteceu' : selectedTicket?.subject}
          </p>
        </div>
      </div>

      {/* VISTA: LISTA DE CHAMADOS */}
      {view === 'list' && (
        <div className="space-y-4">
          <button 
            onClick={() => setView('new')}
            className="w-full bg-carrin-primary text-white py-4 rounded-button font-bold shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={18} /> Abrir Novo Chamado
          </button>

          <div className="pt-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Meus Chamados</h2>
            
            {loading ? (
              <p className="text-center text-gray-400 py-6 text-sm">Carregando...</p>
            ) : tickets.length === 0 ? (
              <div className="bg-white rounded-card p-6 text-center shadow-sm border border-gray-100">
                <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-500">Nenhum chamado aberto.</p>
                <p className="text-xs text-gray-400 mt-1">Quando você precisar de ajuda, seus chamados aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => {
                  const statusUI = getStatusUI(ticket.status);
                  return (
                    <div 
                      key={ticket.id}
                      onClick={() => { setSelectedTicket(ticket); setView('chat'); }}
                      className="bg-white p-4 rounded-card shadow-sm border border-gray-100 cursor-pointer hover:border-emerald-200 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-carrin-dark text-sm line-clamp-1 pr-4">{ticket.subject}</h3>
                        <span className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-small ${statusUI.bg} ${statusUI.color}`}>
                          {statusUI.icon} {statusUI.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1 mb-3">{ticket.description}</p>
                      <p className="text-[10px] text-gray-400 font-medium">Atualizado em: {formatDate(ticket.updated_at)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA: NOVO CHAMADO */}
      {view === 'new' && (
        <form onSubmit={handleCreateTicket} className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Categoria</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-small px-3 py-2.5 text-sm font-semibold text-carrin-dark outline-none focus:border-emerald-600 appearance-none"
            >
              {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Assunto</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Minha foto da Casa não salva"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-small px-3 py-2.5 text-sm font-semibold text-carrin-dark outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Conte o que aconteceu</label>
            <textarea 
              required
              rows={4}
              placeholder="Descreva o seu problema com o máximo de detalhes possível..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-small px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600 resize-none"
            />
          </div>
          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar chamado'}
          </button>
        </form>
      )}

      {/* VISTA: CHAT */}
      {view === 'chat' && (
        <div className="flex flex-col h-[65vh] bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
          
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 shrink-0">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-carrin-dark text-sm">{selectedTicket.subject}</h3>
              {getStatusUI(selectedTicket.status).icon}
            </div>
            <p className="text-xs text-gray-500 mt-1">{selectedTicket.description}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-gray-400 pt-10">A equipe Carrin responderá em breve. Você também pode enviar mais detalhes abaixo.</p>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender_user_id === user?.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] text-gray-400 font-bold mb-0.5 ml-1 mr-1">
                      {isMine ? 'Você' : 'Equipe Carrin'}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${isMine ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 text-carrin-dark rounded-tl-sm'}`}>
                      {msg.message}
                    </div>
                  </div>
                )
              })
            )}
            
            {/* 🚀 NOVO: UI DE DIGITANDO */}
            {adminTyping && (
              <div className="flex items-start">
                <span className="text-[10px] text-gray-500 italic bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 animate-pulse">
                  Equipe Carrin está digitando...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {selectedTicket.status !== 'resolved' ? (
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex gap-2 bg-white shrink-0">
              <input 
                type="text"
                placeholder="Escreva uma mensagem..."
                value={newMessage}
                onChange={handleTyping} // <--- SUBSTITUÍDO: Agora chama o broadcast
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-emerald-600"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="w-11 h-11 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Send size={16} className="-ml-0.5" />
              </button>
            </form>
          ) : (
            <div className="p-4 text-center bg-gray-50 text-xs font-bold text-gray-500 border-t border-gray-100 shrink-0">
              Este chamado foi encerrado pela equipe.
            </div>
          )}
        </div>
      )}
    </div>
  );
}