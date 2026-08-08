// Supabase Edge Function : envoi de notifications push natives (Expo Push API)
//
// Appelée par les triggers DB (notification_push_trigger_migration.sql) via pg_net,
// pour chaque notification in-app insérée dans `notifications`.
//
// Déploiement :
//   npx supabase functions deploy send-push-notification \
//     --project-ref fmfpqqmksqasyhizeqiq --no-verify-jwt
//   puis définir le secret PUSH_SECRET (Dashboard → Edge Functions → Secrets).
//   Le MÊME secret doit être inséré dans la table app_config (voir la migration).
//
// Sécurité : la fonction vérifie l'en-tête `x-push-secret` (secret partagé avec les
// triggers DB). Elle lit le push_token avec le rôle service — les clients ne peuvent
// pas lire le token d'un autre utilisateur (RLS), d'où l'exécution côté serveur.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PUSH_SECRET = Deno.env.get('PUSH_SECRET') ?? ''

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const CHANNEL_ID = 'reservations' // channel Android créé dans src/lib/notifications.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PushPayload {
  targetUserId: string
  titre: string
  message: string
  type?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // Garde : seul un appelant connaissant le secret (nos triggers) peut envoyer
  if (req.headers.get('x-push-secret') !== PUSH_SECRET) {
    console.warn('[Push] Secret invalide — requête rejetée')
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  let payload: PushPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400, headers: corsHeaders })
  }

  const { targetUserId, titre, message, type = 'info' } = payload
  if (!targetUserId) {
    return new Response('Missing targetUserId', { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Récupérer le push_token du destinataire (rôle service → RLS contournée)
  const { data: profil, error } = await supabase
    .from('profils')
    .select('push_token')
    .eq('id', targetUserId)
    .maybeSingle()

  if (error) {
    console.error('[Push] Erreur lecture profil:', error.message)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }

  const pushToken = profil?.push_token
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log(`[Push] Pas de token pour ${targetUserId} — push ignoré (in-app seulement)`)
    return new Response('No push token', { status: 204, headers: corsHeaders })
  }

  // 2. Envoyer via l'API Expo Push
  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title: titre ?? '',
        body: message ?? '',
        sound: 'default',
        priority: 'high',
        channelId: CHANNEL_ID,
        data: { type },
      }),
    })

    const result = await resp.json()
    if (result?.data?.status === 'error') {
      console.error('[Push] Expo error:', result.data.message)
      return new Response(result.data.message, { status: 500, headers: corsHeaders })
    }
    console.log('[Push] Envoyée avec succès à', pushToken)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[Push] Erreur envoi Expo:', err)
    return new Response('Push send failed', { status: 500, headers: corsHeaders })
  }
})
