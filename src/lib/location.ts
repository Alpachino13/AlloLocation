import * as Location from 'expo-location'
import { Alert, Linking, Platform } from 'react-native'

export interface Coords {
  latitude: number
  longitude: number
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert(
      'Permission refusée',
      'Activez la localisation dans les paramètres pour utiliser cette fonction.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Paramètres', onPress: () => Linking.openSettings() }
      ]
    )
    return false
  }
  return true
}

export async function getCurrentPosition(): Promise<Coords | null> {
  const hasPermission = await requestLocationPermission()
  if (!hasPermission) return null

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }
  } catch (e) {
    Alert.alert('Erreur', "Impossible d'obtenir votre position.")
    return null
  }
}

export function openMapsDirections(lat: number, lng: number, label?: string) {
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lng}&q=${encodeURIComponent(label || 'Destination')}`,
    android: `google.navigation:q=${lat},${lng}`,
  })
  if (url) Linking.openURL(url)
}

export function openMapsMarker(lat: number, lng: number, label?: string) {
  const url = Platform.select({
    ios: `maps://?q=${encodeURIComponent(label || 'Destination')}&ll=${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label || 'Destination')})`,
  })
  if (url) Linking.openURL(url)
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
