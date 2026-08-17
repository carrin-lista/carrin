import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let currentStep = 'START';

  try {
    currentStep = 'AUTH_USER';
    // 1. Inicia o cliente Supabase com o JWT do usuário logado
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Garante que quem está chamando a função é um usuário autêntico
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Não autorizado. Sessão inválida.')

    currentStep = 'INIT_ADMIN';
    // 3. Inicia o cliente Admin (Service Role) para ter poder de exclusão
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    currentStep = 'DELETE_STORAGE';
    // 4. Limpeza Física: Remover a foto de perfil do Storage (se existir)
    const { data: profile } = await supabaseAdmin.from('users').select('avatar_url').eq('id', user.id).single()
    if (profile?.avatar_url) {
      const filePath = profile.avatar_url.split('/profiles/')[1]
      if (filePath) {
        await supabaseAdmin.storage.from('profiles').remove([filePath])
      }
    }

    // ==========================================
    // NOVA ETAPA: LIMPANDO AS AMARRAS DO BANCO
    // ==========================================
    currentStep = 'CLEAN_DEPENDENCIES';
    
    // Remove inscrições de Push
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', user.id);

    // Remove convites de casa (enviados ou recebidos)
    await supabaseAdmin.from('home_invites').delete().or(`created_by.eq.${user.id},target_user_id.eq.${user.id}`);

    // Remove itens da lista de compras adicionados por este usuário
    await supabaseAdmin.from('shopping_items').delete().eq('created_by', user.id);

    // Remove vínculos como membro de qualquer casa
    await supabaseAdmin.from('home_members').delete().eq('user_id', user.id);

    // Deleta as casas onde ele é o criador (a elegibilidade já garantiu que ele está sozinho)
    await supabaseAdmin.from('homes').delete().eq('created_by', user.id);
    // ==========================================


    currentStep = 'DELETE_AUTH_USER';
    // 5. O Comando Real: Deletar o usuário do sistema
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    currentStep = 'SUCCESS';
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    // LOG DETALHADO NO SUPABASE
    console.error('💥 DELETE ACCOUNT FAILED', {
      step: currentStep,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      cause: error?.cause
    });

    // RETORNO COM O ERRO EXATO PARA O FRONTEND
    return new Response(
      JSON.stringify({
        success: false,
        reason: 'DELETE_ACCOUNT_FAILED',
        step: currentStep,
        error: error?.message || 'Erro interno'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
})