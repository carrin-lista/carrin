import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cliente anônimo usando o Authorization da requisição para validar o usuário logado[cite: 5]
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { endpoint, p256dh, auth } = await req.json()

    if (!endpoint || !p256dh || !auth) {
      return new Response(JSON.stringify({ success: false, error: 'Missing subscription data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Cliente Admin para bypass do RLS (uso exclusivo interno) e fazer o Ownership do endpoint[cite: 5]
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca se este aparelho (endpoint) já estava registrado no banco
    const { data: existingSub } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('endpoint', endpoint)
      .maybeSingle()

    let action = 'created'

    if (existingSub) {
      if (existingSub.user_id !== user.id) {
        // Usuário B logou na máquina do Usuário A. Deleta o vínculo antigo e cria o novo.
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint)
        await supabaseAdmin.from('push_subscriptions').insert({
          user_id: user.id,
          endpoint,
          p256dh,
          auth
        })
        action = 'reassigned'
      } else {
        // Já pertence a ele, atualizamos apenas para garantir renovação das chaves
        await supabaseAdmin.from('push_subscriptions').update({ p256dh, auth }).eq('endpoint', endpoint)
        action = 'updated'
      }
    } else {
      // Inserção nova
      await supabaseAdmin.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth
      })
    }

    return new Response(JSON.stringify({ success: true, action }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})