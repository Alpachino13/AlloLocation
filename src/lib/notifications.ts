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
    if (Platform.OS === 'web') {
      // Pas de push natif sur le web (pas de VAPID / tokens Expo)
      console.log('[Push] Web — push tokens non disponibles')
      return null
    }

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

// NOTE : l'envoi des notifications (in-app) est désormais géré côté base de
// données via des triggers (notification_triggers_migration.sql +
// notification_annulation_triggers_migration.sql). L'envoi client-side
// était bloqué par RLS (403 sur notifications, 406 sur profils.push_token).
// L'envoi push natif (Expo Push API) passe par l'Edge Function
// supabase/functions/send-push-notification, déclenchée par
// notification_push_trigger_migration.sql (pg_net → Edge Function → Expo).
