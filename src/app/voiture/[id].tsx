import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const BLUE_L = '#3B7FF5'; const GOLD = '#F59E0B'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

type Voiture = {
  id: string; nom: string; agence: string; prix: number
  note: number; carburant: string; boite: string
  places: number; km_jour: number; wilaya: string; statut: string
}

export default function DetailVoiture() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [voiture, setVoiture] = useState<Voiture | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchVoiture() }, [id])

  async function fetchVoiture() {
    const { data } = await supabase.from('voitures').select('*').eq('id', id as string).single()
    if (data) setVoiture(data)
    setLoading(false)
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
  )

  if (!voiture) return (
    <View style={{ flex: 1, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: TEXT }}>Voiture introuvable</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: NAVY }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroGradient} />
          <Text style={s.heroEmoji}>🚙</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ color: TEXT, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.favBtn}>
            <Text style={{ fontSize: 18 }}>🤍</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text style={s.name}>{voiture.nom}</Text>

          <View style={s.agencyRow}>
            <Text style={s.agency}>🏢 {voiture.agence}</Text>
            <View style={s.wilayaBadge}>
              <Text style={s.wilayaText}>📍 {voiture.wilaya}</Text>
            </View>
          </View>

          <View style={s.priceRow}>
            <Text style={s.price}>{voiture.prix.toLocaleString()} DA <Text style={s.priceSub}>/ jour</Text></Text>
            <View style={s.ratingBox}>
              <Text style={{ color: GOLD, fontSize: 14 }}>★★★★★</Text>
              <Text style={s.ratingVal}>{voiture.note}</Text>
              <Text style={s.ratingCount}>(42 avis)</Text>
            </View>
          </View>

          {/* Specs */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Caractéristiques</Text>
          </View>
          <View style={s.specsGrid}>
            {[
              { icon: '⛽', val: voiture.carburant, label: 'Carburant' },
              { icon: '⚙️', val: voiture.boite ?? 'Manuelle', label: 'Boîte' },
              { icon: '👥', val: `${voiture.places ?? 5} places`, label: 'Capacité' },
              { icon: '🛣️', val: `${voiture.km_jour ?? 300} km`, label: 'Limite / jour' },
              { icon: '❄️', val: 'Incluse', label: 'Climatisation' },
              { icon: '🧳', val: '2 valises', label: 'Bagages' },
            ].map(spec => (
              <View key={spec.label} style={s.specItem}>
                <Text style={s.specIcon}>{spec.icon}</Text>
                <Text style={s.specVal}>{spec.val}</Text>
                <Text style={s.specLabel}>{spec.label}</Text>
              </View>
            ))}
          </View>

          {/* Documents */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Documents requis</Text>
          </View>
          <View style={s.docsBox}>
            {[
              { icon: '🪪', text: 'Permis de conduire (catégorie B)' },
              { icon: '💳', text: "Carte nationale d'identité" },
              { icon: '💰', text: 'Caution : 20 000 DA', gold: true },
            ].map(doc => (
              <View key={doc.text} style={[s.docRow, { borderBottomWidth: doc.gold ? 0 : 0.5, borderBottomColor: BORDER }]}>
                <Text style={{ fontSize: 18 }}>{doc.icon}</Text>
                <Text style={[s.docText, doc.gold && { color: GOLD }]}>{doc.text}</Text>
              </View>
            ))}
          </View>

          {/* Agence */}
          <View style={s.agenceCard}>
            <View style={s.agenceAvatar}>
              <Text style={{ fontSize: 20 }}>🏢</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.agenceNom}>{voiture.agence}</Text>
              <Text style={s.agenceAddr}>Rue Ibn Khaldoun, {voiture.wilaya}</Text>
              <Text style={s.agenceTel}>📞 0550 123 456</Text>
            </View>
            <Text style={{ color: TEXT3, fontSize: 18 }}>›</Text>
          </View>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.reserverBtn}
          onPress={() => router.push({
            pathname: '/reservation',
            params: { id: voiture.id }
          } as any)}
        >
          <Text style={s.reserverText}>Réserver maintenant</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  hero: { height: 240, backgroundColor: CARD2, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'transparent' },
  heroEmoji: { fontSize: 100 },
  backBtn: { position: 'absolute', top: 56, left: 16, width: 36, height: 36, backgroundColor: 'rgba(10,22,40,0.7)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
  favBtn: { position: 'absolute', top: 56, right: 16, width: 36, height: 36, backgroundColor: 'rgba(10,22,40,0.7)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
  body: { padding: 20 },
  name: { fontSize: 24, fontWeight: '800', color: TEXT, marginBottom: 4 },
  agencyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  agency: { fontSize: 14, color: TEXT2, flex: 1 },
  wilayaBadge: { backgroundColor: 'rgba(37,99,235,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.2)' },
  wilayaText: { fontSize: 12, color: BLUE_L, fontWeight: '500' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  price: { fontSize: 28, fontWeight: '900', color: GOLD },
  priceSub: { fontSize: 14, fontWeight: '400', color: TEXT2 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: CARD, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: BORDER2 },
  ratingVal: { fontSize: 14, fontWeight: '700', color: TEXT },
  ratingCount: { fontSize: 12, color: TEXT2 },
  sectionHeader: { marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  specItem: { width: '47%', backgroundColor: CARD, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: BORDER2 },
  specIcon: { fontSize: 16, color: BLUE_L, marginBottom: 6 },
  specVal: { fontSize: 14, fontWeight: '700', color: TEXT },
  specLabel: { fontSize: 11, color: TEXT2, marginTop: 2 },
  docsBox: { backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2, marginBottom: 20 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  docText: { fontSize: 13, color: TEXT, flex: 1 },
  agenceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.2)', gap: 12, marginBottom: 20 },
  agenceAvatar: { width: 40, height: 40, backgroundColor: BLUE, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  agenceNom: { fontSize: 14, fontWeight: '700', color: TEXT },
  agenceAddr: { fontSize: 12, color: TEXT2 },
  agenceTel: { fontSize: 12, color: BLUE_L, marginTop: 2, fontWeight: '500' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: NAVY, borderTopWidth: 0.5, borderTopColor: BORDER2 },
  reserverBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  reserverText: { color: '#1a1200', fontSize: 16, fontWeight: '700' },
})
