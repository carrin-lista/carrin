import { supabase } from './supabase';

export const itemService = {
  // 1. OBTÉM OU CRIA A MAIN LIST (Com Self-Healing)
  async getActiveMainListId(homeId: string): Promise<string | null> {
    try {
      console.log(`[Carrin/Main] Buscando Main da Casa: ${homeId}`);
      
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('home_id', homeId)
        .eq('list_type', 'main')
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[Carrin/Main] SELECT falhou:', { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint, homeId });
        throw error;
      }

      if (data) {
        console.log(`[Carrin/Main] Main encontrada: ${data.id}`);
        return data.id;
      }

      console.log(`[Carrin/Main] Main não encontrada. Tentando criar (Self-healing)...`);
      const { data: newList, error: insertError } = await supabase
        .from('shopping_lists')
        .insert({ home_id: homeId, name: 'Compras da Casa', list_type: 'main', status: 'active' })
        .select('id')
        .single();

      if (insertError) {
        console.error('[Carrin/Main] INSERT falhou (Self-healing abortado):', { code: insertError?.code, message: insertError?.message, details: insertError?.details, hint: insertError?.hint, homeId });
        
        if (insertError.code === '23505') { 
          const { data: retryData } = await supabase.from('shopping_lists').select('id').eq('home_id', homeId).eq('list_type', 'main').eq('status', 'active').maybeSingle();
          return retryData?.id || null;
        }
        throw insertError;
      }

      console.log(`[Carrin/Main] Main criada com sucesso: ${newList?.id}`);
      return newList?.id || null;
    } catch (err) {
      console.error('[Carrin/Main] Erro Fatal:', err);
      throw err; 
    }
  },

  // 2. FUNÇÕES DA LISTA RÁPIDA (As que estavam faltando)
  async getActiveQuickList(homeId: string): Promise<{ id: string, name: string | null } | null> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id, name')
      .eq('home_id', homeId)
      .eq('list_type', 'quick')
      .eq('status', 'active')
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async createQuickList(homeId: string, name: string): Promise<string> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ home_id: homeId, name, list_type: 'quick', status: 'active' })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  },

  async renameQuickList(listId: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_lists')
      .update({ name })
      .eq('id', listId);
    if (error) throw error;
  },

  async deleteQuickList(listId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_lists')
      .update({ status: 'deleted' })
      .eq('id', listId);
    if (error) throw error;
  },

  // FUNÇÃO RESTAURADA DE AUTOCOMPLETAR (SUGESTÕES)
  async getRecentItemSuggestions(_homeId: string, searchTerm: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_item_suggestions', { 
        search_term: searchTerm 
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar sugestões do histórico:', error);
      return [];
    }
  },

  // 3. OPERAÇÕES DE ITENS
  async getItems(listId: string) {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*, users(username, full_name, avatar_url)')
      .eq('shopping_list_id', listId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addItem(item: any) {
    const { data, error } = await supabase
      .from('shopping_items')
      .insert(item)
      .select('*, users(username, full_name, avatar_url)')
      .single();

    if (error) throw error;
    return data;
  },

  async toggleItemCompletion(id: string, isCompleted: boolean, price: number, unitPrice: number, boughtQuantity: number) {
    const { error } = await supabase
      .from('shopping_items')
      .update({ is_completed: isCompleted, price, unit_price: unitPrice, bought_quantity: boughtQuantity })
      .eq('id', id);

    if (error) throw error;
  },

  async updateItem(id: string, updates: any) {
    const { error } = await supabase
      .from('shopping_items')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteItem(id: string) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async clearList(listId: string) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('shopping_list_id', listId);

    if (error) throw error;
  }
};