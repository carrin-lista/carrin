import { supabase } from './supabase';

// Chave pública VAPID provisória (vamos gerar a sua chave real no próximo passo)
const PUBLIC_VAPID_KEY = 'BKclTkg3r70pLHUKIYRABiYLBlIlRYKTo-bJbNBASRue81_objsNhtSIgbUxgvYUuv4kO8vN9mXgJ08oca4uGKU';

// Função padrão e obrigatória do Web Push para converter a chave de base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  async requestPermissionAndSubscribe(userId: string) {
    // 1. Verifica se o navegador suporta Push Notifications
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Seu navegador não suporta notificações em segundo plano.');
      return false;
    }

    // 2. Pede permissão ao usuário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Você precisa permitir as notificações no seu navegador para usar este recurso.');
      return false;
    }

    try {
      // 3. Pega o Service Worker que já está rodando (graças ao seu Vite PWA)
      const registration = await navigator.serviceWorker.ready;
      
      // 4. Cria a inscrição (Token) para este aparelho
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
      }

      // 5. Extrai as chaves de criptografia e a URL (endpoint) para salvar no banco
      const subJSON = subscription.toJSON();
      
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subJSON.endpoint,
          p256dh: subJSON.keys?.p256dh,
          auth: subJSON.keys?.auth
        }, { onConflict: 'user_id, endpoint' }); // Evita salvar o mesmo celular duas vezes

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Erro ao assinar Push Notifications:', error);
      return false;
    }
  }
};