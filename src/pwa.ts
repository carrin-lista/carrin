import { registerSW } from 'virtual:pwa-register';

const UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const MIN_CHECK_GAP_MS = 60 * 1000; // 1 minuto

let registration: ServiceWorkerRegistration | undefined;
let updateInFlight = false;
let lastUpdateCheck = 0;
let listenersInstalled = false;

async function checkForUpdate(reason: string) {
  const currentRegistration = registration;

  if (!currentRegistration)
    return;

  if (updateInFlight)
    return;

  if (!navigator.onLine)
    return;

  const now = Date.now();

  if (now - lastUpdateCheck < MIN_CHECK_GAP_MS)
    return;

  updateInFlight = true;
  lastUpdateCheck = now;

  try {
    await currentRegistration.update();

    if (import.meta.env.DEV)
      console.debug(`[PWA] update check: ${reason}`);
  }
  catch (error) {
    if (import.meta.env.DEV)
      console.debug('[PWA] update check failed', error);
  }
  finally {
    updateInFlight = false;
  }
}

function installUpdateTriggers() {
  if (listenersInstalled)
    return;

  listenersInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      void checkForUpdate('visibility');
  });

  window.addEventListener('online', () => {
    void checkForUpdate('online');
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible')
      void checkForUpdate('interval');
  }, UPDATE_INTERVAL_MS);
}

registerSW({
  immediate: true,

  onRegisteredSW(_swUrl, currentRegistration) {
    if (!currentRegistration)
      return;

    registration = currentRegistration;
    installUpdateTriggers();
    void checkForUpdate('startup');
  },

  onRegisterError(error) {
    console.error('[PWA] Service Worker registration failed', error);
  },
});