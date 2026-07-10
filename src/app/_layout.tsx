import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { AuthProvider, useAuth } from '../lib/AuthContext'

function Navigation() {
  const { session, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) router.replace('/login' as any)
  }, [session, loading])

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0A1628', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  )

  const isAgence = role === 'agence' || role === 'admin'

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: 'rgba(19,31,53,0.97)',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.12)',
        paddingBottom: 24,
        paddingTop: 12,
        height: 80,
      },
      tabBarActiveTintColor: '#2563EB',
      tabBarInactiveTintColor: '#475569',
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Explorer',
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
      }} />
      <Tabs.Screen name="dashboard" options={{
        title: 'Dashboard',
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
        href: isAgence ? '/dashboard' : null,
      }} />
      <Tabs.Screen name="favoris" options={{
        title: 'Favoris',
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🤍</Text>,
        href: !isAgence ? '/favoris' : null,
      }} />
      <Tabs.Screen name="profil" options={{
        title: 'Profil',
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
      }} />

      {/* Hidden routes */}
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="voiture/[id]" options={{ href: null }} />
      <Tabs.Screen name="ajouter-voiture" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="reservations" options={{ href: null }} />
      <Tabs.Screen name="reservation" options={{ href: null }} />
    </Tabs>
  )
}

export default function Layout() {
  return <AuthProvider><Navigation /></AuthProvider>
}
