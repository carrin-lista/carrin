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

export const notificationService = {
  // Busca todas as notificações do usuário logado
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

  // Marca uma notificação específica como lida
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

  // Marca todas as notificações do usuário como lidas de uma vez só
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