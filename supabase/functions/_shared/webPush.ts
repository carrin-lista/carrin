import webpush from "npm:web-push@3.6.1"

export async function sendWebPush(userId: string, pushPayload: any, supabaseAdmin: any) {
  const publicVapidKey = Deno.env.get('VAPID_PUBLIC_KEY')!
  const privateVapidKey = Deno.env.get('VAPID_PRIVATE_KEY')!

  webpush.setVapidDetails(
    'mailto:suporte@carrin.app',
    publicVapidKey,
    privateVapidKey
  )

  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (subError || !subscriptions || subscriptions.length === 0) {
    return {
      success: false,
      reason: 'NO_SUBSCRIPTIONS',
      subscriptions_found: 0,
      sent: 0,
      failed: 0,
      pruned: 0
    }
  }

  let sent = 0;
  let failed = 0;
  let pruned = 0;

  const payloadString = JSON.stringify(pushPayload);

  const sendPromises = subscriptions.map(async (sub: any) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    }

    try {
      await webpush.sendNotification(pushSubscription, payloadString);
      sent++;
    } catch (err: any) {
      failed++;
      // 410 Gone ou 404 Not Found significa que a inscrição foi revogada pelo usuário no navegador
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        pruned++;
      }
      // Loga de forma segura (sem expor auth ou p256dh)
      console.error(`[Push Error] User: ${userId}, Sub: ${sub.id}, Status: ${err.statusCode}`, err.message);
    }
  });

  await Promise.all(sendPromises);

  // Se tínhamos inscrições mas todas falharam (ex: erro de VAPID ou todas revogadas)[cite: 5]
  if (sent === 0 && failed > 0) {
    return {
      success: false,
      reason: 'ALL_PUSH_SENDS_FAILED',
      subscriptions_found: subscriptions.length,
      sent,
      failed,
      pruned
    }
  }

  return {
    success: true,
    subscriptions_found: subscriptions.length,
    sent,
    failed,
    pruned
  }
}