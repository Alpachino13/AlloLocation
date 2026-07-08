import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER2 = 'rgba(255,255,255,0.12)'

type FavoriRow = {
  id: string
  voiture_id: string
  voitures: {
    id: string; nom: string; agence: string; prix: number
    note: number; carburant: string; boite: string
    image_url: string | null
  } | null
}

export default function Favoris() {
  const router = useRouter()
  const { session } = useAuth()
  const [favoris, setFavoris] = useState<FavoriRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchFavoris = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return }
    const { data, error } = await supabase
      .from('favoris')
      .select('id,voiture_id,voitures(id,nom,agence,prix,note,carburant,boite,image_url)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setFavoris(data as any)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { fetchFavoris() }, [fetchFavoris])

  async function onRefresh() {
    setRefreshing(true)
    await fetchFavoris()
    setRefreshing(false)
  }

  async function retirerFavori(favoriId: string) {
    // Mise à jour optimiste, rollback si l'appel échoue
    setFavoris(prev => prev.filter(f => f.id !== favoriId))
    const { error } = await supabase.from('favoris').delete().eq('id', favoriId)
    if (error) fetchFavoris()
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    )
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}>
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      <Text style={s.pageTitle}>Mes favoris</Text>

      {favoris.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🤍</Text>
          <Text style={s.emptyTitle}>Aucun favori sauvegardé</Text>
          <Text style={s.emptySub}>Appuyez sur le cœur sur une voiture pour l'ajouter ici</Text>
          <TouchableOpacity style={s.exploreBtn} onPress={() => router.push('/')}>
            <Text style={s.exploreBtnText}>Explorer les voitures</Text>
          </TouchableOpacity>
        </View>
      ) : (
        favoris.map(fav => {
          const v = fav.voitures
          if (!v) return null
          return (
            <TouchableOpacity
              key={fav.id}
              style={s.carCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/voiture/${v.id}` as any)}
            >
              <View style={s.carEmojiBox}>
                {v.image_url ? (
                  <Image source={{ uri: v.image_url }} style={s.carImg} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 32 }}>🚗</Text>
                )}
              </View>
              <View style={s.carInfo}>
                <Text style={s.carName}>{v.nom}</Text>
                <Text style={s.carAgency}>🏢 {v.agence}</Text>
                <View style={s.carFooter}>
                  <Text style={s.carPrice}>{v.prix?.toLocaleString()} DA <Text style={s.carPriceSub}>/ jour</Text></Text>
                  <Text style={s.carRating}>⭐ {v.note}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.heartBtn} onPress={() => retirerFavori(fav.id)}>
                <Text style={{ fontSize: 18 }}>❤️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )
        })
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  pageTitle: { fontSize: 24, fontWeight: '800', color: TEXT, paddingHorizontal: 20, paddingBottom: 16 },
  carCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2 },
  carEmojiBox: { width: 56, height: 56, backgroundColor: CARD2, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' },
  carImg: { width: '100%', height: '100%' },
  carInfo: { flex: 1 },
  carName: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 3 },
  carAgency: { fontSize: 12, color: TEXT2, marginBottom: 8 },
  carFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carPrice: { fontSize: 15, fontWeight: '800', color: GOLD },
  carPriceSub: { fontSize: 11, fontWeight: '400', color: TEXT2 },
  carRating: { fontSize: 13, fontWeight: '600', color: TEXT },
  heartBtn: { padding: 6 },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT2, textAlign: 'center', marginBottom: 20 },
  exploreBtn: { borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  exploreBtnText: { color: TEXT, fontSize: 14, fontWeight: '600' },
})
