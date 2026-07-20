import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, STATUS_COLORS, formatDA, timeAgo } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Reservations() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!session) { setLoading(false); return }
    fetchReservations()
  }, [session])

  async function fetchReservations() {
    if (!session) return
    setLoading(true)
    const { data, error } = await supabase
      .from('reservations')
      .select('id,statut,date_debut,date_fin,montant,created_at,voitures(nom,image_url,agence)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!error && data) setReservations(data)
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await fetchReservations()
    setRefreshing(false)
  }

  async function annulerReservation(id: string) {
    Alert.alert(
      'Annuler la réservation ?',
      'Cette action est irréversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('reservations').update({ statut: 'annulee' }).eq('id', id)
            if (error) Alert.alert('Erreur', error.message)
            else fetchReservations()
          }
        }
      ]
    )
  }

  const grouped = reservations.reduce((acc: Record<string, any[]>, res) => {
    const key = res.statut === 'en_attente' ? 'en_attente' : res.statut === 'confirmee' ? 'confirmee' : 'autres'
    if (!acc[key]) acc[key] = []
    acc[key].push(res)
    return acc
  }, {})

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Mes réservations</Text>
        <Text style={styles.pageSub}>{reservations.length} réservation{reservations.length > 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.blue} style={{ marginTop: 40 }} />
      ) : reservations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.text3} />
          <Text style={styles.emptyTitle}>Aucune réservation</Text>
          <Text style={styles.emptySub}>Vous n'avez pas encore effectué de réservation</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/')}>
            <Text style={styles.exploreBtnText}>Explorer les voitures</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {grouped.en_attente?.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>⏳ En attente</Text>
              {grouped.en_attente.map(renderReservationCard)}
            </View>
          )}
          {grouped.confirmee?.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>✅ Confirmées</Text>
              {grouped.confirmee.map(renderReservationCard)}
            </View>
          )}
          {grouped.autres?.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>📋 Historique</Text>
              {grouped.autres.map(renderReservationCard)}
            </View>
          )}
        </>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  )

  function renderReservationCard(res: any) {
    const st = STATUS_COLORS[res.statut] ?? STATUS_COLORS['en_attente']
    const nom = res.voitures?.nom ?? '—'
    const imgUrl = res.voitures?.image_url ?? null
    const agence = res.voitures?.agence ?? ''
    const peutAnnuler = res.statut === 'en_attente'

    return (
      <View key={res.id} style={styles.resvCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.resvEmoji}>
            {imgUrl ? (
              <Image source={{ uri: imgUrl }} style={styles.resvImg} resizeMode="cover" />
            ) : (
              <Ionicons name="car-sport" size={24} color={COLORS.text3} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resvName} numberOfLines={1}>{nom}</Text>
            {agence && <Text style={styles.resvAgence}>🏢 {agence}</Text>}
            <Text style={styles.resvDates}>
              📅 {res.date_debut?.slice(0, 10)} → {res.date_fin?.slice(0, 10)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View style={[styles.resvStatus, { backgroundColor: st.bg, borderColor: st.border }]}>
                <Text style={[styles.resvStatusText, { color: st.color }]}>{st.label}</Text>
              </View>
              <Text style={styles.resvTime}>{timeAgo(res.created_at)}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.resvAmount}>{formatDA(res.montant ?? 0)}</Text>
            {peutAnnuler && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => annulerReservation(res.id)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  pageSub: { fontSize: 13, color: COLORS.text2, marginTop: 2 },
  group: { paddingHorizontal: 20, marginBottom: 20 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  resvCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 10 },
  resvEmoji: { width: 52, height: 52, backgroundColor: COLORS.card2, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  resvImg: { width: '100%', height: '100%' },
  resvName: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 1 },
  resvAgence: { fontSize: 11, color: COLORS.text3, marginBottom: 2 },
  resvDates: { fontSize: 12, color: COLORS.text2 },
  resvStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 0.5 },
  resvStatusText: { fontSize: 10, fontWeight: '600' },
  resvTime: { fontSize: 10, color: COLORS.text3 },
  resvAmount: { fontSize: 14, fontWeight: '800', color: COLORS.gold, marginBottom: 6 },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
  cancelText: { fontSize: 11, color: COLORS.redLight, fontWeight: '600' },
  emptyCard: { margin: 20, backgroundColor: COLORS.card, borderRadius: 16, padding: 30, borderWidth: 0.5, borderColor: COLORS.border3, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.text2, textAlign: 'center', marginBottom: 20 },
  exploreBtn: { borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  exploreBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
})
