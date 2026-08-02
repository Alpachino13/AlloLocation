import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import { COLORS } from '../constants'

// Icon size token — consistent across every tab
const TAB_ICON_SIZE = 24

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({
  name,
  nameActive,
  color,
  focused,
}: {
  name: IoniconsName
  nameActive: IoniconsName
  color: string
  focused: boolean
}) {
  return (
    <Ionicons
      name={focused ? nameActive : name}
      size={TAB_ICON_SIZE}
      color={color}
    />
  )
}

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
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.navy,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* Explorer — visible to everyone */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="compass-outline"
              nameActive="compass"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Dashboard — agence / admin only */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isAgence ? '/dashboard' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="bar-chart-outline"
              nameActive="bar-chart"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Favoris — client only */}
      <Tabs.Screen
        name="favoris"
        options={{
          title: 'Favoris',
          href: !isAgence ? '/favoris' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="heart-outline"
              nameActive="heart"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Réservations — client only */}
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Réservations',
          href: !isAgence ? '/reservations' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="calendar-outline"
              nameActive="calendar"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Profil — visible to everyone */}
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-outline"
              nameActive="person"
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* Hidden routes */}
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