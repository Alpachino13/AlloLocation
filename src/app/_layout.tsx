import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import { COLORS } from '../constants'

const TAB_ICON_SIZE = 22

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({
  name, nameActive, color, focused,
}: {
  name: IoniconsName; nameActive: IoniconsName; color: string; focused: boolean
}) {
  return (
    <Ionicons name={focused ? nameActive : name} size={TAB_ICON_SIZE} color={color} />
  )
}

function Navigation() {
  const { session, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) router.replace('/login')
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
          backgroundColor: '#0A1525',
          borderTopWidth: 1,
          borderTopColor: COLORS.border2,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 84 : 64,
          elevation: 0,
        },
        tabBarActiveTintColor: COLORS.blueLight,
        tabBarInactiveTintColor: COLORS.text3,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="compass-outline" nameActive="compass" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isAgence ? '/dashboard' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bar-chart-outline" nameActive="bar-chart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          title: 'Favoris',
          href: !isAgence ? '/favoris' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="heart-outline" nameActive="heart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Réservations',
          href: !isAgence ? '/reservations' : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar-outline" nameActive="calendar" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-circle-outline" nameActive="person-circle" color={color} focused={focused} />
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
