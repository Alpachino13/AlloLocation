import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Ionicons } from '@expo/vector-icons' // ✨ Ajout des icônes vectorielles

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const BLUE_L = '#3B7FF5'; const GOLD = '#F59E0B'
const RED = '#EF4444'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER2 = 'rgba(255,255,255,0.12)'

type Voiture = {
  id: string; nom: string; agence: string
  prix: number; note: number; carburant: string
  boite: string; places: number; km_jour: number
  wilaya: string; statut: string; categorie: string
  image_url: string | null
}

const CATS = ['Tous', 'Économique', 'SUV / 4x4', 'Luxe', 'Camion']

export default function HomeScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [voitures, setVoitures] = useState<Voiture[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCat, setActiveCat] = useState('Tous')
  const [search, setSearch] = useState('')
  const [nonLues, setNonLues] = useState(0)
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [favoriIds, setFavoriIds] = useState<Set<string>>(new Set())

  // ✅ Recharge les voitures à chaque fois que l'écran devient actif
  useFocusEffect(
    useCallback(() => {
      fetchVoitures()
    }, [])
  )

  useEffect(() => {
    if (!session?.user?.id) return

    supabase.from('profils').select('nom').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.nom) setNomUtilisateur(data.nom) })

    supabase.from('favoris').select('voiture_id').eq('user_id', session.user.id)
      .then(({ data }) => { if (data) setFavoriIds(new Set(data.map((f: any) => f.voiture_id))) })

    supabase.from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', session.user.id)
      .eq('lu', false)
      .then(({ count }) => setNonLues(count ?? 0))

    const channel = supabase.channel('notifs-home')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`
      }, () => setNonLues(prev => prev + 1))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

  async function fetchVoitures() {
    setLoading(true)
    const { data } = await supabase
      .from('voitures')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setVoitures(data)
    setLoading(false)
  }

  // ✅ Pull-to-refresh
  async function onRefresh() {
    setRefreshing(true)
    await fetchVoitures()
    setRefreshing(false)
  }

  async function toggleFavori(voitureId: string) {
    if (!session?.user?.id) {
      router.push('/login' as any)
      return
    }
    const dejaFavori = favoriIds.has(voitureId)

    setFavoriIds(prev => {
      const next = new Set(prev)
      dejaFavori ? next.delete(voitureId) : next.add(voitureId)
      return next
    })

    if (dejaFavori) {
      const { error } = await supabase.from('favoris')
        .delete()
        .eq('user_id', session.user.id)
        .eq('voiture_id', voitureId)
      if (error) setFavoriIds(prev => new Set(prev).add(voitureId))
    } else {
      const { error } = await supabase.from('favoris')
        .insert({ user_id: session.user.id, voiture_id: voitureId })
      if (error) setFavoriIds(prev => { const next = new Set(prev); next.delete(voitureId); return next })
    }
  }

  const voituresFiltrees = voitures
    .filter(v => activeCat === 'Tous' || v.categorie === activeCat)
    .filter(v =>
      search === '' ||
      v.nom.toLowerCase().includes(search.toLowerCase()) ||
      v.wilaya.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BLUE}
          colors={[BLUE]}
        />
      }
    >
      {/* ✨ Header (Fausse barre de statut supprimée) */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>Bonjour 👋</Text>
          <Text style={s.headerName}>{nomUtilisateur || 'Voyageur'}</Text>
        </View>
        <TouchableOpacity
          style={s.notifBtn}
          onPress={() => router.push('/notifications' as any)}
        >
          <Ionicons name="notifications-outline" size={22} color={TEXT} />
          {nonLues > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{nonLues > 9 ? '9+' : nonLues}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ✨ Search */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={20} color={TEXT3} />
        <TextInput
          style={s.searchInput}
          placeholder="Chercher une voiture ou une ville..."
          placeholderTextColor={TEXT3}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="words"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="close-circle" size={20} color={TEXT3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catsRow}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {CATS.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.cat, activeCat === cat && s.catActive]}
            onPress={() => setActiveCat(cat)}
          >
            <Text style={[s.catText, activeCat === cat && s.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Section header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>
          {activeCat === 'Tous' ? 'Disponibles près de toi' : activeCat}
        </Text>
        <Text style={s.sectionCount}>
          {voituresFiltrees.length} voiture{voituresFiltrees.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Car list */}
      {loading ? (
        <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} />
      ) : voituresFiltrees.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="search-outline" size={48} color={TEXT3} style={{ marginBottom: 12 }} />
          <Text style={{ color: TEXT2, fontSize: 14, textAlign: 'center' }}>
            Aucune voiture ne correspond à cette recherche.
          </Text>
        </View>
      ) : (
        voituresFiltrees.map(v => (
          <TouchableOpacity
            key={v.id}
            style={s.carCard}
            activeOpacity={0.9}
            onPress={() => router.push(`/voiture/${v.id}` as any)}
          >
            <View style={s.carImgBox}>
              {v.image_url ? (
                <Image
                  source={{ uri: v.image_url }}
                  style={s.carImg}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="car-sport" size={64} color={TEXT3} />
              )}
              {/* Statut badge */}
              <View style={[s.carBadge, v.statut === 'loue' ? s.badgeLoue : s.badgeDispo]}>
                <Text style={[s.carBadgeText, { color: v.statut === 'loue' ? '#FCA5A5' : '#34D399' }]}>
                  {v.statut === 'loue' ? 'Loué' : 'Disponible'}
                </Text>
              </View>
              {/* ✨ Favori (Cible agrandie et icône vectorielle) */}
              <TouchableOpacity
                style={s.heartBtn}
                onPress={() => toggleFavori(v.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons 
                  name={favoriIds.has(v.id) ? "heart" : "heart-outline"} 
                  size={20} 
                  color={favoriIds.has(v.id) ? RED : TEXT} 
                />
              </TouchableOpacity>
            </View>

            <View style={s.carInfo}>
              <Text style={s.carName}>{v.nom}</Text>
              <Text style={s.carAgency}>🏢 {v.agence}</Text>
              <View style={s.carMeta}>
                <Text style={s.metaChip}>⛽ {v.carburant}</Text>
                <Text style={s.metaChip}>⚙️ {v.boite ?? 'Manuelle'}</Text>
                <Text style={s.metaChip}>👥 {v.places ?? 5} places</Text>
                <Text style={s.metaChip}>🛣️ {v.km_jour ?? 300} km/j</Text>
              </View>
              <View style={s.carFooter}>
                <Text style={s.carPrice}>
                  {v.prix.toLocaleString()} DA{' '}
                  <Text style={s.carPriceSub}>/ jour</Text>
                </Text>
                <Text style={s.carRating}>
                  ⭐ {v.note}{' '}
                  <Text style={s.carRatingSub}>(42)</Text>
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 55, paddingBottom: 16 },
  headerSub: { fontSize: 13, color: TEXT2, fontWeight: '500' },
  headerName: { fontSize: 20, fontWeight: '800', color: TEXT, marginTop: 2 },
  notifBtn: { width: 44, height: 44, backgroundColor: CARD, borderRadius: 22, borderWidth: 0.5, borderColor: BORDER2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: RED, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 14, height: 48, gap: 10 },
  searchInput: { flex: 1, color: TEXT, fontSize: 15 },
  catsRow: { marginBottom: 20 },
  cat: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: BORDER2 },
  catActive: { backgroundColor: BLUE, borderColor: BLUE },
  catText: { fontSize: 13, fontWeight: '500', color: TEXT2 },
  catTextActive: { color: '#fff', fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  sectionCount: { fontSize: 13, fontWeight: '500', color: TEXT2 },
  emptyBox: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 30 },
  carCard: { marginHorizontal: 20, marginBottom: 14, backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: BORDER2 },
  carImgBox: { height: 160, backgroundColor: CARD2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  carImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  carBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDispo: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)' },
  badgeLoue: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
  carBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heartBtn: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, backgroundColor: 'rgba(10,22,40,0.6)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
  carInfo: { padding: 14 },
  carName: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 4 },
  carAgency: { fontSize: 13, color: TEXT2, marginBottom: 10 },
  carMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaChip: { fontSize: 12, color: TEXT2 },
  carFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carPrice: { fontSize: 18, fontWeight: '800', color: GOLD },
  carPriceSub: { fontSize: 12, fontWeight: '400', color: TEXT2 },
  carRating: { fontSize: 13, fontWeight: '600', color: TEXT },
  carRatingSub: { fontSize: 11, color: TEXT2 },
})