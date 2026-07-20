import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, formatDA } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type FavoriRow = {
  id: string
  voiture_id: string
  voitures: {
    id: string; nom: string; agence: string; prix: number
    note: number; carburant: string; boite: string; wilaya: string
    image_url: string | null
  } | null
}

export default function Favoris() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [favoris, setFavoris] = useState<FavoriRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const fetchFavoris = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return }
    const { data, error } = await supabase
      .from('favoris')
      .select('id,voiture_id,voitures(id,nom,agence,prix,note,carburant,boite,wilaya,image_url)')
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
    setFavoris(prev => prev.filter(f => f.id !== favoriId))
    const { error } = await supabase.from('favoris').delete().eq('id', favoriId)
    if (error) fetchFavoris()
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Mes favoris</Text>
        <Text style={styles.pageSub}>{favoris.length} sauvegardé{favoris.length > 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator size="large" color={COLORS.blue} />
        </View>
      ) : favoris.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="heart-outline" size={48} color={COLORS.text3} />
          <Text style={styles.emptyTitle}>Aucun favori sauvegardé</Text>
          <Text style={styles.emptySub}>Appuyez sur le cœur sur une voiture pour l'ajouter ici</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/')}>
            <Text style={styles.exploreBtnText}>Explorer les voitures</Text>
          </TouchableOpacity>
        </View>
      ) : (
        favoris.map(fav => {
          const v = fav.voitures
          if (!v) return null
          const imgError = imageErrors.has(v.id)
          return (
            <TouchableOpacity
              key={fav.id}
              style={styles.carCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/voiture/${v.id}`)}
            >
              <View style={styles.carEmojiBox}>
                {v.image_url && !imgError ? (
                  <Image
                    source={{ uri: v.image_url }}
                    style={styles.carImg}
                    resizeMode="cover"
                    onError={() => setImageErrors(prev => new Set(prev).add(v.id))}
                  />
                ) : (
                  <Ionicons name="car-sport" size={28} color={COLORS.text3} />
                )}
              </View>
              <View style={styles.carInfo}>
                <Text style={styles.carName} numberOfLines={1}>{v.nom}</Text>
                <Text style={styles.carAgency}>🏢 {v.agence} · {v.wilaya}</Text>
                <View style={styles.carFooter}>
                  <Text style={styles.carPrice}>{formatDA(v.prix)} <Text style={styles.carPriceSub}>/ jour</Text></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star" size={12} color={COLORS.gold} />
                    <Text style={styles.carRating}>{v.note}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.heartBtn} onPress={() => retirerFavori(fav.id)}>
                <Ionicons name="heart" size={18} color={COLORS.red} />
              </TouchableOpacity>
            </TouchableOpacity>
          )
        })
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  pageSub: { fontSize: 13, color: COLORS.text2, marginTop: 2 },
  carCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 10, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: COLORS.border3 },
  carEmojiBox: { width: 56, height: 56, backgroundColor: COLORS.card2, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' },
  carImg: { width: '100%', height: '100%' },
  carInfo: { flex: 1 },
  carName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  carAgency: { fontSize: 12, color: COLORS.text2, marginBottom: 8 },
  carFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carPrice: { fontSize: 15, fontWeight: '800', color: COLORS.gold },
  carPriceSub: { fontSize: 11, fontWeight: '400', color: COLORS.text2 },
  carRating: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  heartBtn: { padding: 6 },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.text2, textAlign: 'center', marginBottom: 20 },
  exploreBtn: { borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  exploreBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
})
