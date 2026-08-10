import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// GUARD: expo-notifications remote push support was removed from Expo Go in
// SDK 53+. A static `import` throws at module-load time and crashes the entire
// app before any React component can render. We use require() inside try-catch
// so the module never poisons the module graph when running in Expo Go.
// In a real dev-build / production APK the require succeeds normally.
// ─────────────────────────────────────────────────────────────────────────────
let ExpoNotifications: typeof import('expo-notifications') | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoNotifications = require('expo-notifications') as typeof import('expo-notifications')

  // ── Global handler – show alert/sound even while app is foregrounded ──────
  ExpoNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
} catch {
  // Expo Go SDK 53+ – push notifications not supported, degrade silently.
  console.log(
    '[Push] expo-notifications indisponible (Expo Go SDK 53+) — ' +
      'notifications désactivées. Utilisez un development build.'
  )
}

/**
 * Demande la permission push et enregistre le token Expo dans Supabase.
 * Doit être appelé une fois au login / au boot (via AuthContext).
 * Retourne null silencieusement si l'env ne supporte pas les push.
 */
export async function enregistrerPushToken(userId: string): Promise<string | null> {
  try {
    // ── Garde-fous environnement ──────────────────────────────────────────
    if (Platform.OS === 'web') {
      console.log('[Push] Web — push tokens non disponibles (pas de VAPID/Expo)')
      return null
    }

    if (!Device.isDevice) {
      console.log('[Push] Émulateur/simulateur — push tokens non disponibles')
      return null
    }

    if (!ExpoNotifications) {
      console.log('[Push] expo-notifications non chargé (Expo Go) — push ignoré')
      return null
    }

    // ── Permissions ───────────────────────────────────────────────────────
    const { status: existing } = await ExpoNotifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await ExpoNotifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.warn("[Push] Permission refusée par l'utilisateur")
      return null
    }

    // ── Channel Android (doit être créé avant getExpoPushTokenAsync) ──────
    if (Platform.OS === 'android') {
      await ExpoNotifications.setNotificationChannelAsync('reservations', {
        name: 'Réservations',
        importance: ExpoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
      })
    }

    // ── Token Expo Push ───────────────────────────────────────────────────
    console.log('[Push] Récupération du token...')
    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
      projectId: '6c340de6-d45d-4518-9d82-5105ee73dcd5',
    })
    const token = tokenData.data
    console.log('[Push] Token obtenu ✓', token)

    // ── Persistance Supabase ──────────────────────────────────────────────
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Push] Erreur enregistrement token:', msg)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE ARCHITECTURE
// L'envoi des notifications in-app est géré par des triggers DB
// (notification_triggers_migration.sql + notification_annulation_triggers_migration.sql).
// L'envoi push natif passe par l'Edge Function
// supabase/functions/send-push-notification, déclenchée via pg_net.
// ─────────────────────────────────────────────────────────────────────────────
