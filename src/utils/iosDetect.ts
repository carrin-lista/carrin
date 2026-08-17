export const IOS_DISMISS_KEY = 'carrin_ios_install_prompt_dismissed';

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  // Garante que não é o simulador do iPadOS no Mac desktop
  const isMacTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /macintosh/.test(userAgent);
  return isIOS || isMacTouch;
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneQuery = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = (window.navigator as any).standalone === true;
  return isStandaloneQuery || isNavigatorStandalone;
}

export function shouldShowIosInstallPrompt(homeId: string | null): boolean {
  if (!homeId) return false; // Só mostra se já entrou/criou uma Casa
  if (!isIOSDevice()) return false; // Apenas iOS
  if (isRunningStandalone()) return false; // Se já estiver instalado, não mostra

  const dismissed = localStorage.getItem(IOS_DISMISS_KEY);
  return dismissed !== 'true';
}