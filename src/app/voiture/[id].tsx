import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Dimensions, Image, Linking, Platform,
  ScrollView, Share, StyleSheet, Text, TouchableOpacity, View
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { COLORS, formatDA } from '../../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { openMapsDirections, formatCoords } from '../../lib/location'

const { width: SW } = Dimensions.get('window')

// ─── Types ──────────────────────────────────────────────────────────────────
type Voiture = {
  id: string; nom: string; agence: string; agence_id: string
  prix: number; note: number; carburant: string
  boite: string; places: number; km_jour: number
  wilaya: string; statut: string; categorie: string
  image_url: string | null; description: string | null
  annee: number | null; climatisation: boolean | null
  telephone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000)
}

function displayDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short' })
}

// ─── Sélecteur de durée ────────────────────────────────────────────────
function DureeSelector({ duree, onChange }: { duree: number; onChange: (n: number) => void }) {
  const options = [1, 2, 3, 5, 7, 14, 30]
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
    </ScrollView>
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
  const insets = useSafeAreaInsets()

  const [voiture, setVoiture] = useState<Voiture | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavori, setIsFavori] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [imageError, setImageError] = useState(false)

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

    // Récupérer le téléphone de l'agence
    if (data.agence_id) {
      const { data: profil } = await supabase.from('profils').select('telephone').eq('id', data.agence_id).single()
      if (profil?.telephone) {
        data.telephone = profil.telephone
      }
    }

    setVoiture(data)
    setLoading(false)
  }

  async function checkFavori() {
    const { data } = await supabase
      .from('favoris').select('id')
      .eq('user_id', session!.user.id)
      .eq('voiture_id', id)
      .maybeSingle()
    setIsFavori(!!data)
  }

  async function toggleFavori() {
    if (!session?.user?.id) { router.push('/login'); return }
    setFavLoading(true)
    if (isFavori) {
      await supabase.from('favoris').delete().eq('user_id', session.user.id).eq('voiture_id', id)
      setIsFavori(false)
    } else {
      await supabase.from('favoris').insert({ user_id: session.user.id, voiture_id: id })
      setIsFavori(true)
    }
    setFavLoading(false)
  }

  async function handleShare() {
    if (!voiture) return
    try {
      await Share.share({
        message: `🚗 ${voiture.nom} - ${formatDA(voiture.prix)}/jour sur AlloLocation\nDisponible à ${voiture.wilaya}`,
        title: voiture.nom,
      })
    } catch { }
  }

  function handleDirections() {
    if (voiture?.latitude && voiture?.longitude) {
      openMapsDirections(voiture.latitude, voiture.longitude, voiture.nom)
    }
  }

  function handleCall() {
    if (voiture?.telephone) {
      Linking.openURL(`tel:${voiture.telephone}`)
    } else {
      Alert.alert('Info', 'Numéro de téléphone non disponible')
    }
  }

  function handleReserver() {
    if (!session?.user?.id) { router.push('/login'); return }
    if (voiture?.statut === 'loue') {
      Alert.alert('Indisponible', 'Ce véhicule est actuellement loué.')
      return
    }
    router.push(`/reservation?id=${id}&date_debut=${dateDebut}&date_fin=${dateFin}`)
  }

  if (loading) {
    return (
      <View style={[ds.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    )
  }

  if (!voiture) return null
  const dispo = voiture.statut === 'disponible'

  return (
    <View style={ds.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* ── Image hero ────────────────────────────────────────────────────── */}
        <View style={ds.heroBox}>
          {voiture.image_url && !imageError ? (
            <Image source={{ uri: voiture.image_url }} style={ds.heroImg} resizeMode="cover" onError={() => setImageError(true)} />
          ) : (
            <View style={ds.heroPlaceholder}>
              <Ionicons name="car-sport" size={80} color={COLORS.text3} />
            </View>
          )}
          <View style={ds.heroOverlay} />

          <TouchableOpacity style={[ds.iconBtn, { left: 16, top: insets.top + 8 }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[ds.iconBtn, { right: 64, top: insets.top + 8 }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[ds.iconBtn, { right: 16, top: insets.top + 8 }]} onPress={toggleFavori} disabled={favLoading}>
            <Ionicons name={isFavori ? 'heart' : 'heart-outline'} size={20} color={isFavori ? COLORS.red : COLORS.text} />
          </TouchableOpacity>

          <View style={[ds.heroBadge, dispo ? ds.badgeDispo : ds.badgeLoue]}>
            <Text style={[ds.heroBadgeText, { color: dispo ? COLORS.greenLight : COLORS.redLight }]}>
              {dispo ? 'Disponible' : 'Loué'}
            </Text>
          </View>

          <View style={ds.heroPriceBox}>
            <Text style={ds.heroPrice}>{formatDA(voiture.prix)}<Text style={ds.heroPriceSub}> / jour</Text></Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={14} color={COLORS.gold} />
              <Text style={ds.heroRating}>{voiture.note ?? 5.0}<Text style={ds.heroRatingSub}> (42 avis)</Text></Text>
            </View>
          </View>
        </View>

        {/* ── Infos principales ─────────────────────────────────────────────── */}
        <View style={ds.mainCard}>
          <Text style={ds.carName}>{voiture.nom}</Text>
          {!!voiture.annee && <Text style={ds.carYear}>Année {voiture.annee}</Text>}
          <View style={ds.agenceRow}>
            <Ionicons name="business-outline" size={14} color={COLORS.text2} />
            <Text style={ds.agenceText}>{voiture.agence}</Text>
            {!!voiture.wilaya && (
              <>
                <Text style={ds.dot}>·</Text>
                <Ionicons name="location-outline" size={14} color={COLORS.text2} />
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
          <View style={ds.datesRow}>
            <View style={ds.dateBox}>
              <Text style={ds.dateLabel}>Départ</Text>
              <Text style={ds.dateValue}>{displayDate(dateDebut)}</Text>
            </View>
            <View style={ds.dateArrow}>
              <Ionicons name="arrow-forward" size={18} color={COLORS.text3} />
            </View>
            <View style={ds.dateBox}>
              <Text style={ds.dateLabel}>Retour</Text>
              <Text style={ds.dateValue}>{displayDate(dateFin)}</Text>
            </View>
          </View>
          <View style={ds.totalBox}>
            <Text style={ds.totalLabel}>Total estimé</Text>
            <Text style={ds.totalValue}>{formatDA(total)}</Text>
          </View>
        </View>

        {/* ── Localisation ──────────────────────────────────────────────────── */}
        {voiture.latitude && voiture.longitude && (
          <View style={ds.section}>
            <Text style={ds.sectionTitle}>Localisation</Text>
            <TouchableOpacity style={ds.locCard} onPress={handleDirections} activeOpacity={0.85}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={ds.locIconBox}>
                  <Ionicons name="location" size={22} color={COLORS.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ds.locLabel}>Position GPS enregistrée</Text>
                  <Text style={ds.locCoords}>{formatCoords(voiture.latitude, voiture.longitude)}</Text>
                </View>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Ionicons name="navigate-circle" size={28} color={COLORS.blue} />
                  <Text style={{ fontSize: 10, color: COLORS.blueLight, fontWeight: '600' }}>Y ALLER</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Conditions ────────────────────────────────────────────────────── */}
        <View style={ds.section}>
          <Text style={ds.sectionTitle}>Conditions de location</Text>
          <View style={ds.condCard}>
            {[
              { icon: '📄', text: 'Permis de conduire algérien valide' },
              { icon: '🪪', text: `Carte nationale d'identité (CNI)` },
              { icon: '💰', text: 'Caution : 20 000 DA (remboursable)' },
              { icon: '🚗', text: 'Âge minimum : 21 ans' },
              { icon: '⛽', text: `Véhicule à rendre avec le même niveau d'essence` },
            ].map((c, i) => (
              <View key={i} style={[ds.condItem, i > 0 && { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                <Text style={ds.condIcon}>{c.icon}</Text>
                <Text style={ds.condText}>{c.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Contact agence ───────────────────────────────────────────────────── */}
        {voiture.telephone && (
          <View style={ds.section}>
            <Text style={ds.sectionTitle}>Contacter l'agence</Text>
            <TouchableOpacity style={ds.contactCard} onPress={handleCall}>
              <Ionicons name="call" size={20} color={COLORS.green} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={ds.contactLabel}>Téléphone</Text>
                <Text style={ds.contactValue}>{voiture.telephone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.text3} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Footer fixe ───────────────────────────────────────────────────────── */}
      <View style={[ds.footer, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 12 : 16 }]}>
        <View style={ds.footerLeft}>
          <Text style={ds.footerPrice}>{formatDA(voiture.prix)}</Text>
          <Text style={ds.footerSub}>/ jour · {duree}j = {formatDA(total)}</Text>
        </View>
        <TouchableOpacity style={[ds.reserveBtn, !dispo && ds.reserveBtnDisabled]} onPress={handleReserver} activeOpacity={0.85}>
          <Text style={ds.reserveBtnText}>{dispo ? 'Réserver maintenant' : 'Indisponible'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  heroBox: { width: SW, height: 300, backgroundColor: COLORS.card2, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(10,22,40,0.6)' },
  iconBtn: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(10,22,40,0.7)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border3 },
  heroBadge: { position: 'absolute', top: 16, left: '50%', transform: [{ translateX: -50 }], paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  badgeDispo: { backgroundColor: 'rgba(16,185,129,0.25)', borderWidth: 0.5, borderColor: 'rgba(52,211,153,0.4)' },
  badgeLoue: { backgroundColor: 'rgba(239,68,68,0.25)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.4)' },
  heroBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroPriceBox: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroPrice: { fontSize: 24, fontWeight: '800', color: COLORS.gold },
  heroPriceSub: { fontSize: 14, fontWeight: '400', color: COLORS.text2 },
  heroRating: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  heroRatingSub: { fontSize: 12, color: COLORS.text2 },
  mainCard: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  carName: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  carYear: { fontSize: 14, color: COLORS.text2, marginBottom: 6 },
  agenceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  agenceText: { fontSize: 14, color: COLORS.text2 },
  dot: { color: COLORS.text3, marginHorizontal: 2 },
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0.5, borderColor: COLORS.border3 },
  specIcon: { fontSize: 14 },
  specLabel: { fontSize: 13, color: COLORS.text2, fontWeight: '500' },
  description: { fontSize: 14, color: COLORS.text2, lineHeight: 22 },
  dureeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.card, borderWidth: 0.5, borderColor: COLORS.border3 },
  dureeChipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  dureeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text2 },
  dureeChipTextActive: { color: '#fff' },
  datesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border3, padding: 16, marginTop: 16, marginBottom: 12 },
  dateBox: { flex: 1 },
  dateLabel: { fontSize: 11, color: COLORS.text3, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  dateArrow: { paddingHorizontal: 12 },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card2, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.border3 },
  totalLabel: { fontSize: 14, color: COLORS.text2, fontWeight: '500' },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.gold },
  condCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border3, overflow: 'hidden' },
  condItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  condIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  condText: { fontSize: 13, color: COLORS.text2, flex: 1 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: COLORS.border3 },
  contactLabel: { fontSize: 12, color: COLORS.text3, marginBottom: 2 },
  contactValue: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.navy, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 16 },
  footerLeft: { flex: 1 },
  footerPrice: { fontSize: 18, fontWeight: '800', color: COLORS.gold },
  footerSub: { fontSize: 11, color: COLORS.text2, marginTop: 2 },
  reserveBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 16 },
  reserveBtnDisabled: { backgroundColor: COLORS.text3, opacity: 0.7 },
  reserveBtnText: { color: COLORS.navy, fontSize: 15, fontWeight: '800' },
  locCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: COLORS.border3 },
  locIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center' },
  locLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  locCoords: { fontSize: 12, color: COLORS.text3 },
})