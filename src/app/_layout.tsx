import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import { COLORS } from '../constants'

function Navigation() {
  const { session, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [session, loading, router])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.navy, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    )
  }

  const isAgence = role === 'agence' || role === 'admin'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(19,31,53,0.97)',
          borderTopWidth: 0.5,
          borderTopColor: COLORS.border3,
          paddingBottom: 24,
          paddingTop: 12,
          height: 80,
        },
        tabBarActiveTintColor: COLORS.blue,
        tabBarInactiveTintColor: COLORS.text3,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size * 0.9 : 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size * 0.9 : 20, color }}>📊</Text>
          ),
          href: isAgence ? '/dashboard' : null,
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          title: 'Favoris',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size * 0.9 : 20, color }}>🤍</Text>
          ),
          href: !isAgence ? '/favoris' : null,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Réservations',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size * 0.9 : 20, color }}>📋</Text>
          ),
          href: !isAgence ? '/reservations' : null,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ? size * 0.9 : 20, color }}>👤</Text>
          ),
        }}
      />

      {/* Routes cachées */}
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="voiture/[id]" options={{ href: null }} />
      <Tabs.Screen name="ajouter-voiture" options={{ href: null }} />
      <Tabs.Screen name="modifier-voiture/[id]" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="reservation" options={{ href: null }} />
    </Tabs>
  )
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
