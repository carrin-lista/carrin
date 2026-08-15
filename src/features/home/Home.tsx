import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { homeService } from '../../services/homeService';
import { supabase } from '../../services/supabase';
import { 
  Users, Home as HomeIcon, Shield, UserPlus, Copy, Check, 
  Clock, Edit3, Save, User, Search, Send, Calendar, Trash2, 
  Settings, Share2, AlertCircle, X, Camera 
} from 'lucide-react';
import { useTutorialStore } from '../../stores/useTutorialStore';

function SwipeableInviteItem({ invite, onCancel }: { invite: any, onCancel: () => void }) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const isDirect = !!invite.target_user_id;
  const targetUser = invite.users;
  const expiresDate = new Date(invite.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX - offsetX;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    let newX = e.touches[0].clientX - startXRef.current;
    if (newX > 0) newX = 0;
    if (newX < -80) newX = -80;
    setOffsetX(newX);
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offsetX < -40) setOffsetX(-80);
    else setOffsetX(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX - offsetX;
    setIsDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    let newX = e.clientX - startXRef.current;
    if (newX > 0) newX = 0;
    if (newX < -80) newX = -80;
    setOffsetX(newX);
  };
  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (offsetX < -40) setOffsetX(-80);
    else setOffsetX(0);
  };
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-small border border-gray-100 bg-red-500 group select-none">
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center text-white z-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="w-full h-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
          title="Excluir convite"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div
        className={`relative z-10 flex items-center justify-between p-3.5 bg-gray-50 cursor-grab active:cursor-grabbing md:group-hover:-translate-x-20 ${
          isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'
        }`}
        style={isDragging || offsetX !== 0 ? { transform: `translateX(${offsetX}px)` } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="space-y-1 w-full pointer-events-none">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDirect ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {isDirect ? `Direto para ${targetUser?.username || '@usuario'}` : 'Link Geral'}
            </span>
            <span className="text-[10px] text-gray-400">Expira em: {expiresDate}</span>
          </div>
          <p className="text-xs text-gray-500 font-mono">ID: {invite.id.slice(0, 8)}...</p>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { user, homeId } = useAuthStore();
  const { registerElement } = useTutorialStore();

  const [homeData, setHomeData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [loading, setLoading] = useState(true);
  const [commercialContext, setCommercialContext] = useState<any>(null);
  
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inviteMethod, setInviteMethod] = useState<'link' | 'username'>('link');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [sendingDirect, setSendingDirect] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'invites' | 'settings'>('overview');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  const loadHomeData = async () => {
    if (!homeId || !user) return;
    try {
      const details = await homeService.getHomeDetails(homeId);
      setHomeData(details.home);
      setNewName(details.home?.name || '');
      setMembers(details.members);

      // Carrega o contexto comercial do banco
      const { data } = await supabase.rpc('get_commercial_context', { p_home_id: homeId });
      if (data) setCommercialContext(data);

      const currentMember = details.members.find((m: any) => m.users?.id === user.id || m.user_id === user.id);
      if (currentMember) {
        setCurrentUserRole(currentMember.role);
        if (currentMember.role === 'owner' || currentMember.role === 'admin') {
          const invites = await homeService.getPendingInvites(homeId);
          setPendingInvites(invites);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes da casa:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [homeId, user]);

  const handleSaveName = async () => {
    if (!homeId || !newName.trim()) return;
    setSavingName(true);
    try {
      await homeService.updateHomeName(homeId, newName.trim());
      setHomeData({ ...homeData, name: newName.trim() });
      setIsEditingName(false);
      showFeedback('success', 'Nome da casa atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao atualizar nome da casa:", error);
      showFeedback('error', 'Erro ao alterar o nome da casa.');
    } finally {
      setSavingName(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!homeId || !event.target.files || event.target.files.length === 0) return;
      setUploadingPhoto(true);
      setShowPhotoMenu(false);
      const file = event.target.files[0];
      
      if (homeData?.photo_url) {
        await homeService.deleteHomePhoto(homeId, homeData.photo_url);
      }

      const publicUrl = await homeService.uploadHomePhoto(homeId, file);
      setHomeData({ ...homeData, photo_url: publicUrl });
      showFeedback('success', 'Foto da casa atualizada com sucesso!');
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao atualizar foto. Verifique a conexão.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      if (!homeId || !homeData?.photo_url) return;
      setUploadingPhoto(true);
      setShowPhotoMenu(false);
      
      await homeService.deleteHomePhoto(homeId, homeData.photo_url);
      setHomeData({ ...homeData, photo_url: null });
      showFeedback('success', 'Foto removida com sucesso!');
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao remover foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!homeId || generating) return;
    setGenerating(true);
    try {
      const link = await homeService.generateInviteLink(homeId);
      setInviteLink(link);
      
      await copyToClipboard(link);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      loadHomeData();
      showFeedback('success', 'Link de convite gerado e copiado!');
    } catch (error: any) {
      console.error("Erro ao gerar convite:", error);
      showFeedback('error', error.message || 'Erro ao gerar convite.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Convite para o Carrin',
          text: `Você foi convidado para participar da casa ${homeData?.name}! Acesse o link para aceitar:`,
          url: inviteLink,
        });
        showFeedback('success', 'Compartilhado com sucesso!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Erro ao compartilhar nativamente:', err);
        }
      }
    } else {
      await copyToClipboard(inviteLink);
      showFeedback('success', 'Link copiado para a área de transferência!');
    }
  };

  const handleSearchUsernameChange = (val: string) => {
    let formatted = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (formatted.length > 0) {
      formatted = '@' + formatted;
    }
    setSearchUsername(formatted);
  };

  const handleSearchUser = async () => {
    if (!searchUsername.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      let formatted = searchUsername.trim().toLowerCase();
      if (!formatted.startsWith('@')) formatted = '@' + formatted;
      
      const result = await homeService.findUserByUsername(formatted);
      if (!result) {
        showFeedback('error', 'Usuário não encontrado.');
        return;
      }
      if (result.id === user?.id) {
        showFeedback('error', 'Você não pode convidar a si mesmo.');
        return;
      }
      if (members.some(m => m.users.id === result.id)) {
        showFeedback('error', 'Este usuário já é um morador desta residência.');
        return;
      }
      setSearchResult(result);
    } catch (e) {
      console.error(e);
      showFeedback('error', 'Erro ao buscar usuário.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendDirectInvite = async () => {
    if (!searchResult || !homeId || sendingDirect) return;
    setSendingDirect(true);
    try {
      await homeService.generateDirectInvite(homeId, searchResult.id);
      showFeedback('success', `Convite enviado para ${searchResult.username}!`);
      setSearchResult(null);
      setSearchUsername('');
      loadHomeData();
    } catch (e) {
      console.error(e);
      showFeedback('error', 'Erro ao enviar convite. Verifique se já existe um convite pendente.');
    } finally {
      setSendingDirect(false);
    }
  };

  const handleConfirmCancelInvite = async (inviteId: string) => {
    try {
      await homeService.cancelInvite(inviteId);
      loadHomeData();
      showFeedback('success', 'Convite cancelado com sucesso.');
    } catch (error) {
      console.error('Erro ao cancelar convite:', error);
      showFeedback('error', 'Não foi possível cancelar o convite.');
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      await homeService.removeMember(homeId!, memberToRemove.id);
      setMemberToRemove(null);
      loadHomeData();
      showFeedback('success', 'Morador removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover morador:', error);
      showFeedback('error', 'Não foi possível remover o morador.');
    }
  };

  const handleTransferOwnership = async () => {
    if (!homeId || !selectedNewOwner || transferring) return;
    setTransferring(true);
    try {
      await homeService.transferOwnership(homeId, selectedNewOwner.users.id);
      
      showFeedback('success', 'Titularidade transferida com sucesso!');
      setIsTransferModalOpen(false);
      setSelectedNewOwner(null);
      
      loadHomeData(); 
    } catch (error: any) {
      console.error('Erro ao transferir titularidade:', error);
      showFeedback('error', error.message || 'Erro ao transferir titularidade.');
    } finally {
      setTransferring(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"><Shield size={10} /> Dono</span>;
      case 'admin':
        return <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"><Shield size={10} /> Admin</span>;
      default:
        return <span className="text-[10px] bg-gray-100 text-gray-700 font-bold px-2.5 py-0.5 rounded-full">Morador</span>;
    }
  };

  const canManageHome = currentUserRole === 'owner' || currentUserRole === 'admin';
  const ownerMember = members.find(m => m.role === 'owner');

  if (loading) {
    return <p className="text-center text-gray-400 py-10">Carregando centro administrativo...</p>;
  }

  return (
    <div className="p-6 pb-32 space-y-6 max-w-lg mx-auto relative">
      
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-card shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span className="truncate">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 opacity-75 hover:opacity-100 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-4">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 relative">
            
            <div 
              onClick={() => {
                if (canManageHome) setShowPhotoMenu(!showPhotoMenu);
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden group ${
                canManageHome ? 'cursor-pointer border-2 border-emerald-500' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              } ${homeData?.photo_url ? 'bg-gray-100' : 'bg-emerald-50 text-emerald-600'}`}
              title={canManageHome ? "Clique para alterar a foto" : "Foto da casa"}
            >
              {uploadingPhoto ? (
                <span className="text-xs font-medium animate-pulse text-emerald-600">...</span>
              ) : homeData?.photo_url ? (
                <img src={homeData.photo_url} alt="Casa" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
              ) : (
                <HomeIcon size={28} className={canManageHome ? "group-hover:opacity-75 transition-opacity" : ""} />
              )}
              
              {canManageHome && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <Camera size={18} />
                </div>
              )}
            </div>

            {showPhotoMenu && canManageHome && (
              <div className="absolute top-16 left-0 bg-white border border-gray-200 rounded-small p-2 flex gap-2 animate-in fade-in duration-150 shadow-lg z-10 w-max">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-white border border-gray-200 py-2 px-3 rounded text-xs font-bold text-carrin-dark hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Camera size={14} /> Trocar foto
                </button>
                {homeData?.photo_url && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="flex-1 bg-white border border-gray-200 py-2 px-3 rounded text-xs font-bold text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Trash2 size={14} /> Remover
                  </button>
                )}
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handlePhotoUpload} 
              disabled={uploadingPhoto} 
              className="hidden" 
            />

            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm font-bold text-carrin-dark focus:outline-none focus:border-emerald-600"
                    autoFocus
                  />
                  <button 
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="bg-emerald-600 text-white p-1.5 rounded hover:bg-emerald-700 transition-all"
                    title="Salvar"
                  >
                    <Save size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-extrabold text-carrin-dark">{homeData?.name || 'Minha Casa'}</h1>
                  {canManageHome && (
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                      title="Editar nome da casa"
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${commercialContext?.can_write ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {commercialContext?.can_write ? 'Ativa' : 'Suspensa'}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar size={12} /> Criada em {new Date(homeData?.created_at || Date.now()).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div ref={(el) => registerElement('home-info-area', el)} className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 text-xs">
          <div className="bg-gray-50 p-3 rounded-small">
            <p className="text-gray-400 uppercase font-bold tracking-wider text-[10px]">Moradores</p>
            <p className="text-sm font-extrabold text-carrin-dark mt-0.5">{members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-small">
            <p className="text-gray-400 uppercase font-bold tracking-wider text-[10px]">Dono da Casa</p>
            <p className="text-sm font-extrabold text-carrin-dark mt-0.5 truncate">
              {ownerMember?.users?.username || ownerMember?.users?.full_name || 'Não definido'}
            </p>
          </div>
        </div>
      </div>

      {canManageHome && (
        <div className="flex bg-white p-1 rounded-small border border-gray-100 shadow-sm">
          <button 
            ref={(el) => registerElement('tab-moradores', el)}
            onClick={() => setActiveSubTab('overview')} 
            className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${activeSubTab === 'overview' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-carrin-dark'}`}
          >
            Moradores ({members.length})
          </button>
          <button 
            ref={(el) => registerElement('tab-convites', el)}
            onClick={() => setActiveSubTab('invites')} 
            className={`flex-1 py-2 text-xs font-bold rounded transition-colors relative ${activeSubTab === 'invites' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-carrin-dark'}`}
          >
            Convites {pendingInvites.length > 0 && <span className="ml-1 bg-emerald-600 text-white px-1.5 py-0.2 rounded-full text-[9px]">{pendingInvites.length}</span>}
          </button>
          <button 
            ref={(el) => registerElement('tab-configuracoes', el)}
            onClick={() => setActiveSubTab('settings')} 
            className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${activeSubTab === 'settings' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-carrin-dark'}`}
          >
            Configurações
          </button>
        </div>
      )}

      {(activeSubTab === 'overview' || !canManageHome) && (
        <div className="space-y-4">
          {members.length === 1 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-card p-5 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Users size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-carrin-dark">Sua Casa ainda possui apenas você.</h3>
                <p className="text-xs text-gray-500">Convide outra pessoa para compartilhar sua lista de compras.</p>
              </div>
              {canManageHome && (
                <button
                  onClick={() => setActiveSubTab('invites')}
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-button font-bold text-xs shadow hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>Convidar Morador</span>
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-carrin-dark">
                <Users size={20} className="text-emerald-600" />
                <h2 className="text-base font-bold">Moradores da Residência</h2>
              </div>
            </div>

            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.users?.id || member.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-small border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-gray-500 border border-gray-200 shadow-sm">
                      {member.users?.avatar_url ? (
                        <img src={member.users.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={22} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-carrin-dark">
                        {member.users?.full_name || 'Morador'}
                        {member.users?.id === user?.id && <span className="text-xs font-normal text-gray-400 ml-1">(Você)</span>}
                      </p>
                      <p className="text-xs font-semibold text-emerald-600">
                        {member.users?.username ? (member.users.username.startsWith('@') ? member.users.username : `@${member.users.username}`) : '@sem_username'}
                      </p>
                      <p className="text-[11px] text-gray-400">{member.users?.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getRoleBadge(member.role)}
                    {canManageHome && currentUserRole === 'owner' && member.users?.id !== user?.id && (
                      <button 
                        onClick={() => setMemberToRemove({ id: member.users.id, name: member.users.full_name || member.users.username })}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover morador"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'invites' && canManageHome && (
        <div className="space-y-5">
          <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-carrin-dark">
              <UserPlus size={20} className="text-emerald-600" />
              <h2 className="text-base font-bold">Convidar Morador(a)</h2>
            </div>
            
            <div className="flex bg-gray-50 p-1 rounded-small border border-gray-200">
              <button 
                onClick={() => setInviteMethod('link')} 
                className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${inviteMethod === 'link' ? 'bg-white shadow text-carrin-dark' : 'text-gray-500 hover:text-carrin-dark'}`}
              >
                Link de Convite
              </button>
              <button 
                onClick={() => setInviteMethod('username')} 
                className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${inviteMethod === 'username' ? 'bg-white shadow text-carrin-dark' : 'text-gray-500 hover:text-carrin-dark'}`}
              >
                Por @username
              </button>
            </div>

            {inviteMethod === 'link' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Gere um link exclusivo válido por 24 horas. Ideal para compartilhar rapidamente com familiares ou parceiros.
                </p>
                <button
                  onClick={handleGenerateInvite}
                  disabled={generating}
                  className="w-full bg-emerald-600 text-white py-3 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UserPlus size={16} />
                  <span>{generating ? 'Gerando...' : 'Gerar Novo Link de Convite'}</span>
                </button>

                {inviteLink && (
                  <div className="bg-gray-50 border border-gray-200 rounded-small p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={12} /> Validade: 24h</span>
                      <span className="text-emerald-700 font-medium">Link pronto!</span>
                    </div>
                    <input 
                      type="text" 
                      readOnly 
                      value={inviteLink} 
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-600 select-all outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await copyToClipboard(inviteLink);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 3000);
                        }}
                        className="flex-1 bg-carrin-dark text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-800 transition-colors"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copied ? 'Copiado' : 'Copiar Link'}</span>
                      </button>
                      <button
                        onClick={handleShareInvite}
                        className="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                        title="Compartilhar"
                      >
                        <Share2 size={14} />
                        <span>Compartilhar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Pesquise pelo nome de usuário exato para enviar um convite direto para o aplicativo da pessoa.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="@username" 
                    value={searchUsername} 
                    onChange={(e) => handleSearchUsernameChange(e.target.value)} 
                    className="flex-1 bg-white border border-gray-200 rounded-small px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-600" 
                  />
                  <button 
                    onClick={handleSearchUser} 
                    disabled={searching || !searchUsername.trim()} 
                    className="bg-gray-100 text-carrin-dark px-4 rounded-small hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    <Search size={18} />
                  </button>
                </div>
                
                {searchResult && (
                  <div className="mt-3 p-3 border border-emerald-100 bg-emerald-50 rounded-small space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white overflow-hidden shrink-0 flex items-center justify-center border border-gray-200 text-gray-400 shadow-sm">
                        {searchResult.avatar_url ? <img src={searchResult.avatar_url} className="w-full h-full object-cover" /> : <User size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-carrin-dark">{searchResult.full_name || 'Usuário'}</p>
                        <p className="text-xs font-semibold text-emerald-700">{searchResult.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSendDirectInvite} 
                      disabled={sendingDirect} 
                      className="w-full bg-emerald-600 text-white py-2 rounded-small font-bold text-xs hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Send size={14} /> {sendingDirect ? 'Enviando...' : 'Enviar Convite Direto'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-carrin-dark">
                <Clock size={20} className="text-emerald-600" />
                <h2 className="text-base font-bold">Convites Pendentes ({pendingInvites.length})</h2>
              </div>
            </div>

            {pendingInvites.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Nenhum convite ativo no momento.</p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <SwipeableInviteItem 
                    key={invite.id} 
                    invite={invite} 
                    onCancel={() => handleConfirmCancelInvite(invite.id)} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'settings' && canManageHome && (
        <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center gap-2 text-carrin-dark pb-3 border-b border-gray-50">
            <Settings size={20} className="text-emerald-600" />
            <h2 className="text-base font-bold">Configurações e Administração</h2>
          </div>

          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Identificação da Casa</p>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-small">
                <span className="font-bold text-carrin-dark">{homeData?.name}</span>
                <button 
                  onClick={() => { setActiveSubTab('overview'); setIsEditingName(true); }}
                  className="text-xs text-emerald-600 font-bold hover:underline"
                >
                  Alterar Nome
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dono(a) Atual</p>
              <div className="bg-gray-50 p-3 rounded-small">
                <p className="font-bold text-carrin-dark">
                  {ownerMember?.users?.full_name || 'Não definido'} ({ownerMember?.users?.username || '@dono'})
                </p>
                <p className="text-xs text-gray-400 mb-3">{ownerMember?.users?.email}</p>
                
                {currentUserRole === 'owner' && members.length > 1 && (
                  <button 
                    onClick={() => setIsTransferModalOpen(true)}
                    className="w-full bg-white border border-gray-200 text-carrin-dark py-2 rounded text-xs font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                  >
                    Transferir titularidade
                  </button>
                )}
                {currentUserRole === 'owner' && members.length <= 1 && (
                  <p className="text-[10px] text-gray-400 italic border-t border-gray-200 pt-2 mt-2">
                    É necessário possuir outro morador ativo na Casa para transferir a titularidade.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estrutura de Propriedade</p>
              <div className="bg-gray-50 p-3 rounded-small text-xs text-gray-500 space-y-1">
                <p>• Exclusão da residência: <span className="text-gray-400 italic">Protegido por regras de integridade</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {memberToRemove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-carrin-dark">Remover Morador?</h3>
              <p className="text-xs text-gray-500">
                Deseja realmente remover <strong className="text-carrin-dark">{memberToRemove.name}</strong> desta residência?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-xs hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRemoveMember}
                className="w-full bg-carrin-dark text-white py-3.5 rounded-button font-bold text-xs hover:bg-gray-800 transition-all shadow"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-extrabold text-carrin-dark">Transferir Titularidade</h3>
              <button onClick={() => { setIsTransferModalOpen(false); setSelectedNewOwner(null); }} className="text-gray-400 hover:text-carrin-dark">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 shrink-0">
              Selecione o morador que será o novo Dono da Casa. Essa ação não pode ser desfeita por você.
            </p>

            <div className="overflow-y-auto space-y-2 flex-1 min-h-[100px]">
              {members.filter(m => m.users.id !== user?.id).map((member) => (
                <div 
                  key={member.users?.id || member.id} 
                  onClick={() => setSelectedNewOwner(member)}
                  className={`flex items-center gap-3 p-3 rounded-small border cursor-pointer transition-all ${
                    selectedNewOwner?.id === member.id 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-100 bg-gray-50 hover:border-emerald-200 hover:bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white overflow-hidden shrink-0 flex items-center justify-center border border-gray-200 text-gray-400">
                    {member.users?.avatar_url ? <img src={member.users.avatar_url} className="w-full h-full object-cover" /> : <User size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-carrin-dark">{member.users?.full_name}</p>
                    <p className="text-xs font-semibold text-emerald-600">{member.users?.username}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedNewOwner && (
              <div className="pt-2 shrink-0">
                <div className="p-3 bg-red-50 border border-red-100 rounded-small mb-4 text-center">
                  <p className="text-xs font-bold text-red-700">Transferir a Casa para {selectedNewOwner.users.username}?</p>
                  <p className="text-[10px] text-red-600 mt-1">Após a transferência, você passará a ser um membro comum e perderá os privilégios administrativos.</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedNewOwner(null)}
                    disabled={transferring}
                    className="w-1/2 bg-gray-100 text-gray-600 py-3 rounded-small font-bold text-xs hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTransferOwnership}
                    disabled={transferring}
                    className="w-full bg-carrin-dark text-white py-3 rounded-small font-bold text-xs hover:bg-gray-800 transition-all shadow flex justify-center items-center gap-2"
                  >
                    {transferring ? 'Transferindo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}