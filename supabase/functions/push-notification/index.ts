import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

// 1. Configuração das chaves VAPID (você vai gerar o par real de chaves depois)
const publicVapidKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const privateVapidKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';

webpush.setVapidDetails(
  'mailto:contato@seucarrin.com',
  publicVapidKey,
  privateVapidKey
);

serve(async (req) => {
  try {
    // Pega os dados que o banco de dados enviou (Webhook)
    const payload = await req.json();
    const notification = payload.record; // A linha recém inserida na tabela notifications

    // 2. Conecta no Supabase usando a chave de serviço (ignora RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Busca todos os aparelhos (tokens) registrados para este usuário
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id);

    if (error || !subscriptions) throw error;

    // 4. Dispara a notificação para cada aparelho encontrado
    const pushPayload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      icon: '/pwa-192x192.png', // O ícone do seu app
      url: '/' // Para onde ir quando clicar na notificação
    });

    const sendPromises = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };
      
      return webpush.sendNotification(pushSubscription, pushPayload)
        .catch(async (err) => {
          // Se o token expirou ou o usuário desinstalou o PWA, deletamos do banco
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id);
          }
          console.error('Erro ao enviar push para um aparelho:', err);
        });
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
})