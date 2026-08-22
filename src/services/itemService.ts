import { supabase } from './supabase';

export const itemService = {
  // Busca especificamente a Lista Principal Ativa
  async getActiveMainListId(homeId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('home_id', homeId)
      .eq('list_type', 'main')
      .eq('status', 'active')
      .maybeSingle();
      
    if (error) throw error;
    return data?.id || null;
  },

  // Busca especificamente a Lista Rápida Ativa
  async getActiveQuickList(homeId: string): Promise<{ id: string, name: string | null } | null> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id, name')
      .eq('home_id', homeId)
      .eq('list_type', 'quick')
      .eq('status', 'active')
      .maybeSingle();
      
    // Ignora erro de "nenhuma linha encontrada", pois é normal não ter Quick list
    if (error && error.code !== 'PGRST116') throw error; 
    return data || null;
  },

  // Cria a Quick List e devolve o ID (Trata concorrência 23505)
  async createQuickList(homeId: string, name: string | null): Promise<string> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ home_id: homeId, list_type: 'quick', status: 'active', name })
      .select('id')
      .single();
      
    if (error) {
      if (error.code === '23505') throw error; // UNIQUE violation: capturado pelo frontend para abrir a lista existente
      throw error;
    }
    return data.id;
  },

  // Renomeia a Lista Rápida
  async renameQuickList(listId: string, name: string) {
    const { error } = await supabase
      .from('shopping_lists')
      .update({ name })
      .eq('id', listId);
    if (error) throw error;
  },

  // Exclui a Lista Rápida usando a RPC atômica
  async deleteQuickList(listId: string) {
    const { error } = await supabase.rpc('delete_quick_list', { p_list_id: listId });
    if (error) throw error;
  },

  // Busca os itens APENAS da lista selecionada
  async getItems(shoppingListId: string) {
    const { data, error } = await supabase
      .from('shopping_items')
      .select(`
        *,
        users!shopping_items_created_by_fkey (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('shopping_list_id', shoppingListId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Adiciona um item EXIGINDO shopping_list_id e home_id no objeto itemData
  async addItem(itemData: any) {
    const { data, error } = await supabase
      .from('shopping_items')
      .insert(itemData)
      .select(`
        *,
        users!shopping_items_created_by_fkey (
          username,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async toggleItemCompletion(itemId: string, isCompleted: boolean, price: number, unitPrice: number, boughtQuantity: number) {
    const { error } = await supabase
      .from('shopping_items')
      .update({ 
        is_completed: isCompleted,
        price: price,
        unit_price: unitPrice,
        bought_quantity: boughtQuantity
      })
      .eq('id', itemId);

    if (error) throw error;
  },

  async updateItem(itemId: string, updates: any) {
    const { error } = await supabase
      .from('shopping_items')
      .update(updates)
      .eq('id', itemId);

    if (error) throw error;
  },

  // Exclusão física do item
  async deleteItem(itemId: string) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },

  // Limpeza de itens APENAS da lista selecionada
  async clearList(shoppingListId: string) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('shopping_list_id', shoppingListId);

    if (error) throw error;
  },

  // Sugestões continuam sendo da Casa inteira
  async getRecentItemSuggestions(homeId: string, query: string) {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('name, category_id, unit, observation')
      .eq('home_id', homeId)
      .ilike('name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data || [];
  }
};