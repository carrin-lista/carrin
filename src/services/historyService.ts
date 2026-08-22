import { supabase } from './supabase';

export const historyService = {
  
  // Adaptado para usar a RPC transacional unificada que trata Main e Quick nativamente
  async finishActiveList(_homeId: string, listId: string, totalAmount: number, receiptUrls: string[], marketName?: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('finish_shopping_list', {
      p_list_id: listId,
      p_total_amount: totalAmount,
      p_receipt_urls: receiptUrls || [],
      p_market_name: marketName || null
    });

    if (error) throw error;
    // Se for Main, 'data' conterá o ID da nova lista. Se for Quick, 'data' será nulo (sinalizando para voltar à Main)
    return data;
  },

  async getHistory(homeId: string) {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select(`
        *,
        shopping_items (
          name,
          quantity,
          unit,
          price,
          is_completed,
          category_id,
          users!shopping_items_created_by_fkey (
            full_name,
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

  async getRecentMarkets(homeId: string) {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('market_name')
      .eq('home_id', homeId)
      .eq('status', 'completed')
      .not('market_name', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    
    const uniqueMarkets = Array.from(new Set(data.map(list => list.market_name))).filter(Boolean);
    return uniqueMarkets;
  },

  async updateMarketName(listId: string, marketName: string | null) {
    const { error } = await supabase
      .from('shopping_lists')
      .update({ market_name: marketName })
      .eq('id', listId);

    if (error) throw error;
  },
  
  async uploadReceipt(file: File, homeId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${homeId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};