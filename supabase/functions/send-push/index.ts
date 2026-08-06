import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import webpush from "npm:web-push@3.6.1"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

    const publicVapidKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const privateVapidKey = Deno.env.get('VAPID_PRIVATE_KEY')!

    webpush.setVapidDetails(
      'mailto:suporte@carrin.app',
      publicVapidKey,
      privateVapidKey
    )

    const supabaseAdmin = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('MY_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id)

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma inscrição push para este usuário' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const pushPayload = JSON.stringify({
      title: record.title || 'Carrin',
      body: record.message || 'Você tem uma nova notificação',
      url: '/'
    })

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      }

      try {
        await webpush.sendNotification(pushSubscription, pushPayload)
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        }
        console.error('Erro ao enviar push:', err)
      }
    })

    await Promise.all(sendPromises)

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