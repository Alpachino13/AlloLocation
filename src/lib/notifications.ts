import * as ExpoNotifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// ── Config globale handler (affiche notif même app ouverte) ──
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Demande la permission et enregistre le push token Expo.
 * Sauvegarde le token dans la table `profils` (colonne push_token).
 * À appeler une fois au login / au boot de l'app.
 */
export async function enregistrerPushToken(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[Push] Simulateur — push tokens non disponibles')
      return null
    }

    // Demander la permission
    const { status: existing } = await ExpoNotifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await ExpoNotifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission refusée par l\'utilisateur')
      return null
    }

    // Configurer le channel Android AVANT getExpoPushTokenAsync
    if (Platform.OS === 'android') {
      await ExpoNotifications.setNotificationChannelAsync('reservations', {
        name: 'Réservations',
        importance: ExpoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
      })
    }

    // Récupérer le token Expo Push
    console.log('[Push] Récupération du token...')
    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
      projectId: '6c340de6-d45d-4518-9d82-5105ee73dcd5',
    })
    const token = tokenData.data
    console.log('[Push] Token obtenu:', token)

    // Sauvegarder dans Supabase
    const { error } = await supabase
      .from('profils')
      .update({ push_token: token })
      .eq('id', userId)

    if (error) {
      console.error('[Push] Erreur Supabase UPDATE:', JSON.stringify(error))
      return null
    }

    console.log('[Push] Token sauvegardé avec succès ✓')
    return token
  } catch (err: any) {
    console.error('[Push] Erreur enregistrement token:', err?.message ?? err)
    return null
  }
}

/**
 * Envoie une notification push via l'API Expo Push Service.
 * + Insère dans la table `notifications` (in-app).
 *
 * @param targetUserId  - L'user_id Supabase du destinataire
 * @param titre         - Titre de la notif
 * @param message       - Corps de la notif
 * @param type          - 'confirmation' | 'annulation' | 'reservation' | 'info'
 */
export async function envoyerNotification({
  targetUserId,
  titre,
  message,
  type = 'info',
}: {
  targetUserId: string
  titre: string
  message: string
  type?: string
}): Promise<void> {
  // 1. Insérer en base (in-app notifications)
  await supabase.from('notifications').insert({
    user_id: targetUserId,
    titre,
    message,
    type,
    lu: false,
  })

  // 2. Récupérer le push_token du destinataire
  const { data: profil } = await supabase
    .from('profils')
    .select('push_token')
    .eq('id', targetUserId)
    .single()

  const pushToken = profil?.push_token
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log('[Push] Pas de token pour cet utilisateur — notif in-app seulement')
    return
  }

  // 3. Envoyer via Expo Push API
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title: titre,
        body: message,
        sound: 'default',
        priority: 'high',
        channelId: 'reservations',
        data: { type },
      }),
    })

    const result = await response.json()
    if (result?.data?.status === 'error') {
      console.error('[Push] Expo error:', result.data.message)
    } else {
      console.log('[Push] Envoyée avec succès à', pushToken)
    }
  } catch (err) {
    console.error('[Push] Erreur envoi:', err)
  }
}
