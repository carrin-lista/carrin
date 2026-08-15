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
    const payload = await req.json()
    const record = payload.record 

    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: 'Nenhum registro encontrado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('MY_SERVICE_ROLE_KEY') ?? ''
    )

    const pushPayload = {
      title: record.title || 'Carrin',
      body: record.message || 'Você tem uma nova notificação',
      url: '/'
    }

    // Processa o envio usando a lógica unificada e recebe o report[cite: 5]
    const result = await sendWebPush(record.user_id, pushPayload, supabaseAdmin)

    return new Response(JSON.stringify(result), {
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