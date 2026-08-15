import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendWebPush } from "../_shared/webPush.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Receber Authorization do administrador logado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Falta o header de autorização (Authorization).')
    }

    const supabaseAnon = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Validar a sessão do JWT[cite: 4]
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
    if (authError || !user) throw new Error('Não autorizado (Token inválido).')

    // 3. Cliente Service Role exclusivo do lado do servidor para validações internas e envio[cite: 4]
    const supabaseAdmin = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('MY_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Consultar console_admins e exigir status = active[cite: 4]
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('console_admins')
      .select('status')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData || adminData.status !== 'active') {
      throw new Error('Acesso negado: Administrador inativo ou não encontrado.')
    }

    // 5. Receber payload do frontend do Console[cite: 4]
    const payload = await req.json()
    if (!payload.user_id) throw new Error('O user_id de destino é obrigatório.')

    const pushPayload = {
      title: payload.title || 'Teste de notificação Carrin',
      body: payload.message || 'Se você recebeu isso, o Web Push está funcionando.',
      url: payload.url || '/'
    }

    // 6. Usar a mesma lógica compartilhada do _shared/webPush.ts[cite: 4]
    const result = await sendWebPush(payload.user_id, pushPayload, supabaseAdmin)

    // 7. Retornar os contadores exatos para o Console[cite: 4]
    return new Response(JSON.stringify({ ...result, user_id: payload.user_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})