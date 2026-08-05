import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { homeService } from '../../services/homeService';
import { preferenceService, type UserPreferences } from '../../services/preferenceService';
import { userService } from '../../services/userService';
import { supabase } from '../../services/supabase';
import { Users, LogOut, Shield, User, Bell, Edit3, Save, X, Check, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { pushService } from '../../services/pushService';

export function Settings() {
  const { user, homeId } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [preferences, setPreferences] = useState<UserPreferences>({
    notify_home_updates: true,
    notify_reminders: true,
    notify_suggestions: true,
  });

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    async function loadData() {
      if (!homeId || !user) return;
      try {
        const [membersData, prefsData, profileData] = await Promise.all([
          homeService.getHomeMembers(homeId),
          preferenceService.getPreferences(user.id),
          userService.getProfile(user.id)
        ]);
        
        setMembers(membersData);
        if (prefsData) setPreferences(prefsData);
        if (profileData) {
          setUserProfile(profileData);
          setEditFullName(profileData.full_name || '');
          setEditUsername(profileData.username || '');
          setEditPhone(profileData.phone || '');
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [homeId, user]);

  // Máscara e trava para o formato de telefone brasileiro: (99) 99999-9999
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setEditPhone(value);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!user || !event.target.files || event.target.files.length === 0) return;
      setUploadingAvatar(true);
      setShowAvatarMenu(false);
      const file = event.target.files[0];
      
      if (userProfile?.avatar_url) {
        await userService.deleteAvatar(userProfile.avatar_url);
      }

      const publicUrl = await userService.uploadAvatar(user.id, file);
      
      await userService.updateProfile(user.id, { avatar_url: publicUrl });
      setUserProfile({ ...userProfile, avatar_url: publicUrl });
      showFeedback('success', 'Foto atualizada com sucesso!');
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao atualizar foto. Verifique a conexão.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      if (!user || !userProfile?.avatar_url) return;
      setUploadingAvatar(true);
      setShowAvatarMenu(false);
      
      await userService.deleteAvatar(userProfile.avatar_url);
      await userService.updateProfile(user.id, { avatar_url: null });
      setUserProfile({ ...userProfile, avatar_url: null });
      showFeedback('success', 'Foto removida com sucesso!');
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao remover foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    try {
      let formattedUsername = editUsername.trim().toLowerCase();
      if (formattedUsername && !formattedUsername.startsWith('@')) {
        formattedUsername = '@' + formattedUsername;
      }

      const updatedFields = {
        full_name: editFullName.trim(),
        username: formattedUsername,
        phone: editPhone.trim() || undefined, // MUDANÇA AQUI: de null para undefined
      };

      await userService.updateProfile(user.id, updatedFields);
      setUserProfile((prev: any) => ({ ...prev, ...updatedFields }));
      setIsEditingProfile(false);
      showFeedback('success', 'Perfil atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      showFeedback('error', error.message || 'Erro ao atualizar perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggle = async (key: keyof UserPreferences) => {
    if (!user) return;
    const newValue = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    try {
      await preferenceService.updatePreferences(user.id, { [key]: newValue });
    } catch (error) {
      setPreferences(prev => ({ ...prev, [key]: !newValue }));
      showFeedback('error', 'Houve um erro ao salvar sua preferência.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 relative">
      
      {feedback && (
  <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-card shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
    {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
    <span className="truncate">{feedback.text}</span>
    <button onClick={() => setFeedback(null)} className="ml-2 opacity-75 hover:opacity-100 shrink-0">
      <X size={14} />
    </button>
  </div>
)}

      <div>
        <h1 className="text-2xl font-bold text-carrin-dark mb-1">Ajustes da Casa</h1>
        <p className="text-gray-500 text-sm">Gerencie o seu ambiente, notificações e quem tem acesso.</p>
      </div>

      <div className="bg-white rounded-card p-5 shadow-sm space-y-4 border border-gray-100">
        <div className="flex items-center justify-between pb-2 border-b border-gray-50">
          <div className="flex items-center gap-2 text-carrin-dark font-semibold">
            <User size={20} className="text-carrin-primary" />
            <span>Meu Perfil</span>
          </div>
          {!isEditingProfile && !loading && (
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
            >
              <Edit3 size={14} /> Editar
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando perfil...</p>
        ) : isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
            
            {/* Bloco de Avatar Interativo na Edição */}
            <div className="flex items-center gap-4">
              <div 
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                className="relative w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 overflow-hidden border-2 border-emerald-500 cursor-pointer group shadow-sm"
                title="Clique para alterar a foto"
              >
                {uploadingAvatar ? (
                  <span className="text-xs font-medium animate-pulse">...</span>
                ) : userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
                ) : (
                  <User size={32} className="group-hover:opacity-75 transition-opacity" />
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <Camera size={20} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-carrin-dark">Toque na foto para alterar</p>
                <p className="text-[11px] text-gray-400">Insira ou remova sua imagem de exibição</p>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleAvatarUpload} 
                disabled={uploadingAvatar} 
                className="hidden" 
              />
            </div>

            {/* Menu flutuante de Opções de Foto */}
            {showAvatarMenu && (
              <div className="bg-gray-50 border border-gray-200 rounded-small p-2 flex gap-2 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-white border border-gray-200 py-2 px-3 rounded text-xs font-bold text-carrin-dark hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Camera size={14} /> Trocar foto
                </button>
                {userProfile?.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="flex-1 bg-white border border-gray-200 py-2 px-3 rounded text-xs font-bold text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Trash2 size={14} /> Remover foto
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Identificação Pública (@username)</label>
                <input 
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="@username"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-bold text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Nome Completo</label>
                <input 
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Telefone / WhatsApp (Opcional)</label>
                <input 
                  type="tel"
                  value={editPhone}
                  onChange={handlePhoneChange}
                  placeholder="(99) 99999-9999"
                  maxLength={15}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">E-mail (Login - Não pode ser alterado)</label>
                <input 
                  type="email"
                  value={userProfile?.email || user?.email || ''}
                  disabled
                  className="w-full bg-gray-100 border border-gray-200 rounded px-3 py-2 text-sm font-medium text-gray-500 cursor-not-allowed select-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setShowAvatarMenu(false);
                  setEditFullName(userProfile?.full_name || '');
                  setEditUsername(userProfile?.username || '');
                  setEditPhone(userProfile?.phone || '');
                }}
                className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-small font-bold text-xs hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-small font-bold text-xs hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save size={14} />
                <span>{savingProfile ? 'Salvando...' : 'Salvar'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 overflow-hidden border border-gray-200 shadow-sm">
                {uploadingAvatar ? (
                  <span className="text-xs font-medium animate-pulse">...</span>
                ) : userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} />
                )}
              </div>
              
              <div>
                <p className="text-sm font-bold text-carrin-dark">{userProfile?.full_name || 'Morador'}</p>
                <p className="text-xs font-semibold text-emerald-600">{userProfile?.username || '@username'}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Identificação Pública</p>
                <p className="text-sm font-bold text-carrin-dark">{userProfile?.username || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Nome Completo</p>
                <p className="text-sm font-medium text-carrin-dark">{userProfile?.full_name || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">E-mail (Login)</p>
                <p className="text-sm font-medium text-gray-500">{userProfile?.email || user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Telefone</p>
                <p className="text-sm font-medium text-gray-500">{userProfile?.phone || 'Não informado'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4 text-carrin-dark font-semibold">
          <Users size={20} className="text-carrin-primary" />
          <span>Moradores da Casa</span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando membros...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((member, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-none">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                    {member.users?.avatar_url ? (
                      <img src={member.users.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-carrin-dark">
                      {member.users?.username || 'Sem username'}
                      {member.users?.id === user?.id && ' (Você)'}
                    </p>
                    <p className="text-xs text-gray-400">{member.users?.email}</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 font-medium text-gray-600 uppercase flex items-center gap-1 shrink-0">
                  <Shield size={12} /> {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-card p-5 shadow-sm space-y-4 border border-gray-100">
        <div className="flex items-center gap-2 text-carrin-dark font-semibold pb-2 border-b border-gray-50">
          <Bell size={20} className="text-carrin-primary" />
          <span>Notificações</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 w-2/3">Atualizações da Casa (Itens comprados/adicionados)</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={preferences.notify_home_updates}
                onChange={() => handleToggle('notify_home_updates')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Lembretes de dia de mercado</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={preferences.notify_reminders}
                onChange={() => handleToggle('notify_reminders')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Sugestões de produtos recorrentes</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={preferences.notify_suggestions}
                onChange={() => handleToggle('notify_suggestions')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={async () => {
              if (!user) return;
              const success = await pushService.requestPermissionAndSubscribe(user.id);
              if (success) {
                showFeedback('success', 'Aparelho conectado! Você receberá alertas.');
              }
            }}
            className="w-full bg-gray-50 border border-gray-200 text-carrin-dark py-3 rounded-small font-semibold text-sm hover:bg-gray-100 transition-colors flex justify-center items-center gap-2"
          >
            <Bell size={16} className="text-emerald-600" />
            Ativar Alertas Neste Aparelho
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Você precisa ativar isso em cada celular que quiser receber avisos.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-card p-5 shadow-sm border border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-red-500 font-medium py-2 hover:bg-red-50 rounded-small transition-colors"
        >
          <LogOut size={18} />
          <span>Sair da conta</span>
        </button>
      </div>
    </div>
  );
}