import { useEffect, useState } from 'react';
import { supabase } from './services/supabase';
import { useAuthStore } from './stores/useAuthStore';
import { homeService } from './services/homeService';
import { Auth } from './features/auth/Auth';
import { NoHomeView } from './features/home/NoHomeView';
import { ShoppingList } from './features/shopping-list/ShoppingList';
import { InviteView } from './features/invite/InviteView';
import { Splash } from './components/Splash';
import { TutorialSpotlight } from './components/TutorialSpotlight';
import { PwaPromptManager } from './components/pwa/PwaPromptManager';

function MaintenancePage({ message, onRetry }: { message: string, onRetry: () => void }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <div className="w-full min-h-screen bg-carrin-bg flex flex-col items-center justify-center p-6">
      <style>
        {`
          @keyframes shine-sweep {
            0% { transform: translateX(-150%) skewX(-20deg); }
            15%, 100% { transform: translateX(300%) skewX(-20deg); }
          }
          .animate-shine { animation: shine-sweep 6s ease-in-out infinite; }
        `}
      </style>

      <div className="bg-white max-w-sm w-full p-8 rounded-3xl shadow-sm text-center space-y-6 border border-gray-100">
        <div className="w-20 h-20 mx-auto mb-2 flex items-center justify-center relative overflow-hidden rounded-3xl">
          <img src="/main.png" alt="Carrin" className="w-full h-full object-contain relative z-10" />
          <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shine z-20 pointer-events-none"></div>
        </div>
        
        <div>
          <h1 className="text-xl font-black text-carrin-dark tracking-tight">Estamos fazendo alguns ajustes.</h1>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">{message || 'O Carrin está temporariamente indisponível enquanto realizamos uma manutenção.'}</p>
          <p className="text-sm text-gray-500 mt-2">Seus dados continuam seguros. Tente novamente em alguns minutos.</p>
        </div>

        <button 
          onClick={handleRetry} disabled={retrying}
          className="w-full bg-carrin-primary hover:opacity-90 text-white py-4 rounded-2xl font-bold text-sm transition-all flex justify-center items-center gap-2 disabled:opacity-70 mt-4 shadow-sm"
        >
          {retrying ? ( <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Verificando...</span></> ) : 'Tentar novamente'}
        </button>
      </div>
    </div>
  );
}

function App() {
  const { user, setUser, homeId, setHomeId, isRecoveringPassword, setIsRecoveringPassword } = useAuthStore();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCheckingHome, setIsCheckingHome] = useState(false);
  const [pendingDirectInviteId, setPendingDirectInviteId] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);

  const pathname = window.location.pathname;
  const isInviteRoute = pathname.startsWith('/invite/');
  const inviteId = isInviteRoute ? pathname.split('/invite/')[1] : null;

  // 🚀 MARKETING: Captura de Indicação Silenciosa
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('carrin_referral', ref.toUpperCase());
    }
  }, []);

  const checkMaintenanceStatus = async () => {
    try {
      const { data, error } = await supabase.from('global_settings').select('*').in('key', ['app_maintenance_mode', 'app_maintenance_message']);
      if (error) throw error;
      const maintenanceSetting = data?.find(s => s.key === 'app_maintenance_mode');
      const messageSetting = data?.find(s => s.key === 'app_maintenance_message');
      const isMaintenance = maintenanceSetting?.value === true || maintenanceSetting?.value === "true";
      
      setIsMaintenanceMode(isMaintenance);
      setMaintenanceMessage(messageSetting?.value || 'Estamos atualizando o Carrin. Voltamos logo.');
      return isMaintenance;
    } catch (error) {
      console.error('Falha ao checar modo manutenção:', error);
      return isMaintenanceMode; 
    } finally {
      setIsCheckingMaintenance(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      const inMaintenance = await checkMaintenanceStatus();
      if (inMaintenance && mounted) {
        setIsInitializing(false);
        requestAnimationFrame(() => setFadeIn(true));
        return; 
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser, session ?? null);

        if (currentUser) {
          const [home, pendingInvite] = await Promise.all([
            homeService.getUserHome(currentUser.id),
            !isInviteRoute ? homeService.getPendingDirectInvites(currentUser.id) : Promise.resolve(null)
          ]);

          if (mounted) {
            setHomeId(home ? home.home_id : null);
            if (pendingInvite) setPendingDirectInviteId(pendingInvite.id);
          }
        } else {
          if (mounted) setHomeId(null);
        }
      } catch (error) {
        console.error("Erro na inicialização:", error);
      } finally {
        if (mounted) {
          window.history.replaceState({ appState: 'ready' }, '', window.location.pathname);
          setIsInitializing(false);
          requestAnimationFrame(() => setFadeIn(true));
        }
      }
    }

    initializeApp();

    const channel = supabase.channel('global-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, (payload) => {
          if (payload.new && (payload.new as any).key === 'app_maintenance_mode') {
             setIsMaintenanceMode((payload.new as any).value === true || (payload.new as any).value === "true");
          }
          if (payload.new && (payload.new as any).key === 'app_maintenance_message') {
             setMaintenanceMessage((payload.new as any).value);
          }
      }).subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isMaintenanceMode) return;
      const currentUser = session?.user ?? null;
      
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
        setUser(currentUser, session);
        window.history.replaceState({ appState: 'recovery' }, '', '/');
      }
      else if (event === 'SIGNED_OUT') {
        setUser(null, null);
        setHomeId(null);
        setPendingDirectInviteId(null);
        setIsRecoveringPassword(false);
        setIsCheckingHome(false);
        window.history.replaceState({ appState: 'auth' }, '', '/');
      } 
      else if (event === 'SIGNED_IN' && currentUser) {
         const currentState = useAuthStore.getState();
         if (currentState.user?.id === currentUser.id && currentState.homeId !== undefined) return; 

         // 🚀 MARKETING: Registra no banco se o usuário veio por um link ?ref=
         const savedRef = localStorage.getItem('carrin_referral');
         if (savedRef) {
           (async () => {
             try {
               await supabase.rpc('register_marketing_referral', { p_code: savedRef });
               localStorage.removeItem('carrin_referral');
             } catch (err: any) {
               console.error("Erro ao registrar referral:", err);
             }
           })();
         }

         setIsCheckingHome(true); 
         setUser(currentUser, session);
         
         homeService.getUserHome(currentUser.id)
           .then(home => { setHomeId(home ? home.home_id : null); })
           .catch(err => console.error("Erro ao buscar Casa após o login:", err))
           .finally(() => setIsCheckingHome(false));
           
         window.history.replaceState({ appState: 'ready' }, '', window.location.pathname);
      } 
      else if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && currentUser) {
         setUser(currentUser, session);
      }
    });

    const handlePopState = () => window.history.pushState({ appState: 'locked' }, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
      supabase.removeChannel(channel);
    };
  }, [isInviteRoute, setHomeId, setUser, setIsRecoveringPassword, isInitializing, isMaintenanceMode]);

  if (isCheckingMaintenance || isInitializing || isCheckingHome) return <Splash />;

  if (isMaintenanceMode) {
    return (
      <div className={`w-full min-h-screen bg-carrin-bg transition-opacity duration-500 ease-in-out ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        <MaintenancePage message={maintenanceMessage} onRetry={checkMaintenanceStatus} />
      </div>
    );
  }

  const renderContent = () => {
    if (isRecoveringPassword) return <Auth />;
    if (isInviteRoute && inviteId) {
      if (!user) {
        return (
          <div className="min-h-screen bg-carrin-bg flex flex-col items-center justify-center p-6">
            <div className="bg-white max-w-md w-full p-6 rounded-card shadow-sm mb-4 text-center space-y-2 border border-gray-100">
              <p className="text-sm font-bold text-emerald-600">Você recebeu um convite para uma casa!</p>
              <p className="text-xs text-gray-500">Faça login ou crie sua conta para aceitar e entrar na residência.</p>
            </div>
            <Auth />
          </div>
        );
      }
      return <InviteView inviteId={inviteId} onAccepted={() => { window.location.href = '/'; }} />;
    }
    if (pendingDirectInviteId && !isInviteRoute) return <InviteView inviteId={pendingDirectInviteId} onAccepted={() => { window.location.href = '/'; }} />;
    if (!user) return <Auth />;
    if (!homeId) return <NoHomeView onHomeCreated={(id) => setHomeId(id)} />;
    return <ShoppingList />;
  };

  return (
    <div className={`w-full min-h-screen bg-carrin-bg transition-opacity duration-500 ease-in-out ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      {renderContent()}
      <TutorialSpotlight />
      <PwaPromptManager />
    </div>
  );
}

export default App;