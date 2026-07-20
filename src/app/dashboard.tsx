import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, Dimensions
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, formatDA, STATUS_COLORS } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: SW } = Dimensions.get('window')

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Reservation = {
  id: string
  voiture_id: string
  statut: string
  date_debut: string
  date_fin: string
  montant: number
  created_at: string
  voitures: { nom: string; agence_id?: string; image_url?: string | null } | null
  profils?: { nom?: string; telephone?: string } | null
}

type WeekBar = { lbl: string; val: number; h: number; gold: boolean }

function buildWeekBars(reservations: Reservation[]): WeekBar[] {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  monday.setHours(0, 0, 0, 0)

  const totals = Array(7).fill(0)
  const todayIdx = dayOfWeek

  for (const r of reservations) {
    if (r.statut !== 'confirmee') continue
    const d = new Date(r.date_debut)
    d.setHours(0, 0, 0, 0)
    const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) totals[diff] += r.montant ?? 0
  }

  const maxVal = Math.max(...totals, 1)
  return totals.map((v, i) => ({
    lbl: DAY_LABELS[i],
    val: v,
    h: Math.max(6, Math.round((v / maxVal) * 100)),
    gold: i === todayIdx,
  }))
}

function formatAmount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

export default function Dashboard() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [nomAgence, setNomAgence] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalVoitures, setTotalVoitures] = useState(0)
  const [disponibles, setDisponibles] = useState(0)
  const [totalRes, setTotalRes] = useState(0)
  const [revenusMois, setRevenusMois] = useState(0)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [weekBars, setWeekBars] = useState<WeekBar[]>(
    DAY_LABELS.map((lbl, i) => ({ lbl, val: 0, h: 6, gold: false }))
  )

  useEffect(() => {
    if (session) {
      charger()
      fetchNomAgence()
      subscribeReservations()
    }
    return () => { supabase.removeAllChannels() }
  }, [session])

  function subscribeReservations() {
    if (!session?.user?.id) return
    const channel = supabase.channel('dashboard-reservations')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'reservations',
        filter: `user_id=eq.${session.user.id}`
      }, () => {
        fetchReservations()
        fetchVoitures()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }

  async function fetchNomAgence() {
    if (!session) return
    const { data } = await supabase.from('profils').select('nom').eq('id', session.user.id).single()
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
    if (!session) return
    const { data } = await supabase.from('voitures').select('statut').eq('agence_id', session.user.id)
    if (data) {
      setTotalVoitures(data.length)
      setDisponibles(data.filter(v => v.statut === 'disponible').length)
    }
  }

async function fetchReservations() {
    if (!session) return
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,voiture_id,statut,date_debut,date_fin,montant,created_at,
        voitures!inner(nom,agence_id,image_url),
        profils!user_id(nom,telephone)
      `)
      .eq('voitures.agence_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('fetchReservations error:', error)
      return
    }

    if (data) {
      setReservations(data as any)
      setTotalRes(data.length)
      const mois = new Date().getMonth()
      const rev = data
        .filter((r: any) => r.statut === 'confirmee' && new Date(r.date_debut).getMonth() === mois)
        .reduce((s: number, r: any) => s + (r.montant ?? 0), 0)
      setRevenusMois(rev)
      setWeekBars(buildWeekBars(data as any))
    }
  }

  async function changerStatut(id: string, statut: string) {
    const { error } = await supabase.from('reservations').update({ statut }).eq('id', id)
    if (error) { Alert.alert('Erreur', error.message); return }

    const reservation = reservations.find(r => r.id === id)
    if (reservation?.voiture_id) {
      const statutVoiture = statut === 'confirmee' ? 'loue' : 'disponible'
      await supabase.from('voitures').update({ statut: statutVoiture }).eq('id', reservation.voiture_id)
    }

    // Notifier le client
    if (statut === 'confirmee' || statut === 'annulee') {
      const res = reservations.find(r => r.id === id)
      if (res) {
        await supabase.from('notifications').insert({
          user_id: session!.user.id,
          titre: statut === 'confirmee' ? 'Réservation confirmée' : 'Réservation refusée',
          message: `Votre réservation pour ${res.voitures?.nom ?? '—'} a été ${statut === 'confirmee' ? 'confirmée' : 'refusée'}`,
          type: statut === 'confirmee' ? 'confirmation' : 'annulation',
        })
      }
    }

    fetchReservations()
    fetchVoitures()
  }

  const taux = totalVoitures > 0 ? Math.round(((totalVoitures - disponibles) / totalVoitures) * 100) : 0
  const loues = totalVoitures - disponibles
  const enAttente = reservations.filter(r => r.statut === 'en_attente')

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.navy, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Vue d'ensemble</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{nomAgence || 'Mon Agence'}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/ajouter-voiture')}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiStrip}>
        <KpiCard icon="💰" label="Revenus ce mois" value={formatAmount(revenusMois) + ' DA'} color={COLORS.gold} />
        <KpiCard icon="📅" label="Réservations" value={String(totalRes)} color={COLORS.blueLight} sub={`${enAttente.length} en attente`} />
        <KpiCard icon="🚗" label="Flotte dispo" value={`${disponibles}/${totalVoitures}`} color={COLORS.text2} sub={`${taux}% occupé`} />
        <KpiCard icon="✅" label="Taux conf." value={totalRes > 0 ? `${Math.round(reservations.filter(r => r.statut === 'confirmee').length / totalRes * 100)}%` : '—'} color={COLORS.green} />
      </ScrollView>

      {/* Weekly Chart */}
      <View style={styles.section}>
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>Revenus hebdomadaires</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.gold }]} />
            <Text style={styles.legendLabel}>Aujourd'hui</Text>
          </View>
        </View>
        <View style={styles.chartWrap}>
          {weekBars.map((bar, i) => (
            <View key={i} style={styles.barCol}>
              {bar.val > 0 && <Text style={styles.barValue}>{formatAmount(bar.val)}</Text>}
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: bar.h, backgroundColor: bar.gold ? COLORS.gold : COLORS.blueLight }]} />
              </View>
              <Text style={[styles.barLabel, bar.gold && { color: COLORS.gold, fontWeight: '700' }]}>{bar.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Occupation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Occupation de la flotte</Text>
        <View style={styles.gaugeCard}>
          <View style={styles.gaugeMeta}>
            <GaugeItem label="Loués" value={loues} color={COLORS.blueLight} />
            <View style={styles.gaugeDivider} />
            <GaugeItem label="Disponibles" value={disponibles} color={COLORS.greenLight} />
            <View style={styles.gaugeDivider} />
            <GaugeItem label="Total" value={totalVoitures} color={COLORS.text} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${taux}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressPct}>{taux}% occupé</Text>
            <Text style={styles.progressPct}>{100 - taux}% libre</Text>
          </View>
        </View>
      </View>

      {/* Pending Reservations */}
      <View style={styles.section}>
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>En attente</Text>
          {enAttente.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{enAttente.length}</Text>
            </View>
          )}
        </View>

        {enAttente.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={COLORS.green} />
            <Text style={styles.emptyText}>Aucune réservation en attente</Text>
          </View>
        ) : (
          enAttente.map(res => {
            const imgUrl = res.voitures?.image_url ?? null
            const nom = res.voitures?.nom ?? '—'
            const debut = res.date_debut?.slice(0, 10) ?? '—'
            const fin = res.date_fin?.slice(0, 10) ?? '—'
            const duree = Math.max(1, Math.round((new Date(res.date_fin).getTime() - new Date(res.date_debut).getTime()) / 86400000))
            const client = (res as any).profils?.nom ?? 'Client'
            const tel = (res as any).profils?.telephone ?? ''

            return (
              <View key={res.id} style={styles.pendingCard}>
                <View style={styles.pendingThumb}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={styles.pendingImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.pendingImgFallback}>
                      <Ionicons name="car-sport" size={32} color={COLORS.text3} />
                    </View>
                  )}
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>En attente</Text>
                  </View>
                </View>

                <View style={styles.pendingBody}>
                  <View style={styles.pendingRow}>
                    <Text style={styles.pendingCarName} numberOfLines={1}>{nom}</Text>
                    <Text style={styles.pendingAmount}>{formatDA(res.montant ?? 0)}</Text>
                  </View>
                  <Text style={styles.pendingDates}>📅 {debut} → {fin} · {duree}j</Text>
                  {client !== 'Client' && <Text style={styles.pendingClient}>👤 {client} {tel ? `· ${tel}` : ''}</Text>}

                  <View style={styles.pendingActions}>
                    <TouchableOpacity style={styles.btnRefuse} onPress={() => changerStatut(res.id, 'annulee')}>
                      <Ionicons name="close-circle-outline" size={16} color={COLORS.redLight} />
                      <Text style={styles.btnRefuseText}>Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnConfirm} onPress={() => changerStatut(res.id, 'confirmee')}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.btnConfirmText}>Confirmer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* Recent Confirmed */}
      {reservations.filter(r => r.statut === 'confirmee').length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récemment confirmées</Text>
          {reservations.filter(r => r.statut === 'confirmee').slice(0, 5).map(res => {
            const imgUrl = res.voitures?.image_url ?? null
            const nom = res.voitures?.nom ?? '—'
            const st = STATUS_COLORS['confirmee']
            return (
              <View key={res.id} style={styles.confirmedRow}>
                <View style={styles.confirmedThumb}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={styles.confirmedImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name="car-sport" size={20} color={COLORS.text3} />
                  )}
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.confirmedName} numberOfLines={1}>{nom}</Text>
                  <Text style={styles.confirmedDates}>{res.date_debut?.slice(0, 10)} → {res.date_fin?.slice(0, 10)}</Text>
                </View>
                <View style={[styles.confirmedBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                  <Text style={[styles.confirmedBadgeText, { color: st.color }]}>Confirmée</Text>
                </View>
                <Text style={styles.confirmedAmount}>{formatDA(res.montant ?? 0)}</Text>
              </View>
            )
          })}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

function KpiCard({ icon, label, value, color, sub }: {
  icon: string; label: string; value: string; color: string; sub?: string
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  )
}

function GaugeItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.gaugeItem}>
      <Text style={[styles.gaugeNum, { color }]}>{value}</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerSub: { fontSize: 12, color: COLORS.text3, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.blue, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  kpiStrip: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  kpiCard: { width: 140, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: COLORS.border3 },
  kpiIcon: { fontSize: 22, marginBottom: 10 },
  kpiValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: COLORS.text2, fontWeight: '500' },
  kpiSub: { fontSize: 10, color: COLORS.text3, marginTop: 4 },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 10, color: COLORS.text3 },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: COLORS.card, borderRadius: 16, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12, borderWidth: 0.5, borderColor: COLORS.border3, gap: 0, height: 160 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontSize: 9, color: COLORS.text3, textAlign: 'center' },
  barTrack: { width: '60%', height: 100, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 6 },
  barLabel: { fontSize: 10, color: COLORS.text3, fontWeight: '500' },
  gaugeCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: COLORS.border3 },
  gaugeMeta: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  gaugeItem: { alignItems: 'center', gap: 4 },
  gaugeNum: { fontSize: 26, fontWeight: '800' },
  gaugeLabel: { fontSize: 11, color: COLORS.text3 },
  gaugeDivider: { width: 1, backgroundColor: COLORS.border2, marginVertical: 4 },
  progressTrack: { height: 8, backgroundColor: COLORS.card2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: COLORS.blue, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPct: { fontSize: 11, color: COLORS.text3 },
  badge: { backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.4)' },
  badgeText: { color: COLORS.goldLight, fontSize: 12, fontWeight: '700' },
  emptyState: { backgroundColor: COLORS.card, borderRadius: 16, padding: 30, borderWidth: 0.5, borderColor: COLORS.border3, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.text2, fontSize: 14 },
  pendingCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border3, overflow: 'hidden', marginBottom: 12 },
  pendingThumb: { width: '100%', height: 140, backgroundColor: COLORS.card2, position: 'relative' },
  pendingImg: { width: '100%', height: '100%' },
  pendingImgFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pendingPill: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(245,158,11,0.25)', borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.5)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendingPillText: { color: COLORS.goldLight, fontSize: 11, fontWeight: '600' },
  pendingBody: { padding: 14 },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pendingCarName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  pendingAmount: { fontSize: 16, fontWeight: '800', color: COLORS.gold },
  pendingDates: { fontSize: 12, color: COLORS.text2, marginBottom: 4 },
  pendingClient: { fontSize: 12, color: COLORS.blueLight, marginBottom: 12 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  btnRefuse: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
  btnRefuseText: { color: COLORS.redLight, fontSize: 13, fontWeight: '600' },
  btnConfirm: { flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.blue },
  btnConfirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 8 },
  confirmedThumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: COLORS.card2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  confirmedImg: { width: '100%', height: '100%' },
  confirmedName: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  confirmedDates: { fontSize: 11, color: COLORS.text3 },
  confirmedBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5 },
  confirmedBadgeText: { fontSize: 10, fontWeight: '600' },
  confirmedAmount: { fontSize: 13, fontWeight: '800', color: COLORS.gold, minWidth: 70, textAlign: 'right' },
})