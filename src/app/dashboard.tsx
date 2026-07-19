import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NAVY = '#0A1628'
const NAVY2 = '#0D1E35'
const CARD = '#1E2D45'
const CARD2 = '#243352'
const CARD3 = '#2A3A5C'
const BLUE = '#2563EB'
const BLUE_L = '#3B7FF5'
const BLUE_D = '#1D4ED8'
const GOLD = '#F59E0B'
const GOLD_L = '#FCD34D'
const GREEN = '#10B981'
const GREEN_L = '#34D399'
const RED = '#EF4444'
const RED_L = '#FCA5A5'
const TEXT = '#F8FAFC'
const TEXT2 = '#94A3B8'
const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.06)'
const BORDER2 = 'rgba(255,255,255,0.10)'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Reservation = {
  id: string
  voiture_id: string
  statut: string
  date_debut: string
  date_fin: string
  montant: number
  voitures: { nom: string; agence_id?: string; image_url?: string | null } | null
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
  const [nomAgence, setNomAgence] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalVoitures, setTotalVoitures] = useState(0)
  const [disponibles, setDisponibles] = useState(0)
  const [totalRes, setTotalRes] = useState(0)
  const [revenusMois, setRevenusMois] = useState(0)
  const [benefice, setBenefice] = useState(0)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [weekBars, setWeekBars] = useState<WeekBar[]>(
    DAY_LABELS.map((lbl, i) => ({ lbl, val: 0, h: 6, gold: false }))
  )

  useEffect(() => {
    if (session) { charger(); fetchNomAgence() }
  }, [session])

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
    const { data } = await supabase
      .from('reservations')
      .select('id,voiture_id,statut,date_debut,date_fin,montant,voitures!inner(nom,agence_id,image_url)')
      .eq('voitures.agence_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setReservations(data as any)
      setTotalRes(data.length)
      const mois = new Date().getMonth()
      const rev = data
        .filter(r => r.statut === 'confirmee' && new Date(r.date_debut).getMonth() === mois)
        .reduce((s, r) => s + (r.montant ?? 0), 0)
      setRevenusMois(rev)
      setBenefice(Math.round(rev * 0.82))
      setWeekBars(buildWeekBars(data as any))
    }
  }

  async function changerStatut(id: string, statut: string) {
    // 1. Mettre à jour la réservation
    const { error } = await supabase.from('reservations').update({ statut }).eq('id', id)
    if (error) { Alert.alert('Erreur', error.message); return }

    // 2. Mettre à jour le statut de la voiture en conséquence
    const reservation = reservations.find(r => r.id === id)
    if (reservation?.voiture_id) {
      const statutVoiture = statut === 'confirmee' ? 'loue' : 'disponible'
      await supabase
        .from('voitures')
        .update({ statut: statutVoiture })
        .eq('id', reservation.voiture_id)
    }

    fetchReservations()
    fetchVoitures()
  }

  const taux = totalVoitures > 0 ? Math.round(((totalVoitures - disponibles) / totalVoitures) * 100) : 0
  const loues = totalVoitures - disponibles
  const enAttente = reservations.filter(r => r.statut === 'en_attente')

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
  )

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
    >
      {/* Status bar */}
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>Vue d'ensemble</Text>
          <Text style={s.headerTitle}>{nomAgence || 'Mon Agence'}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/ajouter-voiture' as any)}>
          <Text style={s.addBtnIcon}>＋</Text>
          <Text style={s.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI STRIP ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiStrip}>
        <KpiCard icon="💰" label="Revenus ce mois" value={`${formatAmount(revenusMois)} DA`} color={GOLD} />
        <KpiCard icon="📅" label="Réservations" value={String(totalRes)} color={BLUE_L} sub={`${enAttente.length} en attente`} />
        <KpiCard icon="📈" label="Bénéfice net" value={`${formatAmount(benefice)} DA`} color={GREEN} sub="≈ 82% des revenus" />
        <KpiCard icon="🚗" label="Flotte dispo" value={`${disponibles}/${totalVoitures}`} color={TEXT2} sub={`${taux}% occupé`} />
      </ScrollView>

      {/* ── WEEKLY CHART ── */}
      <View style={s.section}>
        <View style={s.sectionTop}>
          <Text style={s.sectionTitle}>Revenus hebdomadaires</Text>
          <View style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: GOLD }]} />
            <Text style={s.legendLabel}>Aujourd'hui</Text>
            <View style={[s.legendDot, { backgroundColor: BLUE, marginLeft: 10 }]} />
            <Text style={s.legendLabel}>Autres jours</Text>
          </View>
        </View>
        <View style={s.chartWrap}>
          {weekBars.map((bar, i) => (
            <View key={i} style={s.barCol}>
              {bar.val > 0 && (
                <Text style={s.barValue}>{formatAmount(bar.val)}</Text>
              )}
              <View style={s.barTrack}>
                <View style={[
                  s.barFill,
                  { height: bar.h, backgroundColor: bar.gold ? GOLD : BLUE_L },
                  bar.gold && s.barGlow,
                ]} />
              </View>
              <Text style={[s.barLabel, bar.gold && { color: GOLD, fontWeight: '700' }]}>{bar.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── OCCUPATION GAUGE ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Occupation de la flotte</Text>
        <View style={s.gaugeCard}>
          <View style={s.gaugeMeta}>
            <View style={s.gaugeItem}>
              <Text style={[s.gaugeNum, { color: BLUE_L }]}>{loues}</Text>
              <Text style={s.gaugeLabel}>Loués</Text>
            </View>
            <View style={s.gaugeDivider} />
            <View style={s.gaugeItem}>
              <Text style={[s.gaugeNum, { color: GREEN_L }]}>{disponibles}</Text>
              <Text style={s.gaugeLabel}>Disponibles</Text>
            </View>
            <View style={s.gaugeDivider} />
            <View style={s.gaugeItem}>
              <Text style={[s.gaugeNum, { color: TEXT }]}>{totalVoitures}</Text>
              <Text style={s.gaugeLabel}>Total</Text>
            </View>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${taux}%` as any }]} />
          </View>
          <View style={s.progressLabels}>
            <Text style={s.progressPct}>{taux}% occupé</Text>
            <Text style={s.progressPct}>{100 - taux}% libre</Text>
          </View>
        </View>
      </View>

      {/* ── PENDING RESERVATIONS ── */}
      <View style={s.section}>
        <View style={s.sectionTop}>
          <Text style={s.sectionTitle}>En attente</Text>
          {enAttente.length > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{enAttente.length}</Text>
            </View>
          )}
        </View>

        {enAttente.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={s.emptyText}>Aucune réservation en attente</Text>
          </View>
        ) : (
          enAttente.map(res => {
            const imgUrl = res.voitures?.image_url ?? null
            const nom = res.voitures?.nom ?? '—'
            const debut = res.date_debut?.slice(0, 10) ?? '—'
            const fin = res.date_fin?.slice(0, 10) ?? '—'
            const duree = Math.max(1, Math.round(
              (new Date(res.date_fin).getTime() - new Date(res.date_debut).getTime()) / 86400000
            ))
            return (
              <View key={res.id} style={s.pendingCard}>
                <View style={s.pendingThumb}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={s.pendingImg} resizeMode="cover" />
                  ) : (
                    <View style={s.pendingImgFallback}>
                      <Text style={{ fontSize: 26 }}>🚗</Text>
                    </View>
                  )}
                  <View style={s.pendingPill}>
                    <Text style={s.pendingPillText}>En attente</Text>
                  </View>
                </View>

                <View style={s.pendingBody}>
                  <View style={s.pendingRow}>
                    <Text style={s.pendingCarName} numberOfLines={1}>{nom}</Text>
                    <Text style={s.pendingAmount}>{(res.montant ?? 0).toLocaleString()} DA</Text>
                  </View>
                  <Text style={s.pendingDates}>📅 {debut} → {fin} · {duree}j</Text>

                  <View style={s.pendingActions}>
                    <TouchableOpacity
                      style={s.btnRefuse}
                      onPress={() => changerStatut(res.id, 'annulee')}
                    >
                      <Text style={s.btnRefuseText}>✕  Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.btnConfirm}
                      onPress={() => changerStatut(res.id, 'confirmee')}
                    >
                      <Text style={s.btnConfirmText}>✓  Confirmer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* ── RECENT CONFIRMED ── */}
      {reservations.filter(r => r.statut === 'confirmee').length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Récemment confirmées</Text>
          {reservations.filter(r => r.statut === 'confirmee').slice(0, 5).map(res => {
            const imgUrl = res.voitures?.image_url ?? null
            const nom = res.voitures?.nom ?? '—'
            return (
              <View key={res.id} style={s.confirmedRow}>
                <View style={s.confirmedThumb}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={s.confirmedImg} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 20 }}>🚗</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.confirmedName} numberOfLines={1}>{nom}</Text>
                  <Text style={s.confirmedDates}>{res.date_debut?.slice(0, 10)} → {res.date_fin?.slice(0, 10)}</Text>
                </View>
                <View style={s.confirmedBadge}>
                  <Text style={s.confirmedBadgeText}>✓ Confirmée</Text>
                </View>
                <Text style={s.confirmedAmount}>{(res.montant ?? 0).toLocaleString()} DA</Text>
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
    <View style={s.kpiCard}>
      <Text style={s.kpiIcon}>{icon}</Text>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      {sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },

  statusBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8,
  },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20,
  },
  headerSub: { fontSize: 12, color: TEXT3, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: TEXT },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BLUE, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  addBtnIcon: { color: '#fff', fontSize: 16, lineHeight: 18 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  kpiStrip: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  kpiCard: {
    width: 140, backgroundColor: CARD, borderRadius: 16,
    padding: 16, borderWidth: 0.5, borderColor: BORDER2,
  },
  kpiIcon: { fontSize: 22, marginBottom: 10 },
  kpiValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: TEXT2, fontWeight: '500' },
  kpiSub: { fontSize: 10, color: TEXT3, marginTop: 4 },

  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 10, color: TEXT3 },

  chartWrap: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: CARD, borderRadius: 16,
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
    borderWidth: 0.5, borderColor: BORDER2, gap: 0,
    height: 160,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontSize: 9, color: TEXT3, textAlign: 'center' },
  barTrack: { width: '60%', height: 100, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 6 },
  barGlow: { shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6 },
  barLabel: { fontSize: 10, color: TEXT3, fontWeight: '500' },

  gaugeCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 20,
    borderWidth: 0.5, borderColor: BORDER2,
  },
  gaugeMeta: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  gaugeItem: { alignItems: 'center', gap: 4 },
  gaugeNum: { fontSize: 26, fontWeight: '800' },
  gaugeLabel: { fontSize: 11, color: TEXT3 },
  gaugeDivider: { width: 1, backgroundColor: BORDER2, marginVertical: 4 },
  progressTrack: { height: 8, backgroundColor: CARD2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: BLUE, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPct: { fontSize: 11, color: TEXT3 },

  badge: {
    backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.4)',
  },
  badgeText: { color: GOLD_L, fontSize: 12, fontWeight: '700' },

  pendingCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 0.5, borderColor: BORDER2,
    overflow: 'hidden', marginBottom: 12,
  },
  pendingThumb: { width: '100%', height: 140, backgroundColor: CARD2, position: 'relative' },
  pendingImg: { width: '100%', height: '100%' },
  pendingImgFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pendingPill: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(245,158,11,0.25)',
    borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.5)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  pendingPillText: { color: GOLD_L, fontSize: 11, fontWeight: '600' },
  pendingBody: { padding: 14 },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pendingCarName: { fontSize: 15, fontWeight: '700', color: TEXT, flex: 1, marginRight: 8 },
  pendingAmount: { fontSize: 16, fontWeight: '800', color: GOLD },
  pendingDates: { fontSize: 12, color: TEXT2, marginBottom: 14 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  btnRefuse: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
  },
  btnRefuseText: { color: RED_L, fontSize: 13, fontWeight: '600' },
  btnConfirm: {
    flex: 1.6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: BLUE, alignItems: 'center',
  },
  btnConfirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  confirmedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14, padding: 12,
    borderWidth: 0.5, borderColor: BORDER2, marginBottom: 8,
  },
  confirmedThumb: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: CARD2,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  confirmedImg: { width: '100%', height: '100%' },
  confirmedName: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 2 },
  confirmedDates: { fontSize: 11, color: TEXT3 },
  confirmedBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.3)',
  },
  confirmedBadgeText: { fontSize: 10, color: GREEN_L, fontWeight: '600' },
  confirmedAmount: { fontSize: 13, fontWeight: '800', color: GOLD, minWidth: 70, textAlign: 'right' },

  emptyState: {
    backgroundColor: CARD, borderRadius: 16, padding: 30,
    borderWidth: 0.5, borderColor: BORDER2,
    alignItems: 'center', gap: 8,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: { color: TEXT2, fontSize: 14 },
})