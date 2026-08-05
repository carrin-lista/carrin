import { supabase } from './supabase';

export const historyService = {
  
  // Envia a imagem para o Supabase e devolve o link público
  async uploadReceipt(file: File, homeId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${homeId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  async finishActiveList(homeId: string, activeListId: string, totalAmount: number, receiptUrls: string[] = []) {
    const { error: updateError } = await supabase
      .from('shopping_lists')
      .update({ 
        status: 'completed', 
        total_amount: totalAmount,
        receipt_urls: receiptUrls,
        completed_at: new Date().toISOString() 
      })
      .eq('id', activeListId);

    if (updateError) {
      console.warn("Aviso ao atualizar detalhes, executando fallback básico:", updateError);
      const { error: fallbackError } = await supabase
        .from('shopping_lists')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', activeListId);

      if (fallbackError) throw fallbackError;
    }

    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert([{ home_id: homeId, status: 'active' }])
      .select('id')
      .single();

    if (createError) throw createError;
    return newList.id;
  },

  async getHistory(homeId: string) {
    // Risco Zero: Buscamos a lista, os itens e os dados do usuário criador de cada item
    const { data, error } = await supabase
      .from('shopping_lists')
      .select(`
        *,
        shopping_items (
          *,
          users (
            id,
            full_name,
            username,
            avatar_url
          )
        )
      `)
      .eq('home_id', homeId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};