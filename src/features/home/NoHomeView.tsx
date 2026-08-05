import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { CreateHome } from './CreateHome';
import { Home as HomeIcon, Copy, Check, LogOut, User, Users, Link as LinkIcon, Edit3, BellRing, X } from 'lucide-react';
import { userService } from '../../services/userService';
import { homeService } from '../../services/homeService';
import { supabase } from '../../services/supabase';

export function NoHomeView({ onHomeCreated }: { onHomeCreated: (id: string) => void }) {
  const { user, setHomeId } = useAuthStore();
  const [view, setView] = useState<'choice' | 'create'>('choice');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [copied, setCopied] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<any>(null);

  const enrichInviteData = async (rawInvite: any) => {
    if (!rawInvite) return null;
    let homeName = 'Casa Compartilhada';

    if (rawInvite.home_id) {
      const { data: home } = await supabase.from('homes').select('name').eq('id', rawInvite.home_id).single();
      if (home?.name) homeName = home.name;
    }

    return {
      ...rawInvite,
      resolvedHomeName: homeName,
      resolvedInviterName: 'Alguém da casa'
    };
  };

  useEffect(() => {
    if (user) {
      userService.getProfile(user.id)
        .then(setUserProfile)
        .catch(console.error)
        .finally(() => setLoadingProfile(false));

      async function checkInvites() {
        try {
          const invite = await homeService.getPendingDirectInvites(user!.id);
          if (invite) {
            const enriched = await enrichInviteData(invite);
            setIncomingInvite(enriched);
          }
        } catch (e) {
          console.error(e);
        }
      }
      checkInvites();

      const channel = supabase
        .channel(`user_invites_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'home_invites',
            filter: `target_user_id=eq.${user.id}`,
          },
          async (payload) => {
            if (payload.new && payload.new.status === 'pending') {
              try {
                const details = await homeService.getInviteDetails(payload.new.id);
                const enriched = await enrichInviteData(details);
                setIncomingInvite(enriched);
              } catch {
                const enriched = await enrichInviteData(payload.new);
                setIncomingInvite(enriched);
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!user || !event.target.files || event.target.files.length === 0) return;
      setUploadingAvatar(true);
      const file = event.target.files[0];
      
      if (userProfile?.avatar_url) {
        await userService.deleteAvatar(userProfile.avatar_url);
      }

      const publicUrl = await userService.uploadAvatar(user.id, file);
      await userService.updateProfile(user.id, { avatar_url: publicUrl });
      setUserProfile({ ...userProfile, avatar_url: publicUrl });
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar foto. Verifique a conexão.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const rawUsername = userProfile?.username || user?.user_metadata?.username;
  let displayUsername = 'Carregando...';
  
  if (rawUsername) {
    displayUsername = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;
  } else if (!loadingProfile) {
    displayUsername = '@usuario';
  }

  const handleCopy = async () => {
    if (displayUsername === 'Carregando...') return;
    
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayUsername);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = displayUsername;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar username:', error);
    }
  };

  const handleAcceptDirectInvite = async () => {
    if (!incomingInvite || !user) return;
    try {
      await homeService.acceptInvite(incomingInvite.id, incomingInvite.home_id, user.id);
      setHomeId(incomingInvite.home_id);
      onHomeCreated(incomingInvite.home_id);
    } catch (error) {
      console.error('Erro ao aceitar convite:', error);
      alert('Não foi possível entrar na casa.');
    }
  };

  const handleRejectDirectInvite = async () => {
    if (!incomingInvite) return;
    
    const inviteId = incomingInvite.id;
    const createdBy = incomingInvite.created_by;
    const homeName = incomingInvite.resolvedHomeName;
    
    // Fecha o modal na hora
    setIncomingInvite(null);

    try {
      if (createdBy) {
        await supabase.from('notifications').insert({
          user_id: createdBy,
          title: 'Convite Recusado',
          message: `Um usuário recusou o convite para a casa ${homeName}.`,
          read: false
        }).catch(() => {});
      }

      // Apaga o convite do banco
      await supabase
        .from('home_invites')
        .delete()
        .eq('id', inviteId);
    } catch (error) {
      console.error('Erro ao recusar convite:', error);
    }
  };

  if (view === 'create') {
     return (
       <div className="relative">
         <button 
           onClick={() => setView('choice')} 
           className="absolute top-6 left-6 text-sm font-bold text-gray-500 hover:text-carrin-dark flex items-center gap-1 z-10 transition-colors"
         >
           ← Voltar
         </button>
         <CreateHome onHomeCreated={onHomeCreated} />
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-carrin-bg flex flex-col p-6 relative">
      
      {incomingInvite && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
              <BellRing size={28} />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-carrin-dark">Convite Recebido!</h3>
              <p className="text-xs text-gray-500">
                <strong className="text-carrin-dark">{incomingInvite.resolvedInviterName}</strong> convidou você para participar da casa:
              </p>
              <p className="text-sm font-bold text-emerald-600 bg-emerald-50 py-2 rounded-small mt-2">
                {incomingInvite.resolvedHomeName}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRejectDirectInvite}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-button font-bold text-xs hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
              >
                <X size={14} />
                <span>Recusar</span>
              </button>
              <button
                onClick={handleAcceptDirectInvite}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-button font-bold text-xs hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1"
              >
                <Check size={14} />
                <span>Aceitar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center overflow-hidden border border-emerald-200 shrink-0">
            {uploadingAvatar ? (
               <span className="text-xs font-bold animate-pulse">...</span>
            ) : userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <User size={24} />
            )}
            <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center group" title="Alterar foto">
               <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
               <Edit3 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </label>
          </div>
          <div>
            <p className="text-sm font-bold text-carrin-dark">Olá, {userProfile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário'}</p>
            <p className="text-xs text-gray-500">Sem residência</p>
          </div>
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors p-2" title="Sair da conta">
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col max-w-md w-full mx-auto justify-center space-y-6 pb-20">
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-extrabold text-carrin-dark">Como você deseja começar?</h1>
          <p className="text-sm text-gray-500">Escolha uma opção para acessar o Carrin.</p>
        </div>

        {/* Opção 1: Entrar em casa existente */}
        <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 text-carrin-dark">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Users size={20} /></div>
            <div>
              <h2 className="font-bold">Entrar em uma Casa</h2>
              <p className="text-xs text-gray-500">Peça para o administrador convidar você.</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-small space-y-3">
            <p className="text-xs text-gray-600 font-medium">Compartilhe seu nome de usuário:</p>
            <div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={displayUsername} 
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm font-bold text-carrin-dark select-all outline-none" 
                />
                <button 
                  onClick={handleCopy}
                  disabled={displayUsername === 'Carregando...'} 
                  className="bg-carrin-dark text-white px-4 py-2 rounded text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shrink-0 min-w-[105px] disabled:opacity-50"
                >
                  <Copy size={16} />
                  <span>Copiar</span>
                </button>
              </div>
              
              <div 
                className={`flex items-center gap-1 text-xs font-bold text-emerald-600 mt-2 transition-opacity duration-300 ${copied ? 'opacity-100' : 'opacity-0'}`}
              >
                <Check size={14} />
                <span>Username copiado.</span>
              </div>
            </div>
            
            <p className="text-[10px] text-gray-400">Quando enviarem um convite para você, ele aparecerá aqui automaticamente.</p>
          </div>
          
          <div className="pt-2">
            <p className="text-xs text-gray-500 flex items-center gap-1"><LinkIcon size={12} /> Tem um link de convite? Basta acessá-lo no navegador.</p>
          </div>
        </div>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink-0 mx-4 text-gray-300 text-xs font-bold uppercase">Ou</span>
            <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Opção 2: Criar Casa */}
        <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-carrin-dark mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><HomeIcon size={20} /></div>
            <div>
              <h2 className="font-bold">Criar minha Casa</h2>
              <p className="text-xs text-gray-500">Comece uma nova residência do zero.</p>
            </div>
          </div>
          <button onClick={() => setView('create')} className="w-full bg-emerald-600 text-white py-3 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-colors">
            Criar nova Casa
          </button>
        </div>
      </div>
    </div>
  );
}