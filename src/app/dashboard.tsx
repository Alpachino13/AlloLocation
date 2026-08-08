import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Dimensions, Image, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, STATUS_COLORS, formatDA } from '../constants'
import { envoyerNotification } from '../lib/notifications'

const { width: SW } = Dimensions.get('window')
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Reservation = {
  id: string; voiture_id: string; user_id: string; statut: string
  date_debut: string; date_fin: string; montant: number; created_at: string
  voitures: { nom: string; agence_id?: string; image_url?: string | null } | null
  profils?: { nom?: string; telephone?: string } | null
}
type WeekBar = { lbl: string; val: number; h: number; today: boolean }

function buildWeekBars(reservations: Reservation[]): WeekBar[] {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  monday.setHours(0, 0, 0, 0)
  const totals = Array(7).fill(0)
  for (const r of reservations) {
    if (r.statut !== 'confirmee') continue
    const d = new Date(r.date_debut); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) totals[diff] += r.montant ?? 0
  }
  const maxVal = Math.max(...totals, 1)
  return totals.map((v, i) => ({ lbl: DAY_LABELS[i], val: v, h: Math.max(4, Math.round((v / maxVal) * 80)), today: i === dayOfWeek }))
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── KPI card ──────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, sub }: {
  icon: string; label: string; value: string; color: string; sub?: string
}) {
  return (
    <View style={s.kpiCard}>
      <View style={[s.kpiIconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  )
}

// ── Pending card ──────────────────────────────────────────────
function PendingCard({ res, onConfirm, onRefuse }: {
  res: Reservation; onConfirm: () => void; onRefuse: () => void
}) {
  const nom = res.voitures?.nom ?? '—'
  const imgUrl = res.voitures?.image_url ?? null
  const debut = res.date_debut?.slice(0, 10) ?? '—'
  const fin   = res.date_fin?.slice(0, 10) ?? '—'
  const duree = Math.max(1, Math.round((new Date(res.date_fin).getTime() - new Date(res.date_debut).getTime()) / 86400000))
  const client = (res as any).profils?.nom ?? ''
  const tel    = (res as any).profils?.telephone ?? ''

  return (
    <View style={s.pendingCard}>
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={s.pendingImg} resizeMode="cover" />
      ) : (
        <View style={[s.pendingImg, s.pendingImgFallback]}>
          <Ionicons name="car-sport" size={28} color={COLORS.text3} />
        </View>
      )}
      <View style={s.pendingPill}>
        <View style={[s.dot, { backgroundColor: COLORS.gold }]} />
        <Text style={s.pendingPillText}>En attente</Text>
      </View>

      <View style={s.pendingBody}>
        <View style={s.pendingTitleRow}>
          <Text style={s.pendingCarName} numberOfLines={1}>{nom}</Text>
          <Text style={s.pendingAmount}>{formatDA(res.montant ?? 0)}</Text>
        </View>
        <View style={s.pendingMeta}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.text3} />
          <Text style={s.pendingMetaText}>{debut} → {fin} · {duree}j</Text>
        </View>
        {client ? (
          <View style={s.pendingMeta}>
            <Ionicons name="person-outline" size={12} color={COLORS.text3} />
            <Text style={s.pendingMetaText}>{client}{tel ? ` · ${tel}` : ''}</Text>
          </View>
        ) : null}

        <View style={s.pendingActions}>
          <TouchableOpacity style={s.btnRefuse} onPress={onRefuse} activeOpacity={0.8}>
            <Ionicons name="close" size={15} color={COLORS.redLight} />
            <Text style={s.btnRefuseText}>Refuser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnConfirm} onPress={onConfirm} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={15} color="#fff" />
            <Text style={s.btnConfirmText}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default function Dashboard() {
  const router  = useRouter()
  const { session } = useAuth()
  const insets  = useSafeAreaInsets()

  const [nomAgence, setNomAgence]       = useState('')
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [totalVoitures, setTotalVoitures] = useState(0)
  const [disponibles, setDisponibles]   = useState(0)
  const [totalRes, setTotalRes]         = useState(0)
  const [revenusMois, setRevenusMois]   = useState(0)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [weekBars, setWeekBars]         = useState<WeekBar[]>(
    DAY_LABELS.map((lbl, i) => ({ lbl, val: 0, h: 4, today: false }))
  )

  // Ids de la flotte de l'agence, pour filtrer les événements realtime
  // (reservations.user_id est le client, pas l'agence)
  const voitureIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (session) { charger(); fetchNomAgence() }
    const ch = subscribeReservations()
    return () => { if (ch) supabase.removeChannel(ch) }
  }, [session])

  function subscribeReservations() {
    if (!session?.user?.id) return null
    return supabase.channel('dash-res')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          const row = (payload.new as any) ?? (payload.old as any)
          const voitureId = row?.voiture_id
          if (!voitureId || !voitureIdsRef.current.has(voitureId)) return
          fetchReservations(); fetchVoitures()
        })
      .subscribe()
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
    const { data } = await supabase.from('voitures').select('id,statut').eq('agence_id', session.user.id)
    if (data) {
      setTotalVoitures(data.length)
      setDisponibles(data.filter(v => v.statut === 'disponible').length)
      voitureIdsRef.current = new Set(data.map(v => v.id))
    }
  }

  async function fetchReservations() {
    if (!session) return
    const { data } = await supabase
      .from('reservations')
      .select('id,voiture_id,user_id,statut,date_debut,date_fin,montant,created_at,voitures!inner(nom,agence_id,image_url),profils!user_id(nom,telephone)')
      .eq('voitures.agence_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setReservations(data as any)
      setTotalRes(data.length)
      const mois = new Date().getMonth()
      const rev = data.filter((r: any) => r.statut === 'confirmee' && new Date(r.date_debut).getMonth() === mois)
        .reduce((acc: number, r: any) => acc + (r.montant ?? 0), 0)
      setRevenusMois(rev)
      setWeekBars(buildWeekBars(data as any))
    }
  }

  async function changerStatut(id: string, statut: string) {
    const { error } = await supabase.from('reservations').update({ statut }).eq('id', id)
    if (error) { Alert.alert('Erreur', error.message); return }
    const res = reservations.find(r => r.id === id)
    if (res?.voiture_id) {
      await supabase.from('voitures').update({ statut: statut === 'confirmee' ? 'loue' : 'disponible' }).eq('id', res.voiture_id)
    }
    if ((statut === 'confirmee' || statut === 'annulee') && res?.user_id) {
      // Push notification native + in-app notification
      await envoyerNotification({
        targetUserId: res.user_id,
        titre: statut === 'confirmee' ? '✅ Réservation confirmée !' : '❌ Réservation refusée',
        message: statut === 'confirmee'
          ? `Votre réservation pour ${res.voitures?.nom ?? '—'} a été confirmée. Bonne route !`
          : `Votre réservation pour ${res.voitures?.nom ?? '—'} a été refusée par l'agence.`,
        type: statut === 'confirmee' ? 'confirmation' : 'annulation',
      })
    }
    fetchReservations(); fetchVoitures()
  }

  const loues      = totalVoitures - disponibles
  const taux       = totalVoitures > 0 ? Math.round((loues / totalVoitures) * 100) : 0
  const enAttente  = reservations.filter(r => r.statut === 'en_attente')
  const confirmees = reservations.filter(r => r.statut === 'confirmee').slice(0, 5)
  const tauxConf   = totalRes > 0 ? Math.round(reservations.filter(r => r.statut === 'confirmee').length / totalRes * 100) : 0

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.navyLight, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    )
  }

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
      contentContainerStyle={{ paddingBottom: 80 }}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub}>Tableau de bord</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{nomAgence || 'Mon Agence'}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/ajouter-voiture')} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI Strip ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiStrip}>
        <KpiCard icon="cash-outline"          label="Revenus mois"   value={fmt(revenusMois) + ' DA'} color={COLORS.gold}       sub="ce mois" />
        <KpiCard icon="calendar-outline"      label="Réservations"   value={String(totalRes)}          color={COLORS.blueLight}  sub={enAttente.length ? `${enAttente.length} en attente` : 'toutes traitées'} />
        <KpiCard icon="car-sport-outline"     label="Flotte dispo"   value={`${disponibles}/${totalVoitures}`} color={COLORS.greenLight} sub={`${taux}% occupé`} />
        <KpiCard icon="checkmark-done-outline" label="Taux conf."    value={`${tauxConf}%`}            color={COLORS.text2} />
      </ScrollView>

      {/* ── Weekly Chart ── */}
      <View style={s.section}>
        <View style={s.sectionTop}>
          <Text style={s.sectionTitle}>Revenus — cette semaine</Text>
          <View style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: COLORS.gold }]} />
            <Text style={s.legendText}>Aujourd'hui</Text>
          </View>
        </View>
        <View style={s.chart}>
          {weekBars.map((bar, i) => (
            <View key={i} style={s.barCol}>
              {bar.val > 0 && <Text style={s.barVal}>{fmt(bar.val)}</Text>}
              <View style={s.barTrack}>
                <View style={[s.barFill, {
                  height: bar.h,
                  backgroundColor: bar.today ? COLORS.gold : COLORS.blue,
                  opacity: bar.today ? 1 : 0.65,
                }]} />
              </View>
              <Text style={[s.barLbl, bar.today && { color: COLORS.gold, fontWeight: '700' }]}>{bar.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Fleet Occupation ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Occupation flotte</Text>
        <View style={s.fleetCard}>
          <View style={s.fleetNumbers}>
            <View style={s.fleetNum}>
              <Text style={[s.fleetVal, { color: COLORS.blueLight }]}>{loues}</Text>
              <Text style={s.fleetLbl}>Loués</Text>
            </View>
            <View style={s.fleetDivider} />
            <View style={s.fleetNum}>
              <Text style={[s.fleetVal, { color: COLORS.greenLight }]}>{disponibles}</Text>
              <Text style={s.fleetLbl}>Libres</Text>
            </View>
            <View style={s.fleetDivider} />
            <View style={s.fleetNum}>
              <Text style={[s.fleetVal, { color: COLORS.text }]}>{totalVoitures}</Text>
              <Text style={s.fleetLbl}>Total</Text>
            </View>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${taux}%` as any }]} />
          </View>
          <View style={s.progressLabels}>
            <Text style={s.progressTxt}>{taux}% occupé</Text>
            <Text style={s.progressTxt}>{100 - taux}% libre</Text>
          </View>
        </View>
      </View>

      {/* ── Pending Reservations ── */}
      <View style={s.section}>
        <View style={s.sectionTop}>
          <Text style={s.sectionTitle}>En attente</Text>
          {enAttente.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{enAttente.length}</Text>
            </View>
          )}
        </View>
        {enAttente.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={36} color={COLORS.green} />
            <Text style={s.emptyStateText}>Toutes les demandes sont traitées</Text>
          </View>
        ) : (
          enAttente.map(res => (
            <PendingCard
              key={res.id}
              res={res}
              onConfirm={() => changerStatut(res.id, 'confirmee')}
              onRefuse={() => Alert.alert('Refuser ?', 'Cette action est irréversible.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Refuser', style: 'destructive', onPress: () => changerStatut(res.id, 'annulee') },
              ])}
            />
          ))
        )}
      </View>

      {/* ── Recent Confirmed ── */}
      {confirmees.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dernières confirmées</Text>
          <View style={s.confirmedList}>
            {confirmees.map(res => {
              const st = STATUS_COLORS['confirmee']
              return (
                <View key={res.id} style={s.confirmedRow}>
                  <View style={s.confirmedThumb}>
                    {res.voitures?.image_url ? (
                      <Image source={{ uri: res.voitures.image_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                    ) : (
                      <Ionicons name="car-sport" size={18} color={COLORS.text3} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.confirmedName} numberOfLines={1}>{res.voitures?.nom ?? '—'}</Text>
                    <Text style={s.confirmedDates}>{res.date_debut?.slice(0, 10)} → {res.date_fin?.slice(0, 10)}</Text>
                  </View>
                  <View style={[s.confirmedBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <Text style={[s.confirmedBadgeText, { color: st.color }]}>Confirmée</Text>
                  </View>
                  <Text style={s.confirmedAmount}>{formatDA(res.montant ?? 0)}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.navyLight },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerSub:    { fontSize: 11, color: COLORS.text3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.blue, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, shadowColor: COLORS.blue, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  addBtnText:   { color: '#fff', fontSize: 13, fontWeight: '700' },

  kpiStrip:     { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  kpiCard:      { width: 140, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border2 },
  kpiIconBox:   { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  kpiValue:     { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  kpiLabel:     { fontSize: 11, color: COLORS.text2, fontWeight: '500' },
  kpiSub:       { fontSize: 10, color: COLORS.text3, marginTop: 3 },

  section:      { paddingHorizontal: 20, marginTop: 24 },
  sectionTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText:   { fontSize: 11, color: COLORS.text3 },
  dot:          { width: 7, height: 7, borderRadius: 4 },

  chart:        { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: COLORS.card, borderRadius: 16, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, borderWidth: 1, borderColor: COLORS.border2, height: 148 },
  barCol:       { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barVal:       { fontSize: 8, color: COLORS.text3, textAlign: 'center' },
  barTrack:     { width: '55%', height: 80, justifyContent: 'flex-end' },
  barFill:      { width: '100%', borderRadius: 4, minHeight: 4 },
  barLbl:       { fontSize: 10, color: COLORS.text3, fontWeight: '500' },

  fleetCard:    { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border2 },
  fleetNumbers: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 18 },
  fleetNum:     { alignItems: 'center', gap: 4 },
  fleetVal:     { fontSize: 28, fontWeight: '800' },
  fleetLbl:     { fontSize: 11, color: COLORS.text3 },
  fleetDivider: { width: 1, backgroundColor: COLORS.border2, marginVertical: 4 },
  progressTrack:  { height: 8, backgroundColor: COLORS.card2, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:   { height: '100%', backgroundColor: COLORS.blue, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTxt:    { fontSize: 11, color: COLORS.text3 },

  countBadge:     { backgroundColor: COLORS.goldMuted, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  countBadgeText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },

  emptyState:     { backgroundColor: COLORS.card, borderRadius: 16, padding: 28, borderWidth: 1, borderColor: COLORS.border2, alignItems: 'center', gap: 10 },
  emptyStateText: { color: COLORS.text2, fontSize: 14, textAlign: 'center' },

  pendingCard:        { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border2, overflow: 'hidden', marginBottom: 12 },
  pendingImg:         { width: '100%', height: 140 },
  pendingImgFallback: { backgroundColor: COLORS.card2, justifyContent: 'center', alignItems: 'center' },
  pendingPill:        { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(8,15,30,0.7)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendingPillText:    { color: COLORS.gold, fontSize: 11, fontWeight: '600' },
  pendingBody:        { padding: 14 },
  pendingTitleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pendingCarName:     { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  pendingAmount:      { fontSize: 16, fontWeight: '800', color: COLORS.gold },
  pendingMeta:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  pendingMetaText:    { fontSize: 12, color: COLORS.text2 },
  pendingActions:     { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnRefuse:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.redMuted, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  btnRefuseText:      { color: COLORS.redLight, fontSize: 13, fontWeight: '600' },
  btnConfirm:         { flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.blue },
  btnConfirmText:     { color: '#fff', fontSize: 13, fontWeight: '700' },

  confirmedList:      { gap: 8 },
  confirmedRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border2 },
  confirmedThumb:     { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.card2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
  confirmedName:      { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  confirmedDates:     { fontSize: 11, color: COLORS.text3 },
  confirmedBadge:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, flexShrink: 0 },
  confirmedBadgeText: { fontSize: 10, fontWeight: '600' },
  confirmedAmount:    { fontSize: 13, fontWeight: '800', color: COLORS.gold, minWidth: 72, textAlign: 'right', flexShrink: 0 },
})
