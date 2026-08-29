import { registerSW } from 'virtual:pwa-register';
import { usePwaStore } from './stores/usePwaStore';

const UPDATE_INTERVAL_MS = 30 * 60 * 1000; 
const MIN_CHECK_GAP_MS = 60 * 1000; 

let registration: ServiceWorkerRegistration | undefined;
let updateInFlight = false;
let lastUpdateCheck = 0;
let listenersInstalled = false;

async function checkForUpdate(reason: string) {
  const currentRegistration = registration;
  if (!currentRegistration || updateInFlight || !navigator.onLine) return;

  const now = Date.now();
  if (now - lastUpdateCheck < MIN_CHECK_GAP_MS) return;

  updateInFlight = true;
  lastUpdateCheck = now;

  try {
    await currentRegistration.update();
    if (import.meta.env.DEV) console.debug(`[PWA] update check: ${reason}`);
  } catch (error) {
    if (import.meta.env.DEV) console.debug('[PWA] update check failed', error);
  } finally {
    updateInFlight = false;
  }
}

function installUpdateTriggers() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate('visibility');
  });

  window.addEventListener('online', () => {
    void checkForUpdate('online');
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate('interval');
  }, UPDATE_INTERVAL_MS);
}

// O motor do Vite devolve uma função que faz o reload seguro
const updateSW = registerSW({
  immediate: true,
  
  onNeedRefresh() {
    // Nova versão já está baixada em background aguardando. Lemos o arquivo para saber qual é!
    fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        usePwaStore.getState().setUpdateAvailable(true, data.version, () => updateSW(true));
      })
      .catch(() => {
        // Se a internet falhar no meio do fetch, avisa mesmo assim
        usePwaStore.getState().setUpdateAvailable(true, 'Nova', () => updateSW(true));
      });
  },

  onRegisteredSW(_swUrl, currentRegistration) {
    if (!currentRegistration) return;
    registration = currentRegistration;
    installUpdateTriggers();
    void checkForUpdate('startup');
  },
  onRegisterError(error) {
    console.error('[PWA] Service Worker registration failed', error);
  },
});