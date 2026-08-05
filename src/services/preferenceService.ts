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
  }
};