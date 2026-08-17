// src/components/pwa/PwaPromptManager.tsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { shouldShowIosInstallPrompt } from '../../utils/iosDetect';
import { IOSInstallModal } from './IOSInstallModal';

export function PwaPromptManager() {
  const { homeId } = useAuthStore();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Só faz a verificação se o usuário já estiver dentro de uma Casa
    if (!homeId) return;

    // Colocamos um pequeno atraso (2 segundos) para a tela principal 
    // carregar tranquila antes de pular o modal na cara do usuário
    const timer = setTimeout(() => {
      if (shouldShowIosInstallPrompt(homeId)) {
        setShowPrompt(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [homeId]);

  return (
    <IOSInstallModal 
      isOpen={showPrompt} 
      onClose={() => setShowPrompt(false)} 
    />
  );
}