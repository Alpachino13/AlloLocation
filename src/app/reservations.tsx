import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, STATUS_COLORS, formatDA, timeAgo } from '../constants'

type Reservation = {
  id: string; statut: string; date_debut: string; date_fin: string
  montant: number; created_at: string
  voitures: { nom: string; image_url: string | null; agence: string } | null
}

const GROUP_META: Record<string, { label: string; icon: string; color: string }> = {
  en_attente: { label: 'En attente',   icon: 'time-outline',            color: COLORS.gold },
  confirmee:  { label: 'Confirmées',   icon: 'checkmark-circle-outline', color: COLORS.green },
  autres:     { label: 'Historique',   icon: 'archive-outline',          color: COLORS.text3 },
}

function ReservationCard({ res, onCancel }: { res: Reservation; onCancel: () => void }) {
  const st = STATUS_COLORS[res.statut] ?? STATUS_COLORS['en_attente']
  const v = res.voitures
  const peutAnnuler = res.statut === 'en_attente'
  const nights = Math.ceil(
    (new Date(res.date_fin).getTime() - new Date(res.date_debut).getTime()) / 86400000
  )

  return (
    <View style={s.card}>
      <View style={s.cardInner}>
        {/* Thumbnail */}
        <View style={s.thumb}>
          {v?.image_url ? (
            <Image source={{ uri: v.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
          ) : (
            <Ionicons name="car-sport" size={22} color={COLORS.text3} />
          )}
        </View>

        {/* Info */}
        <View style={s.info}>
          <Text style={s.carName} numberOfLines={1}>{v?.nom ?? 'Voiture'}</Text>
          {v?.agence && (
            <View style={s.agenceRow}>
              <Ionicons name="business-outline" size={11} color={COLORS.text3} />
              <Text style={s.agenceText}>{v.agence}</Text>
            </View>
          )}
          <View style={s.datesRow}>
            <Ionicons name="calendar-outline" size={11} color={COLORS.text3} />
            <Text style={s.datesText}>
              {res.date_debut?.slice(0, 10)} → {res.date_fin?.slice(0, 10)}
            </Text>
            {nights > 0 && <Text style={s.nightsTag}>{nights}j</Text>}
          </View>
          <View style={s.statusRow}>
            <View style={[s.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
              <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
            <Text style={s.timeAgo}>{timeAgo(res.created_at)}</Text>
          </View>
        </View>

        {/* Right: price + action */}
        <View style={s.rightCol}>
          <Text style={s.amount}>{formatDA(res.montant ?? 0)}</Text>
          {peutAnnuler && (
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.cancelText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

export default function Reservations() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    fetch()
  }, [session])

  async function fetch() {
    if (!session) return
    setLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select('id,statut,date_debut,date_fin,montant,created_at,voitures(nom,image_url,agence)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setReservations(data as any)
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await fetch(); setRefreshing(false) }

  async function annuler(id: string) {
    Alert.alert('Annuler la réservation ?', 'Cette action est irréversible.', [
      { text: 'Retour', style: 'cancel' },
      { text: 'Annuler quand même', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('reservations').update({ statut: 'annulee' }).eq('id', id)
        if (error) Alert.alert('Erreur', error.message)
        else fetch()
      }},
    ])
  }

  const grouped = reservations.reduce((acc: Record<string, Reservation[]>, r) => {
    const k = r.statut === 'en_attente' ? 'en_attente' : r.statut === 'confirmee' ? 'confirmee' : 'autres'
    if (!acc[k]) acc[k] = []
    acc[k].push(r)
    return acc
  }, {})

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={s.header}>
          <View>
            <Text style={s.pageTitle}>Réservations</Text>
            <Text style={s.pageSub}>{reservations.length} au total</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.blue} style={{ marginTop: 60 }} />
        ) : reservations.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.text3} />
            </View>
            <Text style={s.emptyTitle}>Aucune réservation</Text>
            <Text style={s.emptySub}>Vos réservations apparaîtront ici</Text>
            <TouchableOpacity style={s.exploreBtn} onPress={() => router.push('/')} activeOpacity={0.8}>
              <Text style={s.exploreBtnText}>Explorer les voitures</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {(['en_attente', 'confirmee', 'autres'] as const).map(key => {
              const items = grouped[key]
              if (!items?.length) return null
              const meta = GROUP_META[key]
              return (
                <View key={key} style={s.group}>
                  <View style={s.groupHeader}>
                    <Ionicons name={meta.icon as any} size={14} color={meta.color} />
                    <Text style={[s.groupLabel, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={s.groupCount}>{items.length}</Text>
                  </View>
                  {items.map(r => (
                    <ReservationCard key={r.id} res={r} onCancel={() => annuler(r.id)} />
                  ))}
                </View>
              )
            })}
          </>
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

  group:        { paddingHorizontal: 20, marginBottom: 24 },
  groupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  groupLabel:   { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  groupCount:   { fontSize: 12, color: COLORS.text3, fontWeight: '600' },

  card:         { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border2, marginBottom: 10, overflow: 'hidden' },
  cardInner:    { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' },
  thumb:        { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.card2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
  info:         { flex: 1 },
  carName:      { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  agenceRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  agenceText:   { fontSize: 11, color: COLORS.text3 },
  datesRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  datesText:    { fontSize: 11, color: COLORS.text2 },
  nightsTag:    { fontSize: 10, color: COLORS.blueLight, fontWeight: '600', backgroundColor: COLORS.blueMuted, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusText:   { fontSize: 10, fontWeight: '600' },
  timeAgo:      { fontSize: 10, color: COLORS.text3 },
  rightCol:     { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  amount:       { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  cancelBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  cancelText:   { fontSize: 11, color: COLORS.redLight, fontWeight: '600' },

  emptyBox:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIconWrap:{ width: 72, height: 72, backgroundColor: COLORS.card, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border2, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: COLORS.text2, textAlign: 'center', marginBottom: 20 },
  exploreBtn:   { backgroundColor: COLORS.blue, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  exploreBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
