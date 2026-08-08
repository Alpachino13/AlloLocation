import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Dimensions, FlatList, Image,
  RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, CATEGORY_ICONS, CATEGORIES_LIST, formatDA } from '../constants'

const { width: SW } = Dimensions.get('window')

type Voiture = {
  id: string; nom: string; agence: string; agence_id: string
  prix: number; note: number; carburant: string
  boite: string; places: number; km_jour: number
  wilaya: string; statut: string; categorie: string
  image_url: string | null; annee?: number | null
}

// ─── Skeleton ────────────────────────────────────────────────
function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      <View style={[styles.cardImgBox, { backgroundColor: COLORS.card2 }]} />
      <View style={styles.cardBody}>
        <View style={{ height: 16, width: '55%', backgroundColor: COLORS.card2, borderRadius: 6, marginBottom: 8 }} />
        <View style={{ height: 12, width: '35%', backgroundColor: COLORS.card2, borderRadius: 6, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[60, 80, 50].map((w, i) => (
            <View key={i} style={{ height: 26, width: w, backgroundColor: COLORS.card2, borderRadius: 6 }} />
          ))}
        </View>
      </View>
    </Animated.View>
  )
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ title, subtitle, onReset }: {
  title: string; subtitle: string; onReset?: () => void
}) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="car-sport-outline" size={32} color={COLORS.text3} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
      {onReset && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onReset} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Réinitialiser</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Category Pill ────────────────────────────────────────────
function CategoryPill({ label, active, onPress }: {
  label: string; active: boolean; onPress: () => void
}) {
  const iconName = CATEGORY_ICONS[label] ?? 'car-outline'
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons
        name={iconName as any}
        size={13}
        color={active ? '#fff' : COLORS.text3}
        style={{ marginRight: 4 }}
      />
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─── Car Card ─────────────────────────────────────────────────
function CarCard({
  item: v, isFav, onToggleFav, onPress,
}: {
  item: Voiture; isFav: boolean; onToggleFav: () => void; onPress: () => void
}) {
  const [imgErr, setImgErr] = useState(false)
  const dispo = v.statut === 'disponible'

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={onPress}>
      {/* Image */}
      <View style={styles.cardImgBox}>
        {v.image_url && !imgErr ? (
          <Image
            source={{ uri: v.image_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cardImgPlaceholder]}>
            <Ionicons name="car-sport" size={40} color={COLORS.text3} />
          </View>
        )}

        {/* Overlay gradient hint at bottom */}
        <View style={styles.cardImgGradient} />

        {/* Status badge */}
        <View style={[styles.badge, dispo ? styles.badgeGreen : styles.badgeRed]}>
          <View style={[styles.badgeDot, { backgroundColor: dispo ? COLORS.greenLight : COLORS.redLight }]} />
          <Text style={[styles.badgeText, { color: dispo ? COLORS.greenLight : COLORS.redLight }]}>
            {dispo ? 'Disponible' : 'Loué'}
          </Text>
        </View>

        {/* Fav button */}
        <TouchableOpacity
          style={styles.favBtn}
          onPress={onToggleFav}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={18}
            color={isFav ? '#F87171' : '#fff'}
          />
        </TouchableOpacity>

        {/* Year tag */}
        {v.annee && (
          <View style={styles.yearTag}>
            <Text style={styles.yearTagText}>{v.annee}</Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.carName} numberOfLines={1}>{v.nom}</Text>
            <View style={styles.agencyRow}>
              <Ionicons name="location-outline" size={11} color={COLORS.text3} />
              <Text style={styles.agencyText} numberOfLines={1}>
                {v.agence}  ·  {v.wilaya}
              </Text>
            </View>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.priceText}>{formatDA(v.prix)}</Text>
            <Text style={styles.priceLabel}>/jour</Text>
          </View>
        </View>

        {/* Specs chips */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Ionicons name="flash-outline" size={11} color={COLORS.text3} />
            <Text style={styles.chipText}>{v.carburant}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="settings-outline" size={11} color={COLORS.text3} />
            <Text style={styles.chipText}>{v.boite ?? 'Manuel'}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="people-outline" size={11} color={COLORS.text3} />
            <Text style={styles.chipText}>{v.places ?? 5} pl.</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="speedometer-outline" size={11} color={COLORS.text3} />
            <Text style={styles.chipText}>{v.km_jour ?? 300} km</Text>
          </View>
        </View>

        {/* Footer: rating */}
        <View style={styles.cardFooter}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color={COLORS.gold} />
            <Text style={styles.ratingText}>{(v.note ?? 5.0).toFixed(1)}</Text>
          </View>
          <Text style={styles.catTag}>{v.categorie}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [voitures, setVoitures] = useState<Voiture[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCat, setActiveCat] = useState<string>('Tous')
  const [search, setSearch] = useState('')
  const [nonLues, setNonLues] = useState(0)
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [favoriIds, setFavoriIds] = useState<Set<string>>(new Set())
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchNonLues = useCallback(async () => {
    if (!session?.user?.id) return
    const { count } = await supabase.from('notifications').select('id', { count: 'exact' })
      .eq('user_id', session.user.id).eq('lu', false)
    setNonLues(count ?? 0)
  }, [session?.user?.id])

  useFocusEffect(useCallback(() => {
    fetchVoitures()
    fetchNonLues()
  }, [fetchNonLues]))

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('profils').select('nom').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.nom) setNomUtilisateur(data.nom) })
    supabase.from('favoris').select('voiture_id').eq('user_id', session.user.id)
      .then(({ data }) => { if (data) setFavoriIds(new Set(data.map((f: any) => f.voiture_id))) })
    fetchNonLues()

    const ch = supabase.channel('notifs-home')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        () => setNonLues(p => p + 1))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user?.id])

  async function fetchVoitures() {
    setLoading(true)
    const { data } = await supabase.from('voitures').select('*').order('created_at', { ascending: false })
    if (data) setVoitures(data)
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await fetchVoitures(); setRefreshing(false) }

  async function toggleFavori(id: string) {
    if (!session?.user?.id) { router.push('/login'); return }
    const had = favoriIds.has(id)
    setFavoriIds(prev => { const n = new Set(prev); had ? n.delete(id) : n.add(id); return n })
    if (had) {
      const { error } = await supabase.from('favoris').delete().eq('user_id', session.user.id).eq('voiture_id', id)
      if (error) setFavoriIds(prev => new Set(prev).add(id))
    } else {
      const { error } = await supabase.from('favoris').insert({ user_id: session.user.id, voiture_id: id })
      if (error) setFavoriIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return voitures
      .filter(v => activeCat === 'Tous' || v.categorie === activeCat)
      .filter(v => !term || v.nom.toLowerCase().includes(term) || v.wilaya.toLowerCase().includes(term) || v.agence.toLowerCase().includes(term))
  }, [voitures, activeCat, search])

  const greetHour = new Date().getHours()
  const greeting = greetHour < 12 ? 'Bonjour' : greetHour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting} 👋</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {nomUtilisateur || 'Voyageur'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
          {nonLues > 0 && (
            <View style={styles.notifDot}>
              <Text style={styles.notifDotText}>{nonLues > 9 ? '9+' : nonLues}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Voiture, ville, agence..."
            placeholderTextColor={COLORS.text3}
            value={search}
            onChangeText={t => {
              setSearch(t)
              if (searchDebounce.current) clearTimeout(searchDebounce.current)
              searchDebounce.current = setTimeout(() => {}, 400)
            }}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.text3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Categories ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catsContainer}
        style={styles.catsScroll}
      >
        {CATEGORIES_LIST.map(cat => (
          <CategoryPill
            key={cat}
            label={cat}
            active={activeCat === cat}
            onPress={() => setActiveCat(cat)}
          />
        ))}
      </ScrollView>

      {/* ── Section header ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {activeCat === 'Tous' ? 'Toutes les voitures' : activeCat}
        </Text>
        <Text style={styles.sectionCount}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</Text>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </ScrollView>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          subtitle={search ? `Rien pour "${search}"` : 'Aucune voiture disponible'}
          onReset={() => { setSearch(''); setActiveCat('Tous') }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CarCard
              item={item}
              isFav={favoriIds.has(item.id)}
              onToggleFav={() => toggleFavori(item.id)}
              onPress={() => router.push(`/voiture/${item.id}`)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
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
  container:    { flex: 1, backgroundColor: COLORS.navyLight },
  
  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  greeting:     { fontSize: 13, color: COLORS.text2, fontWeight: '500' },
  userName:     { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 2, letterSpacing: -0.3 },
  notifBtn:     { width: 44, height: 44, backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2, justifyContent: 'center', alignItems: 'center' },
  notifDot:     { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.navyLight },
  notifDotText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Search
  searchWrap:   { paddingHorizontal: 20, marginBottom: 14 },
  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 14, paddingHorizontal: 14, height: 48, gap: 10 },
  searchInput:  { flex: 1, color: COLORS.text, fontSize: 15 },

  // Categories
  catsScroll:     { flexGrow: 0, marginBottom: 14 },
  catsContainer:  { paddingHorizontal: 20, gap: 8 },
  pill:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border2 },
  pillActive:     { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  pillText:       { fontSize: 12, fontWeight: '500', color: COLORS.text3 },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  // Section header
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectionCount: { fontSize: 12, color: COLORS.text3, fontWeight: '500' },

  // Card
  card:         { marginBottom: 14, backgroundColor: COLORS.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border2 },
  cardImgBox:   { height: 190, backgroundColor: COLORS.card2, position: 'relative', overflow: 'hidden' },
  cardImgPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.card2 },
  cardImgGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'transparent' },

  badge:        { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(8,15,30,0.7)', borderWidth: 1 },
  badgeGreen:   { borderColor: 'rgba(52,211,153,0.3)' },
  badgeRed:     { borderColor: 'rgba(239,68,68,0.3)' },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  badgeText:    { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },

  favBtn:       { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(8,15,30,0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  yearTag:      { position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(8,15,30,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  yearTagText:  { color: COLORS.text2, fontSize: 11, fontWeight: '600' },

  cardBody:     { padding: 14 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  carName:      { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  agencyRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  agencyText:   { fontSize: 12, color: COLORS.text3, flex: 1 },
  priceBlock:   { alignItems: 'flex-end' },
  priceText:    { fontSize: 15, fontWeight: '800', color: COLORS.gold },
  priceLabel:   { fontSize: 11, color: COLORS.text3, fontWeight: '400' },

  chipsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.card2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  chipText:     { fontSize: 11, color: COLORS.text2, fontWeight: '500' },

  cardFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText:   { fontSize: 13, fontWeight: '600', color: COLORS.text },
  catTag:       { fontSize: 11, color: COLORS.text3, fontWeight: '500', backgroundColor: COLORS.card2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  // Empty
  emptyBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 60 },
  emptyIconWrap:{ width: 72, height: 72, backgroundColor: COLORS.card, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border2, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: COLORS.text2, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn:     { backgroundColor: COLORS.blue, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
