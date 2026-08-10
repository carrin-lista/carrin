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

function App() {
  const { user, setUser, homeId, setHomeId, isRecoveringPassword, setIsRecoveringPassword } = useAuthStore();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingDirectInviteId, setPendingDirectInviteId] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  const pathname = window.location.pathname;
  const isInviteRoute = pathname.startsWith('/invite/');
  const inviteId = isInviteRoute ? pathname.split('/invite/')[1] : null;

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
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
          window.history.replaceState({ appState: 'ready' }, '', window.location.href);
          setIsInitializing(false);
          requestAnimationFrame(() => setFadeIn(true));
        }
      }
    }

    initializeApp();

    // Listener de autenticação silencioso
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        window.history.replaceState({ appState: 'auth' }, '', '/');
      } 
      else if (event === 'SIGNED_IN' && currentUser) {
         setUser(currentUser, session);
         homeService.getUserHome(currentUser.id).then(home => {
           setHomeId(home ? home.home_id : null);
         });
         window.history.replaceState({ appState: 'ready' }, '', window.location.pathname);
      } 
      else if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && currentUser) {
         setUser(currentUser, session);
      }
    });

    const handlePopState = () => {
      window.history.pushState({ appState: 'locked' }, '', window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePopState);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isInviteRoute, setHomeId, setUser, setIsRecoveringPassword, isInitializing]);

  if (isInitializing) return <Splash />;

  const renderContent = () => {
    // 1. Se estiver tentando recuperar a senha, trava na tela de Auth ignorando outras rotas
    if (isRecoveringPassword) {
      return <Auth />;
    }

    // 2. Fluxo de convites
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

    if (pendingDirectInviteId && !isInviteRoute) {
      return <InviteView inviteId={pendingDirectInviteId} onAccepted={() => { window.location.href = '/'; }} />;
    }

    // 3. Aplicação Padrão
    if (!user) return <Auth />;
    if (!homeId) return <NoHomeView onHomeCreated={(id) => setHomeId(id)} />;
    
    return <ShoppingList />;
  };

  return (
    <div className={`w-full min-h-screen bg-carrin-bg transition-opacity duration-500 ease-in-out ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      {renderContent()}
      <TutorialSpotlight />
    </div>
  );
}

export default App;