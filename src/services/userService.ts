import { supabase } from './supabase';

export const userService = {
  // Busca os dados do perfil do usuário logado
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Verifica se o username já está em uso (chamando a RPC segura)
  async checkUsernameAvailability(username: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_username_available', {
      check_username: username
    });

    if (error) throw error;
    return data as boolean;
  },

  // Atualiza os dados do perfil
  async updateProfile(userId: string, updates: { full_name?: string; phone?: string; username?: string; avatar_url?: string | null }) {
    const { error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
  },

  // Faz upload da foto para o Storage e retorna a URL pública
  async uploadAvatar(userId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // Remove a foto do Storage
  async deleteAvatar(avatarUrl: string) {
    // Extrai apenas o caminho do arquivo a partir da URL completa
    const pathParts = avatarUrl.split('/profiles/');
    if (pathParts.length > 1) {
      const filePath = pathParts[1];
      const { error } = await supabase.storage.from('profiles').remove([filePath]);
      if (error) throw error;
    }
  }
};