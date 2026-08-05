import { useEffect, useState } from 'react';
import { supabase } from './services/supabase';
import { useAuthStore } from './stores/useAuthStore';
import { homeService } from './services/homeService';
import { Auth } from './features/auth/Auth';
import { NoHomeView } from './features/home/NoHomeView';
import { ShoppingList } from './features/shopping-list/ShoppingList';
import { InviteView } from './features/invite/InviteView';
import { Splash } from './components/Splash';

function App() {
  const { user, setUser, homeId, setHomeId } = useAuthStore();
  
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

    // Listener de autenticação silencioso (sem piscar a tela)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      if (event === 'SIGNED_OUT') {
        setUser(null, null);
        setHomeId(null);
        setPendingDirectInviteId(null);
        window.history.replaceState({ appState: 'auth' }, '', '/');
      } 
      else if (event === 'SIGNED_IN' && currentUser) {
         setUser(currentUser, session);
         // Atualiza a casa em background de forma invisível
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
  }, [isInviteRoute, setHomeId, setUser, isInitializing]);

  // O Splash só aparece no carregamento inicial frio da aplicação
  if (isInitializing) return <Splash />;

  const renderContent = () => {
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

    if (!user) return <Auth />;
    if (!homeId) return <NoHomeView onHomeCreated={(id) => setHomeId(id)} />;
    
    return <ShoppingList />;
  };

  return (
    <div className={`w-full min-h-screen bg-carrin-bg transition-opacity duration-500 ease-in-out ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      {renderContent()}
    </div>
  );
}

export default App;