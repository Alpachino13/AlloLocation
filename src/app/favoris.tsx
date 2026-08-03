import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, formatDA } from '../constants'

type FavoriRow = {
  id: string; voiture_id: string
  voitures: {
    id: string; nom: string; agence: string; prix: number
    note: number; carburant: string; boite: string
    wilaya: string; image_url: string | null; statut: string
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
    const { data } = await supabase
      .from('favoris')
      .select('id,voiture_id,voitures(id,nom,agence,prix,note,carburant,boite,wilaya,image_url,statut)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setFavoris(data as any)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { fetchFavoris() }, [fetchFavoris])

  async function onRefresh() { setRefreshing(true); await fetchFavoris(); setRefreshing(false) }

  async function retirer(favoriId: string) {
    setFavoris(prev => prev.filter(f => f.id !== favoriId))
    const { error } = await supabase.from('favoris').delete().eq('id', favoriId)
    if (error) fetchFavoris()
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.pageTitle}>Favoris</Text>
            <Text style={s.pageSub}>{favoris.length} voiture{favoris.length !== 1 ? 's' : ''} sauvegardée{favoris.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.blue} style={{ marginTop: 60 }} />
        ) : favoris.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="heart-outline" size={32} color={COLORS.text3} />
            </View>
            <Text style={s.emptyTitle}>Aucun favori</Text>
            <Text style={s.emptySub}>Appuyez sur le cœur d'une voiture pour l'ajouter ici</Text>
            <TouchableOpacity style={s.exploreBtn} onPress={() => router.push('/')} activeOpacity={0.8}>
              <Text style={s.exploreBtnText}>Explorer les voitures</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {favoris.map(f => {
              const v = f.voitures
              if (!v) return null
              const imgErr = imageErrors.has(v.id)
              const dispo = v.statut === 'disponible'

              return (
                <TouchableOpacity
                  key={f.id}
                  style={s.card}
                  onPress={() => router.push(`/voiture/${v.id}`)}
                  activeOpacity={0.88}
                >
                  {/* Thumbnail */}
                  <View style={s.thumb}>
                    {v.image_url && !imgErr ? (
                      <Image
                        source={{ uri: v.image_url }}
                        style={StyleSheet.absoluteFill as any}
                        resizeMode="cover"
                        onError={() => setImageErrors(prev => new Set(prev).add(v.id))}
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill as any, s.thumbPlaceholder]}>
                        <Ionicons name="car-sport" size={24} color={COLORS.text3} />
                      </View>
                    )}
                    {/* Status dot */}
                    <View style={[s.statusDot, { backgroundColor: dispo ? COLORS.greenLight : COLORS.redLight }]} />
                  </View>

                  {/* Info */}
                  <View style={s.info}>
                    <Text style={s.carName} numberOfLines={1}>{v.nom}</Text>
                    <View style={s.locationRow}>
                      <Ionicons name="location-outline" size={11} color={COLORS.text3} />
                      <Text style={s.locationText}>{v.agence} · {v.wilaya}</Text>
                    </View>
                    <View style={s.chipsRow}>
                      <View style={s.chip}>
                        <Ionicons name="flash-outline" size={10} color={COLORS.text3} />
                        <Text style={s.chipText}>{v.carburant}</Text>
                      </View>
                      <View style={s.chip}>
                        <Ionicons name="settings-outline" size={10} color={COLORS.text3} />
                        <Text style={s.chipText}>{v.boite ?? 'Manuel'}</Text>
                      </View>
                    </View>
                    <View style={s.footer}>
                      <View style={s.ratingRow}>
                        <Ionicons name="star" size={12} color={COLORS.gold} />
                        <Text style={s.ratingText}>{(v.note ?? 5.0).toFixed(1)}</Text>
                      </View>
                      <Text style={s.price}>{formatDA(v.prix)}<Text style={s.priceLabel}>/j</Text></Text>
                    </View>
                  </View>

                  {/* Remove button */}
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => retirer(f.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="heart" size={18} color="#F87171" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.navyLight },
  header:       { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  pageTitle:    { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  pageSub:      { fontSize: 13, color: COLORS.text3, marginTop: 2 },

  list:         { paddingHorizontal: 20, gap: 10 },
  card:         { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border2, padding: 12, gap: 12, alignItems: 'flex-start' },

  thumb:        { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.card2, overflow: 'hidden', flexShrink: 0, position: 'relative' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.card2 },
  statusDot:    { position: 'absolute', bottom: 6, right: 6, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.card },

  info:         { flex: 1 },
  carName:      { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  locationText: { fontSize: 11, color: COLORS.text3 },
  chipsRow:     { flexDirection: 'row', gap: 6, marginBottom: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.card2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  chipText:     { fontSize: 10, color: COLORS.text2, fontWeight: '500' },
  footer:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText:   { fontSize: 12, fontWeight: '600', color: COLORS.text },
  price:        { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  priceLabel:   { fontSize: 11, fontWeight: '400', color: COLORS.text3 },

  removeBtn:    { padding: 6, alignSelf: 'flex-start' },

  emptyBox:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIconWrap:{ width: 72, height: 72, backgroundColor: COLORS.card, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border2, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: COLORS.text2, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  exploreBtn:   { backgroundColor: COLORS.blue, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  exploreBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
