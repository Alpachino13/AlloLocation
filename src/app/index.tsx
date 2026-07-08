import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

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
  const [activeCat, setActiveCat] = useState('Tous')
  const [search, setSearch] = useState('')
  const [nonLues, setNonLues] = useState(0)
  const [nomUtilisateur, setNomUtilisateur] = useState('')
  const [favoriIds, setFavoriIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchVoitures() }, [])

  useEffect(() => {
    if (!session?.user?.id) return

    // Nom réel de l'utilisateur connecté
    supabase.from('profils').select('nom').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.nom) setNomUtilisateur(data.nom) })

    // Favoris déjà enregistrés par l'utilisateur (pour l'état du cœur)
    supabase.from('favoris').select('voiture_id').eq('user_id', session.user.id)
      .then(({ data }) => { if (data) setFavoriIds(new Set(data.map((f: any) => f.voiture_id))) })

    // Compter notifs non lues
    supabase.from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', session.user.id)
      .eq('lu', false)
      .then(({ count }) => setNonLues(count ?? 0))

    // Écouter en temps réel
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
    const { data } = await supabase.from('voitures').select('*').order('created_at', { ascending: false })
    if (data) setVoitures(data)
    setLoading(false)
  }

  async function toggleFavori(voitureId: string) {
    if (!session?.user?.id) {
      router.push('/login' as any)
      return
    }
    const dejaFavori = favoriIds.has(voitureId)

    // Mise à jour optimiste de l'UI
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
      if (error) setFavoriIds(prev => new Set(prev).add(voitureId)) // rollback
    } else {
      const { error } = await supabase.from('favoris')
        .insert({ user_id: session.user.id, voiture_id: voitureId })
      if (error) setFavoriIds(prev => { const next = new Set(prev); next.delete(voitureId); return next }) // rollback
    }
  }

  const getEmoji = (nom: string) => {
    if (nom.includes('Hilux') || nom.includes('4x4')) return '🛻'
    if (nom.includes('Tucson') || nom.includes('SUV')) return '🚘'
    return '🚗'
  }

  const voituresFiltrees = voitures
    .filter(v => activeCat === 'Tous' || v.categorie === activeCat)
    .filter(v => search === '' || v.nom.toLowerCase().includes(search.toLowerCase()) || v.wilaya.toLowerCase().includes(search.toLowerCase()))

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Status bar */}
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>Bonjour 👋</Text>
          <Text style={s.headerName}>{nomUtilisateur || 'Voyageur'}</Text>
        </View>
        <TouchableOpacity
          style={s.notifBtn}
          onPress={() => router.push('/notifications' as any)}
        >
          <Text style={{ fontSize: 18, color: TEXT2 }}>🔔</Text>
          {nonLues > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{nonLues > 9 ? '9+' : nonLues}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Text style={{ fontSize: 16, color: TEXT3 }}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Chercher une voiture ou une ville..."
          placeholderTextColor={TEXT3}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Hero Banner */}
      <View style={s.heroBanner}>
        <View style={s.heroGlow} />
        <View style={s.heroTag}>
          <Text style={s.heroTagText}>⚡ Offre spéciale</Text>
        </View>
        <Text style={s.heroTitle}>Location dès{'\n'}<Text style={{ color: GOLD }}>2 500 DA/jour</Text></Text>
        <Text style={s.heroSub}>Toute l'Algérie, livraison incluse</Text>
        <Text style={s.heroEmoji}>🚗</Text>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catsRow}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
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
        <Text style={s.sectionTitle}>Disponibles près de toi</Text>
        <Text style={s.sectionLink}>Voir tout</Text>
      </View>

      {/* Car list */}
      {loading ? (
        <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} />
      ) : voituresFiltrees.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 30 }}>
          <Text style={{ color: TEXT2, fontSize: 14, textAlign: 'center' }}>Aucune voiture ne correspond à cette recherche.</Text>
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
                  <Image source={{ uri: v.image_url }} style={s.carImg} resizeMode="cover" />
                ) : (
                  <Text style={s.carEmoji}>🚗</Text>
                )}
                <View style={[s.carBadge, v.statut === 'loue' ? s.badgeLoue : s.badgeDispo]}>
                  <Text style={[s.carBadgeText, { color: v.statut === 'loue' ? '#FCA5A5' : '#34D399' }]}>
                    {v.statut === 'loue' ? 'Loué' : 'Disponible'}
                  </Text>
                </View>
                <TouchableOpacity style={s.heartBtn} onPress={() => toggleFavori(v.id)}>
                  <Text style={{ fontSize: 15 }}>{favoriIds.has(v.id) ? '❤️' : '🤍'}</Text>
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
                  <Text style={s.carPrice}>{v.prix.toLocaleString()} DA <Text style={s.carPriceSub}>/ jour</Text></Text>
                  <Text style={s.carRating}>⭐ {v.note} <Text style={s.carRatingSub}>(42)</Text></Text>
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
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  headerSub: { fontSize: 13, color: TEXT2, fontWeight: '500' },
  headerName: { fontSize: 20, fontWeight: '800', color: TEXT, marginTop: 2 },
  notifBtn: { width: 40, height: 40, backgroundColor: CARD, borderRadius: 20, borderWidth: 0.5, borderColor: BORDER2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: RED, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 14, height: 46, gap: 10 },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },
  heroBanner: { marginHorizontal: 20, marginBottom: 20, backgroundColor: CARD, borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: BORDER2, minHeight: 130, overflow: 'hidden', position: 'relative' },
  heroGlow: { position: 'absolute', right: -20, top: -20, width: 150, height: 150, backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 75 },
  heroTag: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
  heroTagText: { fontSize: 11, fontWeight: '600', color: BLUE_L },
  heroTitle: { fontSize: 22, fontWeight: '800', color: TEXT, lineHeight: 28, marginBottom: 6 },
  heroSub: { fontSize: 13, color: TEXT2 },
  heroEmoji: { position: 'absolute', right: 20, top: 20, fontSize: 60 },
  catsRow: { marginBottom: 20 },
  cat: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: BORDER2 },
  catActive: { backgroundColor: BLUE, borderColor: BLUE },
  catText: { fontSize: 13, fontWeight: '500', color: TEXT2 },
  catTextActive: { color: '#fff', fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  sectionLink: { fontSize: 13, fontWeight: '500', color: BLUE_L },
  carCard: { marginHorizontal: 20, marginBottom: 14, backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: BORDER2 },
  carImgBox: { height: 160, backgroundColor: CARD2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  carImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  carEmoji: { fontSize: 64 },
  carBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDispo: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)' },
  badgeLoue: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
  carBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heartBtn: { position: 'absolute', top: 10, left: 10, width: 32, height: 32, backgroundColor: 'rgba(10,22,40,0.6)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
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
