import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Dimensions, Image, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// ─── Thème ────────────────────────────────────────────────────────────────────
const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'; const GREEN = '#10B981'
const RED = '#EF4444'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

const { width: SW } = Dimensions.get('window')

// ─── Types ────────────────────────────────────────────────────────────────────
type Voiture = {
  id: string; nom: string; agence: string
  prix: number; note: number; carburant: string
  boite: string; places: number; km_jour: number
  wilaya: string; statut: string; categorie: string
  image_url: string | null; description: string | null
  annee: number | null; climatisation: boolean | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000)
}

function diffDays(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function displayDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Sélecteur de durée simple ────────────────────────────────────────────────
function DureeSelector({
  duree, onChange
}: { duree: number; onChange: (n: number) => void }) {
  const options = [1, 2, 3, 5, 7, 14]
  return (
    <View style={ds.dureeRow}>
      {options.map(n => (
        <TouchableOpacity
          key={n}
          style={[ds.dureeChip, duree === n && ds.dureeChipActive]}
          onPress={() => onChange(n)}
        >
          <Text style={[ds.dureeChipText, duree === n && ds.dureeChipTextActive]}>
            {n}j
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Spec chip ────────────────────────────────────────────────────────────────
function SpecChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={ds.specChip}>
      <Text style={ds.specIcon}>{icon}</Text>
      <Text style={ds.specLabel}>{label}</Text>
    </View>
  )
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function VoitureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()

  const [voiture, setVoiture] = useState<Voiture | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavori, setIsFavori] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  // Dates de réservation
  const today = new Date()
  const [dateDebut] = useState(formatDate(today))
  const [duree, setDuree] = useState(3)
  const dateFin = formatDate(addDays(today, duree))
  const total = (voiture?.prix ?? 0) * duree

  useEffect(() => {
    if (id) {
      fetchVoiture()
      if (session?.user?.id) checkFavori()
    }
  }, [id])

  async function fetchVoiture() {
    setLoading(true)
    const { data, error } = await supabase
      .from('voitures')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      Alert.alert('Erreur', 'Impossible de charger cette voiture.')
      router.back()
      return
    }
    setVoiture(data)
    setLoading(false)
  }

  async function checkFavori() {
    const { data } = await supabase
      .from('favoris')
      .select('id')
      .eq('user_id', session!.user.id)
      .eq('voiture_id', id)
      .maybeSingle()
    setIsFavori(!!data)
  }

  async function toggleFavori() {
    if (!session?.user?.id) {
      router.push('/login' as any); return
    }
    setFavLoading(true)
    if (isFavori) {
      await supabase.from('favoris')
        .delete()
        .eq('user_id', session.user.id)
        .eq('voiture_id', id)
      setIsFavori(false)
    } else {
      await supabase.from('favoris')
        .insert({ user_id: session.user.id, voiture_id: id })
      setIsFavori(true)
    }
    setFavLoading(false)
  }

  function handleReserver() {
    if (!session?.user?.id) {
      router.push('/login' as any); return
    }
    if (voiture?.statut === 'loue') {
      Alert.alert('Indisponible', 'Ce véhicule est actuellement loué.')
      return
    }
    router.push(
      `/reservation?id=${id}&date_debut=${dateDebut}&date_fin=${dateFin}` as any
    )
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[ds.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    )
  }

  if (!voiture) return null

  const dispo = voiture.statut !== 'loue'

  return (
    <View style={ds.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Image hero ────────────────────────────────────────────────────── */}
        <View style={ds.heroBox}>
          {voiture.image_url ? (
            <Image
              source={{ uri: voiture.image_url }}
              style={ds.heroImg}
              resizeMode="cover"
            />
          ) : (
            <View style={ds.heroPlaceholder}>
              <Ionicons name="car-sport" size={80} color={TEXT3} />
            </View>
          )}

          {/* Overlay dégradé bas */}
          <View style={ds.heroOverlay} />

          {/* Bouton retour */}
          <TouchableOpacity style={ds.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </TouchableOpacity>

          {/* Bouton favori */}
          <TouchableOpacity style={ds.heartBtn} onPress={toggleFavori} disabled={favLoading}>
            <Ionicons
              name={isFavori ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavori ? RED : TEXT}
            />
          </TouchableOpacity>

          {/* Badge statut */}
          <View style={[ds.heroBadge, dispo ? ds.badgeDispo : ds.badgeLoue]}>
            <Text style={[ds.heroBadgeText, { color: dispo ? '#34D399' : '#FCA5A5' }]}>
              {dispo ? 'Disponible' : 'Loué'}
            </Text>
          </View>

          {/* Prix en overlay bas */}
          <View style={ds.heroPriceBox}>
            <Text style={ds.heroPrice}>
              {voiture.prix.toLocaleString('fr-DZ')} DA
              <Text style={ds.heroPriceSub}> / jour</Text>
            </Text>
            <Text style={ds.heroRating}>⭐ {voiture.note ?? 5.0}
              <Text style={ds.heroRatingSub}> (42)</Text>
            </Text>
          </View>
        </View>

        {/* ── Infos principales ─────────────────────────────────────────────── */}
        <View style={ds.mainCard}>
          <Text style={ds.carName}>{voiture.nom}</Text>
          {!!voiture.annee && (
            <Text style={ds.carYear}>Année {voiture.annee}</Text>
          )}
          <View style={ds.agenceRow}>
            <Ionicons name="business-outline" size={14} color={TEXT2} />
            <Text style={ds.agenceText}>{voiture.agence}</Text>
            {!!voiture.wilaya && (
              <>
                <Text style={ds.dot}>·</Text>
                <Ionicons name="location-outline" size={14} color={TEXT2} />
                <Text style={ds.agenceText}>{voiture.wilaya}</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Spécifications ────────────────────────────────────────────────── */}
        <View style={ds.section}>
          <Text style={ds.sectionTitle}>Caractéristiques</Text>
          <View style={ds.specsGrid}>
            <SpecChip icon="⛽" label={voiture.carburant ?? 'Essence'} />
            <SpecChip icon="⚙️" label={voiture.boite ?? 'Manuelle'} />
            <SpecChip icon="👥" label={`${voiture.places ?? 5} places`} />
            <SpecChip icon="🛣️" label={`${voiture.km_jour ?? 300} km/j`} />
            <SpecChip icon="🏷️" label={voiture.categorie ?? 'Économique'} />
            {voiture.climatisation && <SpecChip icon="❄️" label="Climatisation" />}
          </View>
        </View>

        {/* ── Description ───────────────────────────────────────────────────── */}
        {!!voiture.description && (
          <View style={ds.section}>
            <Text style={ds.sectionTitle}>Description</Text>
            <Text style={ds.description}>{voiture.description}</Text>
          </View>
        )}

        {/* ── Sélecteur de durée ────────────────────────────────────────────── */}
        <View style={ds.section}>
          <Text style={ds.sectionTitle}>Durée de location</Text>

          <DureeSelector duree={duree} onChange={setDuree} />

          {/* Récap dates */}
          <View style={ds.datesRow}>
            <View style={ds.dateBox}>
              <Text style={ds.dateLabel}>Départ</Text>
              <Text style={ds.dateValue}>{displayDate(dateDebut)}</Text>
            </View>
            <View style={ds.dateArrow}>
              <Ionicons name="arrow-forward" size={18} color={TEXT3} />
            </View>
            <View style={ds.dateBox}>
              <Text style={ds.dateLabel}>Retour</Text>
              <Text style={ds.dateValue}>{displayDate(dateFin)}</Text>
            </View>
          </View>

          {/* Total */}
          <View style={ds.totalBox}>
            <Text style={ds.totalLabel}>Total estimé</Text>
            <Text style={ds.totalValue}>{total.toLocaleString('fr-DZ')} DA</Text>
          </View>
        </View>

        {/* ── Conditions ────────────────────────────────────────────────────── */}
        <View style={ds.section}>
          <Text style={ds.sectionTitle}>Conditions</Text>
          <View style={ds.condCard}>
            {[
              { icon: '📄', text: 'Permis de conduire obligatoire' },
              { icon: '🪪', text: 'Carte nationale d\'identité' },
              { icon: '💰', text: 'Caution : 20 000 DA' },
              { icon: '🚗', text: 'Conducteur minimum 21 ans' },
            ].map((c, i) => (
              <View key={i} style={[ds.condItem, i > 0 && { borderTopWidth: 1, borderTopColor: BORDER }]}>
                <Text style={ds.condIcon}>{c.icon}</Text>
                <Text style={ds.condText}>{c.text}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Footer fixe ───────────────────────────────────────────────────────── */}
      <View style={ds.footer}>
        <View style={ds.footerLeft}>
          <Text style={ds.footerPrice}>{voiture.prix.toLocaleString('fr-DZ')} DA</Text>
          <Text style={ds.footerSub}>/ jour · {duree}j = {total.toLocaleString('fr-DZ')} DA</Text>
        </View>
        <TouchableOpacity
          style={[ds.reserveBtn, !dispo && ds.reserveBtnDisabled]}
          onPress={handleReserver}
          activeOpacity={0.85}
        >
          <Text style={ds.reserveBtnText}>
            {dispo ? 'Réserver' : 'Indisponible'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },

  // Hero
  heroBox: { width: SW, height: 280, backgroundColor: CARD2, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    // Dégradé simulé par une vue semi-transparente
    backgroundColor: 'rgba(10,22,40,0.55)',
  },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(10,22,40,0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: BORDER2,
  },
  heartBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, right: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(10,22,40,0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: BORDER2,
  },
  heroBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 22,
    left: '50%', transform: [{ translateX: -44 }],
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  badgeDispo: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.3)' },
  badgeLoue: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.3)' },
  heroBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroPriceBox: {
    position: 'absolute', bottom: 14, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  heroPrice: { fontSize: 22, fontWeight: '800', color: GOLD },
  heroPriceSub: { fontSize: 13, fontWeight: '400', color: TEXT2 },
  heroRating: { fontSize: 14, fontWeight: '600', color: TEXT },
  heroRatingSub: { fontSize: 12, color: TEXT2 },

  // Infos principales
  mainCard: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  carName: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  carYear: { fontSize: 13, color: TEXT2, marginBottom: 6 },
  agenceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  agenceText: { fontSize: 13, color: TEXT2 },
  dot: { color: TEXT3, marginHorizontal: 2 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 12 },

  // Specs
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CARD, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, borderWidth: 0.5, borderColor: BORDER2,
  },
  specIcon: { fontSize: 14 },
  specLabel: { fontSize: 13, color: TEXT2, fontWeight: '500' },

  // Description
  description: { fontSize: 14, color: TEXT2, lineHeight: 22 },

  // Sélecteur durée
  dureeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dureeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 0.5, borderColor: BORDER2,
    alignItems: 'center',
  },
  dureeChipActive: { backgroundColor: BLUE, borderColor: BLUE },
  dureeChipText: { fontSize: 13, fontWeight: '600', color: TEXT2 },
  dureeChipTextActive: { color: '#fff' },

  // Dates
  datesRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 0.5, borderColor: BORDER2,
    padding: 16, marginBottom: 12,
  },
  dateBox: { flex: 1 },
  dateLabel: { fontSize: 11, color: TEXT3, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateValue: { fontSize: 14, fontWeight: '700', color: TEXT },
  dateArrow: { paddingHorizontal: 12 },

  // Total
  totalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: CARD2, borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: BORDER2,
  },
  totalLabel: { fontSize: 14, color: TEXT2, fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '800', color: GOLD },

  // Conditions
  condCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER2, overflow: 'hidden' },
  condItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  condIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  condText: { fontSize: 13, color: TEXT2, flex: 1 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: NAVY,
    borderTopWidth: 1, borderTopColor: BORDER,
    gap: 16,
  },
  footerLeft: { flex: 1 },
  footerPrice: { fontSize: 17, fontWeight: '800', color: GOLD },
  footerSub: { fontSize: 11, color: TEXT2, marginTop: 2 },
  reserveBtn: {
    backgroundColor: GOLD, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 16,
  },
  reserveBtnDisabled: { backgroundColor: TEXT3, opacity: 0.7 },
  reserveBtnText: { color: NAVY, fontSize: 16, fontWeight: '800' },
})
