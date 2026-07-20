import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions, FlatList
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, CATEGORIES, formatDA } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SW } = Dimensions.get('window')

type Voiture = {
  id: string; nom: string; agence: string; agence_id: string
  prix: number; note: number; carburant: string
  boite: string; places: number; km_jour: number
  wilaya: string; statut: string; categorie: string
  image_url: string | null; annee?: number | null
}

/* ─── Skeleton Card ─── */
function SkeletonCard() {
  return (
    <View style={styles.carCard}>
      <View style={[styles.carImgBox, { backgroundColor: COLORS.card2 }]}>
        <ActivityIndicator color={COLORS.text3} />
      </View>
      <View style={styles.carInfo}>
        <View style={{ height: 16, width: '60%', backgroundColor: COLORS.card2, borderRadius: 4, marginBottom: 8 }} />
        <View style={{ height: 12, width: '40%', backgroundColor: COLORS.card2, borderRadius: 4, marginBottom: 12 }} />
        <View style={{ height: 12, width: '80%', backgroundColor: COLORS.card2, borderRadius: 4 }} />
      </View>
    </View>
  )
}

/* ─── Empty State ─── */
function EmptyState({ icon, title, subtitle, action }: {
  icon: string; title: string; subtitle: string; action?: { label: string; onPress: () => void }
}) {
  return (
    <View style={styles.emptyBox}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
      {action && (
        <TouchableOpacity style={styles.emptyBtn} onPress={action.onPress}>
          <Text style={styles.emptyBtnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [voitures, setVoitures] = useState<Voiture[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCat, setActiveCat] = useState('Tous')
  const [search, setSearch] = useState('')
  const [nonLues, setNonLues] = useState(0)
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [favoriIds, setFavoriIds] = useState<Set<string>>(new Set())
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const { data, error } = await supabase
      .from('voitures')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setVoitures(data)
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await fetchVoitures()
    setRefreshing(false)
  }

  async function toggleFavori(voitureId: string) {
    if (!session?.user?.id) {
      router.push('/login')
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
        .delete().eq('user_id', session.user.id).eq('voiture_id', voitureId)
      if (error) {
        setFavoriIds(prev => new Set(prev).add(voitureId))
      }
    } else {
      const { error } = await supabase.from('favoris')
        .insert({ user_id: session.user.id, voiture_id: voitureId })
      if (error) {
        setFavoriIds(prev => { const n = new Set(prev); n.delete(voitureId); return n })
      }
    }
  }

  const voituresFiltrees = useMemo(() => {
    const term = search.trim().toLowerCase()
    return voitures
      .filter(v => activeCat === 'Tous' || v.categorie === activeCat)
      .filter(v =>
        !term ||
        v.nom.toLowerCase().includes(term) ||
        v.wilaya.toLowerCase().includes(term) ||
        v.agence.toLowerCase().includes(term) ||
        v.carburant.toLowerCase().includes(term)
      )
  }, [voitures, activeCat, search])

  const handleSearch = (text: string) => {
    setSearch(text)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      // Analytics ou log ici
    }, 500)
  }

  const renderCarCard = ({ item: v }: { item: Voiture }) => {
    const imgError = imageErrors.has(v.id)
    const dispo = v.statut === 'disponible'

    return (
      <TouchableOpacity
        style={styles.carCard}
        activeOpacity={0.88}
        onPress={() => router.push(`/voiture/${v.id}`)}
      >
        <View style={styles.carImgBox}>
          {v.image_url && !imgError ? (
            <Image
              source={{ uri: v.image_url }}
              style={styles.carImg}
              resizeMode="cover"
              onError={() => setImageErrors(prev => new Set(prev).add(v.id))}
            />
          ) : (
            <View style={[styles.carImg, { backgroundColor: COLORS.card2, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="car-sport" size={48} color={COLORS.text3} />
            </View>
          )}

          <View style={[styles.carBadge, dispo ? styles.badgeDispo : styles.badgeLoue]}>
            <Text style={[styles.carBadgeText, { color: dispo ? COLORS.greenLight : COLORS.redLight }]}>
              {dispo ? 'Disponible' : 'Loué'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => toggleFavori(v.id)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={favoriIds.has(v.id) ? "heart" : "heart-outline"}
              size={20}
              color={favoriIds.has(v.id) ? COLORS.red : COLORS.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.carInfo}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.carName} numberOfLines={1}>{v.nom}</Text>
              <Text style={styles.carAgency}>🏢 {v.agence} · {v.wilaya}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.carPrice}>{formatDA(v.prix)}</Text>
              <Text style={styles.carPriceSub}>/ jour</Text>
            </View>
          </View>

          <View style={styles.carMeta}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>⛽ {v.carburant}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>⚙️ {v.boite ?? 'Manuelle'}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>👥 {v.places ?? 5}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>🛣️ {v.km_jour ?? 300}km</Text>
            </View>
          </View>

          <View style={styles.carFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={14} color={COLORS.gold} />
              <Text style={styles.carRating}>{v.note ?? 5.0}</Text>
              <Text style={styles.carRatingSub}>({Math.floor(Math.random() * 50 + 10)})</Text>
            </View>
            {v.annee && (
              <Text style={styles.carYear}>{v.annee}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Bonjour 👋</Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {nomUtilisateur || 'Voyageur'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          {nonLues > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{nonLues > 9 ? '9+' : nonLues}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.text3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Chercher par voiture, ville, agence..."
          placeholderTextColor={COLORS.text3}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={20} color={COLORS.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <View style={{ marginBottom: 16 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.cat, activeCat === cat && styles.catActive]}
              onPress={() => setActiveCat(cat)}
            >
              <Text style={[styles.catText, activeCat === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {activeCat === 'Tous' ? 'Disponibles près de vous' : activeCat}
        </Text>
        <Text style={styles.sectionCount}>
          {voituresFiltrees.length} voiture{voituresFiltrees.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : voituresFiltrees.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Aucun résultat"
          subtitle={search ? `Aucune voiture ne correspond à "${search}"` : "Aucune voiture disponible pour le moment"}
          action={{ label: 'Réinitialiser les filtres', onPress: () => { setSearch(''); setActiveCat('Tous') } }}
        />
      ) : (
        <FlatList
          data={voituresFiltrees}
          keyExtractor={item => item.id}
          renderItem={renderCarCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} colors={[COLORS.blue]} />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={10}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerSub: { fontSize: 13, color: COLORS.text2, fontWeight: '500' },
  headerName: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  notifBtn: { width: 44, height: 44, backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 0.5, borderColor: COLORS.border3, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: COLORS.red, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 14, height: 48, gap: 10 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sectionCount: { fontSize: 13, fontWeight: '500', color: COLORS.text2 },
  cat: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border3, backgroundColor: COLORS.card },
  catActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  catText: { fontSize: 13, fontWeight: '500', color: COLORS.text2 },
  catTextActive: { color: '#fff', fontWeight: '600' },
  carCard: { marginBottom: 14, backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: COLORS.border3 },
  carImgBox: { height: 180, backgroundColor: COLORS.card2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  carImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  carBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDispo: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)' },
  badgeLoue: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
  carBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heartBtn: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, backgroundColor: 'rgba(10,22,40,0.6)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border3 },
  carInfo: { padding: 14 },
  carName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  carAgency: { fontSize: 12, color: COLORS.text2, marginBottom: 10 },
  carMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaChip: { backgroundColor: COLORS.navyLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: COLORS.border },
  metaChipText: { fontSize: 11, color: COLORS.text2, fontWeight: '500' },
  carFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carPrice: { fontSize: 16, fontWeight: '800', color: COLORS.gold },
  carPriceSub: { fontSize: 11, fontWeight: '400', color: COLORS.text2 },
  carRating: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  carRatingSub: { fontSize: 11, color: COLORS.text2 },
  carYear: { fontSize: 12, color: COLORS.text3, fontWeight: '500' },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.text2, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
})
