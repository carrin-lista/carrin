import { supabase } from './supabase';

export const supportService = {
  async getTickets(userId: string) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createTicket(userId: string, homeId: string | null, category: string, subject: string, description: string) {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([{
        user_id: userId,
        home_id: homeId,
        category,
        subject,
        description,
        status: 'open'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getTicketMessages(ticketId: string) {
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async sendMessage(ticketId: string, userId: string, message: string) {
    // Insere a mensagem
    const { error: insertError } = await supabase
      .from('support_ticket_messages')
      .insert([{
        ticket_id: ticketId,
        sender_user_id: userId,
        message,
        is_internal: false // Segurança extra no frontend, embora a RLS já trave isso
      }]);

    if (insertError) throw insertError;

    // Atualiza o updated_at e last_message_at do ticket para ele subir na lista do Console
    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ 
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (updateError) throw updateError;
  }
};