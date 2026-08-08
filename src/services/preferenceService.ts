import { supabase } from './supabase';

export type UserPreferences = {
  notify_home_updates: boolean;
  notify_reminders: boolean;
  notify_suggestions: boolean;
};

export const preferenceService = {
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Erro ao buscar preferências:", error);
      return null;
    }
    return data;
  },

  async updatePreferences(userId: string, prefs: Partial<UserPreferences>) {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ 
        user_id: userId, 
        ...prefs,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("Erro ao salvar preferências:", error);
      throw error;
    }
  },

  // --- NOVAS FUNÇÕES PARA O APRENDIZADO DA CASA ---
  
  async getHomeCategoryPreferences(homeId: string): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('home_category_preferences')
      .select('normalized_name, category_id')
      .eq('home_id', homeId);

    if (error) {
      console.error("Erro ao buscar preferências da casa:", error);
      return {};
    }

    const prefs: Record<string, string> = {};
    data?.forEach(row => {
      prefs[row.normalized_name] = row.category_id;
    });
    return prefs;
  },

  async saveHomeCategoryPreference(homeId: string, normalizedName: string, categoryId: string, userId: string) {
    const { error } = await supabase
      .from('home_category_preferences')
      .upsert({
        home_id: homeId,
        normalized_name: normalizedName,
        category_id: categoryId,
        updated_by: userId,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'home_id, normalized_name'
      });

    if (error) {
      console.error("Erro ao salvar preferência da casa:", error);
    }
  }
};