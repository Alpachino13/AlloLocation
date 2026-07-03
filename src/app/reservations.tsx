import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'; const GREEN = '#10B981'; const RED = '#EF4444'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

const EMOJIS: Record<string, string> = { 'Logan': '🚙', 'Hilux': '🛻', 'Tucson': '🚘', 'Clio': '🚗', 'Peugeot': '🚗' }
const getEmoji = (nom: string) => { for (const [k, v] of Object.entries(EMOJIS)) if (nom?.includes(k)) return v; return '🚗' }

export default function Reservations() {
  const router = useRouter()
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('reservations').select('id,statut,date_debut,date_fin,montant,voitures(nom)').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setReservations(data)
      setLoading(false)
    })
  }, [])

  const statutStyle: Record<string, { bg: string; color: string; border: string; label: string }> = {
    confirmee: { bg: 'rgba(16,185,129,0.15)', color: '#34D399', border: 'rgba(16,185,129,0.3)', label: '✓ Confirmée' },
    en_attente: { bg: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: 'rgba(245,158,11,0.3)', label: '⏳ En attente' },
    annulee: { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: 'rgba(239,68,68,0.3)', label: '✗ Annulée' },
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      <Text style={s.pageTitle}>Mes réservations</Text>

      {loading ? (
        <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} />
      ) : reservations.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={s.emptyTitle}>Aucune réservation</Text>
          <Text style={s.emptySub}>Vous n'avez pas encore effectué de réservation</Text>
          <TouchableOpacity style={s.exploreBtn} onPress={() => router.push('/')}>
            <Text style={s.exploreBtnText}>Explorer les voitures</Text>
          </TouchableOpacity>
        </View>
      ) : (
        reservations.map(res => {
          const st = statutStyle[res.statut] ?? statutStyle['en_attente']
          const nom = (res.voitures as any)?.nom ?? '—'
          return (
            <TouchableOpacity key={res.id} style={s.resvCard} activeOpacity={0.85}>
              <View style={s.resvEmoji}>
                <Text style={{ fontSize: 28 }}>{getEmoji(nom)}</Text>
              </View>
              <View style={s.resvInfo}>
                <Text style={s.resvName}>{nom}</Text>
                <Text style={s.resvDates}>📅 {res.date_debut} → {res.date_fin}</Text>
                <View style={[s.resvStatus, { backgroundColor: st.bg, borderColor: st.border }]}>
                  <Text style={[s.resvStatusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={s.resvAmount}>{(res.montant ?? 0).toLocaleString()} DA</Text>
            </TouchableOpacity>
          )
        })
      )}

      {/* Find a car CTA */}
      <View style={s.ctaCard}>
        <Text style={s.ctaIcon}>🔍</Text>
        <Text style={s.ctaTitle}>Trouver une voiture</Text>
        <Text style={s.ctaSub}>Des centaines de véhicules dans toute l'Algérie</Text>
        <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/')}>
          <Text style={s.ctaBtnText}>Explorer les voitures</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  pageTitle: { fontSize: 24, fontWeight: '800', color: TEXT, paddingHorizontal: 20, paddingBottom: 16 },
  resvCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resvEmoji: { width: 52, height: 52, backgroundColor: CARD2, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resvInfo: { flex: 1 },
  resvName: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 3 },
  resvDates: { fontSize: 12, color: TEXT2, marginBottom: 6 },
  resvStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 0.5 },
  resvStatusText: { fontSize: 11, fontWeight: '600' },
  resvAmount: { fontSize: 15, fontWeight: '800', color: GOLD },
  emptyCard: { margin: 20, backgroundColor: CARD, borderRadius: 16, padding: 30, borderWidth: 0.5, borderColor: BORDER2, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT2, textAlign: 'center', marginBottom: 20 },
  ctaCard: { margin: 20, backgroundColor: CARD, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: BORDER2, alignItems: 'center' },
  ctaIcon: { fontSize: 36, marginBottom: 10 },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 6 },
  ctaSub: { fontSize: 13, color: TEXT2, textAlign: 'center', marginBottom: 14 },
  ctaBtn: { borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  ctaBtnText: { color: TEXT, fontSize: 15, fontWeight: '600' },
  exploreBtn: { borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  exploreBtnText: { color: TEXT, fontSize: 14, fontWeight: '600' },
})
