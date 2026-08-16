import { supabase } from './supabase';

export const homeService = {
  async createHome(name: string, userId: string) {
    const { data: homeId, error } = await supabase.rpc('create_home_with_owner', {
      home_name: name.trim(),
      creator_id: userId
    });

    if (error) throw error;

    return { id: homeId, name: name.trim(), created_by: userId };
  },

  async updateHomeName(homeId: string, name: string) {
    const { error } = await supabase
      .from('homes')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', homeId);

    if (error) throw error;
  },
  
  async getUserHome(userId: string) {
    const { data, error } = await supabase
      .from('home_members')
      .select('home_id')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; 
    return data || null;
  },

  async getHomeMembers(homeId: string) {
    const { data, error } = await supabase
      .from('home_members')
      .select('role, users (id, email, full_name, phone, username, avatar_url)')
      .eq('home_id', homeId);

    if (error) throw error;
    return data || [];
  },

  async getHomeDetails(homeId: string) {
    const { data: homeData, error: homeError } = await supabase
      .from('homes')
      .select('*')
      .eq('id', homeId)
      .single();

    if (homeError) throw homeError;

    const membersData = await this.getHomeMembers(homeId);

    return {
      home: homeData,
      members: membersData || []
    };
  },

  async findUserByUsername(username: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, username, avatar_url')
      .ilike('username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async generateInviteLink(homeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('home_invites')
      .insert([{ home_id: homeId, expires_at: expiresAt, created_by: user.id }])
      .select('id')
      .single();

    if (error) throw error;
    return `${window.location.origin}/invite/${data.id}`;
  },

  async generateDirectInvite(homeId: string, targetUserId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('home_invites')
      .insert([{ home_id: homeId, expires_at: expiresAt, created_by: user.id, target_user_id: targetUserId }])
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async getPendingDirectInvites(userId: string) {
    const { data, error } = await supabase
      .from('home_invites')
      .select('id, home_id, expires_at, homes(name)')
      .eq('target_user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  
  async getInviteDetails(inviteId: string) {
    const { data, error } = await supabase
      .from('home_invites')
      .select(`
        id,
        home_id,
        expires_at,
        target_user_id,
        homes:home_id (name)
      `)
      .eq('id', inviteId)
      .single();

    if (error) throw error;

    if (new Date(data.expires_at) < new Date()) {
      throw new Error('Este convite expirou.');
    }

    return data;
  },

  async acceptInvite(inviteId: string, homeId: string, userId: string) {
    const invite = await this.getInviteDetails(inviteId);
    
    if (invite.target_user_id && invite.target_user_id !== userId) {
      throw new Error('Este convite não foi direcionado à sua conta.');
    }

    const existing = await this.getUserHome(userId);
    
    if (existing) {
      if (existing.home_id === homeId) {
        throw new Error('Você já pertence a esta residência.');
      }
      throw new Error('Você já pertence a uma residência. Cada usuário pode participar de apenas uma Casa por vez.');
    }

    const { error: memberError } = await supabase
      .from('home_members')
      .insert([{ home_id: homeId, user_id: userId, role: 'member' }]);

    if (memberError) throw memberError;

    await supabase.from('home_invites').delete().eq('id', inviteId);
    return true;
  },

  async getPendingInvites(homeId: string) {
    const { data, error } = await supabase
      .from('home_invites')
      .select('id, created_at, expires_at, target_user_id, users:target_user_id (username, full_name)')
      .eq('home_id', homeId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async cancelInvite(inviteId: string) {
    const { error } = await supabase
      .from('home_invites')
      .delete()
      .eq('id', inviteId);

    if (error) throw error;
  },

  async removeMember(homeId: string, userId: string) {
    const { error } = await supabase
      .from('home_members')
      .delete()
      .eq('home_id', homeId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // --- FUNÇÕES REESCRITAS PARA FOTO DA CASA COM ROLLBACK ---
  
  async uploadHomePhoto(homeId: string, file: File, oldPhotoUrl?: string | null): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${homeId}-${Math.random()}.${fileExt}`;
    const filePath = `homes/${fileName}`;

    // 1. Faz o upload da nova foto para o Storage
    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Obtém a URL pública do novo arquivo
    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    // 3. Tenta salvar a URL no banco (Aqui a RLS do Supabase fará o bloqueio se o usuário não for owner/admin)
    const { error: updateError } = await supabase
      .from('homes')
      .update({ photo_url: publicUrl })
      .eq('id', homeId);

    // 4. Se o banco rejeitar a mudança (falta de permissão), deletamos o arquivo órfão que subiu e abortamos
    if (updateError) {
      await supabase.storage.from('profiles').remove([filePath]);
      throw new Error('Você não tem permissão para alterar a foto ou ocorreu um erro de sincronização.');
    }

    // 5. O UPDATE foi um sucesso! Agora podemos excluir a foto antiga com segurança
    if (oldPhotoUrl) {
      try {
        const oldFilePath = oldPhotoUrl.split('/profiles/')[1];
        if (oldFilePath) {
          await supabase.storage.from('profiles').remove([oldFilePath]);
        }
      } catch (cleanupError) {
        console.warn('Falha silenciosa ao remover foto antiga (órfã). A nova foto já está ativa:', cleanupError);
      }
    }

    return publicUrl;
  },

  async deleteHomePhoto(homeId: string, photoUrl: string) {
    // 1. Atualiza o banco primeiro (Fonte de verdade). Se o usuário não tiver permissão, aborta aqui.
    const { error: updateError } = await supabase
      .from('homes')
      .update({ photo_url: null })
      .eq('id', homeId);

    if (updateError) throw new Error('Você não tem permissão para remover a foto da Casa.');

    // 2. Se o banco permitiu, tentamos excluir a foto física do Storage.
    try {
      const filePath = photoUrl.split('/profiles/')[1]; 
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('profiles')
          .remove([filePath]);
          
        if (storageError) console.warn('Erro ao remover foto física do storage, arquivo órfão mantido:', storageError);
      }
    } catch (err) {
      console.warn('Erro na estruturação da rota do storage:', err);
    }
  },

  async transferOwnership(homeId: string, newOwnerId: string) {
    const { error } = await supabase.rpc('transfer_home_ownership', {
      p_home_id: homeId,
      p_new_owner_id: newOwnerId
    });

    if (error) throw error;
  }
};