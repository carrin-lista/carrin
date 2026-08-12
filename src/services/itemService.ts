import { supabase } from './supabase';

export interface NewItemDTO {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category_id?: string;
  observation?: string;
  home_id: string;
  created_by: string;
}

export const itemService = {
  async getActiveListId(homeId: string): Promise<string> {
    const { data: existingList } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('home_id', homeId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingList) return existingList.id;

    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert([{ home_id: homeId, status: 'active' }])
      .select('id')
      .single();

    if (createError) throw createError;
    return newList.id;
  },

  async getItems(homeId: string) {
    const listId = await this.getActiveListId(homeId);

    const { data, error } = await supabase
      .from('shopping_items')
      .select('*, users:created_by(id, full_name, username, avatar_url)')
      .eq('shopping_list_id', listId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addItem(item: Omit<NewItemDTO, 'shopping_list_id'>) {
    const shoppingListId = await this.getActiveListId(item.home_id);

    const { data, error } = await supabase
      .from('shopping_items')
      .insert([{
        ...item,
        shopping_list_id: shoppingListId
      }])
      .select('*, users:created_by(id, full_name, username, avatar_url)')
      .single();

    if (error) throw error;
    return data;
  },

  async toggleItemCompletion(itemId: string, isCompleted: boolean, price?: number, unitPrice?: number, boughtQuantity?: number) {
    const updateData: any = { 
      is_completed: isCompleted, 
      updated_at: new Date().toISOString() 
    };
    
    if (price !== undefined) updateData.price = price;
    if (unitPrice !== undefined) updateData.unit_price = unitPrice;
    if (boughtQuantity !== undefined) updateData.bought_quantity = boughtQuantity;

    const { error } = await supabase
      .from('shopping_items')
      .update(updateData)
      .eq('id', itemId);

    if (error) throw error;
  },

  async deleteItem(itemId: string) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },

  async clearActiveList(shoppingListId: string) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('shopping_list_id', shoppingListId);

    if (error) throw error;
  },

  async updateItem(itemId: string, updates: { name?: string; quantity?: number | null; unit?: string | null; observation?: string; category_id?: string }) {
    const { error } = await supabase
      .from('shopping_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  },

  async getRecentItemSuggestions(homeId: string, query: string) {
    if (!query || query.trim().length < 2) return [];
    
    const { data, error } = await supabase
      .from('shopping_items')
      .select('name, quantity, unit, price, unit_price, bought_quantity')
      .eq('home_id', homeId)
      .eq('is_completed', true)
      .ilike('name', `%${query.trim()}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error("Erro ao buscar sugestões:", error);
      return [];
    }

    const uniqueItems: any[] = [];
    const seen = new Set();
    
    for (const item of data || []) {
      const normalized = item.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueItems.push(item);
      }
    }
    
    return uniqueItems.slice(0, 4);
  }
};