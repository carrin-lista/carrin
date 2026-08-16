import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratamento de CORS para o navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Inicia o cliente Supabase com o JWT do usuário (repassado do frontend)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Identifica o usuário SOMENTE através do JWT (Prevenção contra exclusão de conta alheia)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Não autorizado. Sessão inválida.')

    // 3. Inicia o cliente Admin (Service Role) para executar as deleções pesadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Limpeza Física: Remover a foto de perfil do Storage (se existir)
    const { data: profile } = await supabaseAdmin.from('users').select('avatar_url').eq('id', user.id).single()
    if (profile?.avatar_url) {
      const filePath = profile.avatar_url.split('/profiles/')[1]
      if (filePath) {
        await supabaseAdmin.storage.from('profiles').remove([filePath])
      }
    }

    // 5. O Golpe Final: Deletar o usuário do sistema de Autenticação
    // Nota: O banco de dados deve estar configurado com ON DELETE CASCADE nas tabelas filhas 
    // (users, home_members, push_subscriptions) para que essa única ação limpe o rastro inteiro.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})