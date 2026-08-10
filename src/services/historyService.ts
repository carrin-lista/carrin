import { supabase } from './supabase';

export const historyService = {
  
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

  async finishActiveList(homeId: string, activeListId: string, totalAmount: number, receiptUrls: string[] = [], marketName?: string) {
    const { error: updateError } = await supabase
      .from('shopping_lists')
      .update({ 
        status: 'completed', 
        total_amount: totalAmount,
        receipt_urls: receiptUrls,
        market_name: marketName || null,
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
  },

  // Retorna uma lista de nomes únicos de mercados das últimas compras
  async getRecentMarkets(homeId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('market_name')
      .eq('home_id', homeId)
      .eq('status', 'completed')
      .not('market_name', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error("Erro ao buscar mercados recentes", error);
      return [];
    }

    const uniqueMarkets = Array.from(new Set(data.map(item => item.market_name!.trim()))).filter(Boolean);
    return uniqueMarkets.slice(0, 5); // Retorna no máximo os 5 mais recentes
  },

  // Atualiza apenas o mercado de uma compra já finalizada
  async updateMarketName(listId: string, marketName: string | null) {
    const { error } = await supabase
      .from('shopping_lists')
      .update({ market_name: marketName })
      .eq('id', listId);

    if (error) throw error;
  }
};