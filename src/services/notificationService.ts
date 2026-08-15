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

// Lendo a chave do .env (Garante única fonte de verdade e segurança)[cite: 5]
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Helper para converter VAPID
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

// Helper para validar a chave da inscrição atual[cite: 5]
function isSubscriptionUsingCurrentVapidKey(subscription: PushSubscription, currentVapidBase64: string): boolean {
  if (!subscription.options.applicationServerKey) return false;
  
  const currentKeyArray = urlBase64ToUint8Array(currentVapidBase64);
  const subKeyArray = new Uint8Array(subscription.options.applicationServerKey);
  
  if (currentKeyArray.length !== subKeyArray.length) return false;
  
  for (let i = 0; i < currentKeyArray.length; i++) {
    if (currentKeyArray[i] !== subKeyArray[i]) return false;
  }
  
  return true;
}

export const notificationService = {
  
  // --- LÓGICA DE WEB PUSH NOTIFICATIONS ---

  async subscribeToPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging não é suportado neste navegador.');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY não está configurada no .env');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permissão para notificações foi negada pelo usuário.');
        return;
      }

      // Consome o Service Worker oficial gerenciado pelo pwa.ts[cite: 5]
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      // Verifica se a subscription existente pertence a uma VAPID antiga[cite: 5]
      if (subscription) {
        const isValid = isSubscriptionUsingCurrentVapidKey(subscription, VAPID_PUBLIC_KEY);
        if (!isValid) {
          console.warn('Subscription antiga detectada (VAPID divergente). Recriando...');
          await subscription.unsubscribe();
          subscription = null; // Força a criação de uma nova abaixo
        }
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // Usa o toJSON exigido para evitar quebra de chaves em navegadores diferentes[cite: 5]
      const subscriptionJSON = subscription.toJSON();

      if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
        throw new Error('PushSubscription inválida ou incompleta.');
      }

      // Invoca a Edge Function para o backend decidir o ownership baseado no JWT do usuário[cite: 5]
      const { data, error } = await supabase.functions.invoke('register-push-subscription', {
        body: {
          endpoint: subscriptionJSON.endpoint,
          p256dh: subscriptionJSON.keys.p256dh,
          auth: subscriptionJSON.keys.auth
        }
      });

      if (error || !data?.success) {
        console.error('Erro ao registrar subscription no backend:', error || data?.error);
      } else {
        console.log('Inscrição Web Push salva com sucesso! Ação:', data.action);
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