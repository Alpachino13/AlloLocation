import { useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NAVY = '#0A1628'; const NAVY2 = '#131F35'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const BLUE_L = '#3B7FF5'; const GOLD = '#F59E0B'
const GREEN = '#10B981'; const RED = '#EF4444'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

const AGENCE_ID = '11111111-1111-1111-1111-111111111111'

const BARS = [
  { lbl: 'L', h: 40 }, { lbl: 'M', h: 55 }, { lbl: 'M', h: 30 },
  { lbl: 'J', h: 70 }, { lbl: 'V', h: 80, gold: true }, { lbl: 'S', h: 60 }, { lbl: 'D', h: 45 }
]

type Reservation = {
  id: string; statut: string; date_debut: string
  date_fin: string; montant: number
  voitures: { nom: string } | null
}

export default function Dashboard() {
  const router = useRouter()
  const { session } = useAuth()
  const [nomAgence, setNomAgence] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalVoitures, setTotalVoitures] = useState(0)
  const [disponibles, setDisponibles] = useState(0)
  const [totalRes, setTotalRes] = useState(0)
  const [revenusMois, setRevenusMois] = useState(0)
  const [benefice, setBenefice] = useState(0)
  const [reservations, setReservations] = useState<Reservation[]>([])

  useEffect(() => { 
  charger()
  fetchNomAgence()
}, [])

async function fetchNomAgence() {
  if (!session) return
  const { data } = await supabase
    .from('profils')
    .select('nom')
    .eq('id', session.user.id)
    .single()
  if (data?.nom) setNomAgence(data.nom)
}

  async function charger() {
    setLoading(true)
    await Promise.all([fetchVoitures(), fetchReservations()])
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await Promise.all([fetchVoitures(), fetchReservations()])
    setRefreshing(false)
  }

  async function fetchVoitures() {
    const { data } = await supabase.from('voitures').select('statut').eq('agence_id', AGENCE_ID)
    if (data) { setTotalVoitures(data.length); setDisponibles(data.filter(v => v.statut === 'disponible').length) }
  }

  async function fetchReservations() {
    const { data } = await supabase.from('reservations').select('id,statut,date_debut,date_fin,montant,voitures(nom)').order('created_at', { ascending: false }).limit(10)
    if (data) {
      setReservations(data as any)
      setTotalRes(data.length)
      const mois = new Date().getMonth()
      const rev = data.filter(r => r.statut === 'confirmee' && new Date(r.date_debut).getMonth() === mois).reduce((s, r) => s + (r.montant ?? 0), 0)
      setRevenusMois(rev)
      setBenefice(Math.round(rev * 0.82))
    }
  }

  async function changerStatut(id: string, statut: string) {
    await supabase.from('reservations').update({ statut }).eq('id', id)
    fetchReservations()
  }

  const taux = totalVoitures > 0 ? Math.round(((totalVoitures - disponibles) / totalVoitures) * 100) : 0
  const loues = totalVoitures - disponibles
  const circumference = 2 * Math.PI * 30

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
  )

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}>

      {/* Status bar */}
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>Dashboard</Text>
          <Text style={s.headerTitle}>{nomAgence || 'Mon Agence'}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/ajouter-voiture' as any)}>
          <Text style={s.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      <View style={s.statGrid}>
        {[
          { icon: '💰', val: `${Math.round(revenusMois / 1000)}K`, label: 'Revenus ce mois (DA)', trend: '↑ +12% vs mois passé', color: GOLD },
          { icon: '📅', val: String(totalRes), label: 'Réservations ce mois', trend: `↑ +4 vs mois passé`, color: BLUE_L },
          { icon: '📈', val: `${Math.round(benefice / 1000)}K`, label: 'Bénéfice net (DA)', trend: '↑ +8% estimé', color: GREEN },
          { icon: '🚗', val: `${disponibles}`, label: 'Flotte disponible', trend: `${taux}% occupé`, color: TEXT2, sub: `/ ${totalVoitures}` },
        ].map((stat, i) => (
          <View key={i} style={s.statCard}>
            <Text style={[s.statIcon, { color: stat.color }]}>{stat.icon}</Text>
            <Text style={[s.statVal, { color: stat.color }]}>{stat.val}{stat.sub ? <Text style={{ fontSize: 14, fontWeight: '400', color: TEXT2 }}> {stat.sub}</Text> : null}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
            <Text style={[s.statTrend, { color: stat.color === TEXT2 ? TEXT2 : GREEN }]}>{stat.trend}</Text>
          </View>
        ))}
      </View>

      {/* Chart */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Revenus hebdomadaires</Text>
      </View>
      <View style={s.chartBars}>
        {BARS.map((bar, i) => (
          <View key={i} style={s.barWrap}>
            <View style={[s.bar, { height: bar.h, backgroundColor: bar.gold ? GOLD : BLUE }]} />
            <Text style={s.barLbl}>{bar.lbl}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 11, color: TEXT3 }}>0</Text>
        <Text style={{ fontSize: 11, color: TEXT2 }}>semaine en cours</Text>
        <Text style={{ fontSize: 11, color: TEXT3 }}>max</Text>
      </View>

      {/* Donut */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Taux d'occupation</Text>
      </View>
      <View style={s.donutWrap}>
        <View style={s.donutCircle}>
          <View style={[s.donutOuter, { borderColor: CARD2 }]} />
          <View style={[s.donutFill, { borderColor: BLUE }]} />
          <View style={s.donutCenter}>
            <Text style={s.donutPct}>{taux}%</Text>
          </View>
        </View>
        <View style={s.donutLegend}>
          {[
            { dot: BLUE, label: 'Loués', val: `${loues} véh.` },
            { dot: GREEN, label: 'Disponibles', val: `${disponibles} véh.` },
            { dot: TEXT3, label: 'Maintenance', val: '0 véh.' },
          ].map(item => (
            <View key={item.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: item.dot }]} />
              <Text style={s.legendText}>{item.label}</Text>
              <Text style={s.legendVal}>{item.val}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pending reservations */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>En attente de confirmation</Text>
      </View>

      {reservations.filter(r => r.statut === 'en_attente').length === 0 ? (
        <View style={[s.pendingCard, { alignItems: 'center' }]}>
          <Text style={{ color: TEXT2, fontSize: 14 }}>Aucune réservation en attente ✅</Text>
        </View>
      ) : (
        reservations.filter(r => r.statut === 'en_attente').map(res => (
          <View key={res.id} style={s.pendingCard}>
            <View style={s.pendingTop}>
              <Text style={s.pendingName}>🚗 {res.voitures?.nom ?? '—'}</Text>
              <Text style={s.pendingAmount}>{(res.montant ?? 0).toLocaleString()} DA</Text>
            </View>
            <Text style={s.pendingDates}>📅 {res.date_debut} → {res.date_fin}</Text>
            <View style={s.pendingActions}>
              <TouchableOpacity style={s.btnConfirm} onPress={() => changerStatut(res.id, 'confirmee')}>
                <Text style={{ color: '#34D399', fontSize: 12, fontWeight: '600' }}>✓ Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnCancel} onPress={() => changerStatut(res.id, 'annulee')}>
                <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '600' }}>✗ Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  headerSub: { fontSize: 13, color: TEXT2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
  addBtn: { backgroundColor: BLUE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statCard: { width: '47%', backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2 },
  statIcon: { fontSize: 20, marginBottom: 8 },
  statVal: { fontSize: 22, fontWeight: '800', color: TEXT },
  statLabel: { fontSize: 11, color: TEXT2, marginTop: 2, fontWeight: '500' },
  statTrend: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80, paddingHorizontal: 20, marginBottom: 6 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLbl: { fontSize: 10, color: TEXT2 },
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginBottom: 20 },
  donutCircle: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  donutOuter: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 12 },
  donutFill: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 12, borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: '-45deg' }] },
  donutCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  donutPct: { fontSize: 14, fontWeight: '800', color: TEXT },
  donutLegend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, color: TEXT2, flex: 1 },
  legendVal: { fontSize: 13, fontWeight: '700', color: TEXT },
  pendingCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2 },
  pendingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pendingName: { fontSize: 14, fontWeight: '700', color: TEXT },
  pendingAmount: { fontSize: 15, fontWeight: '800', color: GOLD },
  pendingDates: { fontSize: 12, color: TEXT2, marginBottom: 10 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  btnConfirm: { flex: 1, padding: 8, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center' },
  btnCancel: { flex: 1, padding: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center' },
})
