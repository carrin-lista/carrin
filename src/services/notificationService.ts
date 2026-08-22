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

// Lendo a chave do .env (Garante única fonte de verdade e segurança)
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

// Helper para validar a chave da inscrição atual
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

  async subscribeToPushNotifications(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging não é suportado neste navegador.');
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('VITE_VAPID_PUBLIC_KEY não está configurada no .env');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permissão para notificações foi negada pelo usuário.');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const isValid = isSubscriptionUsingCurrentVapidKey(subscription, VAPID_PUBLIC_KEY);
        if (!isValid) {
          console.warn('Subscription antiga detectada (VAPID divergente). Recriando...');
          await subscription.unsubscribe();
          subscription = null; 
        }
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const subscriptionJSON = subscription.toJSON();

      if (!subscriptionJSON.endpoint || !subscriptionJSON.keys?.p256dh || !subscriptionJSON.keys?.auth) {
        throw new Error('PushSubscription inválida ou incompleta.');
      }

      // Chama a Edge Function 
      const { data, error } = await supabase.functions.invoke('register-push-subscription', {
        body: {
          endpoint: subscriptionJSON.endpoint,
          p256dh: subscriptionJSON.keys.p256dh,
          auth: subscriptionJSON.keys.auth
        }
      });

      // VALIDAÇÃO REAL DO BACKEND
      if (error || !data?.success) {
        console.error('Erro real retornado pela Edge Function:', error || data?.error);
        return false; // Retorna falso, impedindo a UI de comemorar vitória
      }

      console.log('Inscrição Web Push salva no banco com sucesso!');
      return true; // Sucesso Absoluto (Estado 3)

    } catch (error) {
      console.error('Erro durante o fluxo de inscrição do Web Push:', error);
      return false; // Retorna falso em caso de quebra no frontend
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
  },

  // NOVO: Exclusão persistente isolada
  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error("Erro ao excluir notificação no banco:", error);
      throw error;
    }
  }
};