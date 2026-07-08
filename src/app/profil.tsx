import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const BLUE_L = '#3B7FF5'; const GOLD = '#F59E0B'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

export default function Profil() {
  const { session, role, signOut } = useAuth()
  const email = session?.user?.email ?? session?.user?.phone ?? 'Utilisateur'
  const roleLabel = role === 'agence' ? '🏢 Agence vérifiée' : role === 'admin' ? '⚡ Admin' : '✅ Client vérifié'
  const initiale = email[0]?.toUpperCase() ?? 'M'

  const [nom, setNom] = useState<string>('')
  const [nbReservations, setNbReservations] = useState<number>(0)
  const [nbFavoris, setNbFavoris] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.id) fetchProfilData()
  }, [session?.user?.id])

  async function fetchProfilData() {
    const userId = session!.user.id

    // Nom réel depuis la table profils
    const { data: profilData } = await supabase
      .from('profils')
      .select('nom')
      .eq('id', userId)
      .single()

    if (profilData?.nom) setNom(profilData.nom)

    // Nombre réel de réservations du user connecté
    const { count: resCount } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    setNbReservations(resCount ?? 0)

    // Nombre réel de favoris du user connecté
    const { count: favCount } = await supabase
      .from('favoris')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    setNbFavoris(favCount ?? 0)
    setLoading(false)
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      <Text style={s.pageTitle}>Mon profil</Text>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.profileBanner} />
        <View style={s.profileBody}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initiale}</Text>
          </View>
          <View style={{ paddingTop: 38 }}>
            {loading ? (
              <ActivityIndicator size="small" color={BLUE} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
            ) : (
              <Text style={s.profileName}>{nom || 'Utilisateur'}</Text>
            )}
            <Text style={s.profileEmail}>{email}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: BLUE }]}>{loading ? '—' : nbReservations}</Text>
          <Text style={s.statLabel}>Réservations</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: GOLD }]}>{loading ? '—' : nbFavoris}</Text>
          <Text style={s.statLabel}>Favoris</Text>
        </View>
      </View>

      {/* Menu */}
      {[
        { icon: '🪪', label: 'Mes documents' },
        { icon: '🔔', label: 'Notifications' },
        { icon: '❓', label: 'Aide & support' },
        { icon: '⚙️', label: 'Paramètres' },
      ].map((item, i) => (
        <TouchableOpacity key={item.label} style={[s.menuItem, i === 0 && { borderTopWidth: 0 }]}>
          <View style={s.menuIcon}>
            <Text style={{ fontSize: 18 }}>{item.icon}</Text>
          </View>
          <Text style={s.menuLabel}>{item.label}</Text>
          <Text style={{ color: TEXT3, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[s.menuItem, { marginTop: 10 }]} onPress={signOut}>
        <View style={[s.menuIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
          <Text style={{ fontSize: 18 }}>🚪</Text>
        </View>
        <Text style={[s.menuLabel, { color: '#FCA5A5' }]}>Se déconnecter</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  pageTitle: { fontSize: 24, fontWeight: '800', color: TEXT, paddingHorizontal: 20, paddingBottom: 16 },
  profileCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: CARD, borderRadius: 20, borderWidth: 0.5, borderColor: BORDER2, overflow: 'hidden' },
  profileBanner: { height: 70, backgroundColor: '#1a3a6e' },
  profileBody: { padding: 20, paddingTop: 0, position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: BLUE, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: NAVY, position: 'absolute', top: -32, left: 20 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 20, fontWeight: '800', color: TEXT },
  profileEmail: { fontSize: 13, color: TEXT2, marginVertical: 4 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: BLUE_L },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: TEXT2, marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 0.5, borderTopColor: BORDER },
  menuIcon: { width: 36, height: 36, backgroundColor: CARD, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '500', color: TEXT, flex: 1 },
})
