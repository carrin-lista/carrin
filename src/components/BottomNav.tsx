import { ShoppingCart, History, Home, Settings as SettingsIcon } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-gray-100 pb-safe z-40">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        <button 
          onClick={() => onTabChange('list')}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${currentTab === 'list' ? 'text-carrin-primary' : 'text-gray-400 hover:text-carrin-dark'}`}
        >
          <ShoppingCart size={24} />
          <span className="text-[10px] font-medium mt-1">Lista</span>
        </button>
        
        <button 
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${currentTab === 'history' ? 'text-carrin-primary' : 'text-gray-400 hover:text-carrin-dark'}`}
        >
          <History size={24} />
          <span className="text-[10px] font-medium mt-1">Histórico</span>
        </button>
        
        <button 
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${currentTab === 'home' ? 'text-carrin-primary' : 'text-gray-400 hover:text-carrin-dark'}`}
        >
          <Home size={24} />
          <span className="text-[10px] font-medium mt-1">Casa</span>
        </button>
        
        <button 
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${currentTab === 'settings' ? 'text-carrin-primary' : 'text-gray-400 hover:text-carrin-dark'}`}
        >
          <SettingsIcon size={24} />
          <span className="text-[10px] font-medium mt-1">Ajustes</span>
        </button>
      </div>
    </nav>
  );
}