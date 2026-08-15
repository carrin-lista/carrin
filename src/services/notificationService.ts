import { supabase } from './supabase';

export type NotificationItem = {
  id: string;
  user_id: string;
  home_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Chave pública VAPID (Precisaremos gerar uma real)
const VAPID_PUBLIC_KEY = 'BJAd8eyX7bk3yl5_R5tdWLTxLWtYXRwjW59Og7uf-a0fnWpPo05tVt1_FMSFhlW64KlcOMa0kgnVIt3ruRt_xKU';

// Função utilitária exigida pelo PushManager para converter a chave VAPID
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const notificationService = {
  
  // --- LÓGICA DE WEB PUSH NOTIFICATIONS ---

  async subscribeToPushNotifications(userId: string) {
    // 1. Verifica se o navegador suporta Web Push e Service Workers
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging não é suportado neste navegador.');
      return;
    }

    try {
      // 2. Pede permissão ao usuário
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permissão para notificações foi negada pelo usuário.');
        return;
      }

      // 3. Aguarda o Service Worker oficial ficar pronto (removido o registro manual)
      const registration = await navigator.serviceWorker.ready;

      // 4. Verifica se já existe uma inscrição ativa
      let subscription = await registration.pushManager.getSubscription();

      // 5. Cria uma nova inscrição caso não exista
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // 6. Extrai as chaves criptográficas geradas pelo navegador
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh') as ArrayBuffer)));
      const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth') as ArrayBuffer)));

      // 7. Limpa inscrições antigas com o mesmo endpoint para evitar duplicação e salva a nova
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      
      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth
      });

      if (error) {
        console.error('Erro ao salvar a inscrição no banco:', error);
      } else {
        console.log('Inscrição Web Push salva com sucesso no Supabase!');
      }

    } catch (error) {
      console.error('Erro durante a inscrição do Web Push:', error);
    }
  },

  // --- LÓGICA EXISTENTE DE NOTIFICAÇÕES IN-APP ---

  async getNotifications(userId: string): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar notificações:", error);
      throw error;
    }
    return data || [];
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      throw error;
    }
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      throw error;
    }
  }
};