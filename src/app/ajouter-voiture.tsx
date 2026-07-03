import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'
const AGENCE_ID = '11111111-1111-1111-1111-111111111111'

const CARBURANTS = ['⛽ Essence', '🛢 Diesel', '⚡ Électrique', '🌿 Hybride']
const BOITES = ['⚙️ Manuelle', '🤖 Automatique']
const WILAYAS = ['Tlemcen', 'Alger', 'Oran', 'Constantine', 'Annaba', 'Béjaïa', 'Sétif', 'Tamanrasset']

export default function AjouterVoiture() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [carburant, setCarburant] = useState('⛽ Essence')
  const [boite, setBoite] = useState('⚙️ Manuelle')
  const [wilaya, setWilaya] = useState('Tlemcen')

  async function sauvegarder() {
    if (!nom || !prix) return Alert.alert('Erreur', 'Nom et prix sont obligatoires')
    setLoading(true)
    const { error } = await supabase.from('voitures').insert({
      nom, agence: 'AutoDZ Tlemcen', agence_id: AGENCE_ID,
      prix: parseInt(prix), carburant: carburant.replace(/^.+\s/, ''),
      boite: boite.replace(/^.+\s/, ''), wilaya, statut: 'disponible', note: 5.0, places: 5, km_jour: 300,
    })
    setLoading(false)
    if (error) Alert.alert('Erreur', error.message)
    else Alert.alert('✅ Succès', 'Voiture publiée !', [{ text: 'OK', onPress: () => router.back() }])
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ color: TEXT, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ajouter une voiture</Text>
      </View>

      <View style={s.body}>
        {/* Upload area */}
        <TouchableOpacity style={s.uploadArea}>
          <Text style={{ fontSize: 28, color: '#3B7FF5' }}>📸</Text>
          <Text style={s.uploadTitle}>Ajouter des photos</Text>
          <Text style={s.uploadSub}>JPG, PNG · max 5 Mo</Text>
        </TouchableOpacity>

        {/* Infos */}
        <Text style={s.sectionLabel}>INFORMATIONS</Text>
        <Text style={s.fieldLabel}>Nom du véhicule</Text>
        <View style={s.field}>
          <Text style={{ fontSize: 18, color: TEXT3 }}>🚗</Text>
          <TextInput style={s.fieldInput} placeholder="ex: Dacia Logan 2022" placeholderTextColor={TEXT3} value={nom} onChangeText={setNom} />
        </View>

        <Text style={s.fieldLabel}>Prix par jour (DA)</Text>
        <View style={s.field}>
          <Text style={{ fontSize: 18, color: TEXT3 }}>💰</Text>
          <TextInput style={s.fieldInput} placeholder="ex: 3500" placeholderTextColor={TEXT3} value={prix} onChangeText={setPrix} keyboardType="numeric" />
        </View>

        {/* Carburant */}
        <Text style={s.sectionLabel}>CARBURANT</Text>
        <View style={s.chips}>
          {CARBURANTS.map(c => (
            <TouchableOpacity key={c} style={[s.chip, carburant === c && s.chipActive]} onPress={() => setCarburant(c)}>
              <Text style={[s.chipText, carburant === c && s.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Boîte */}
        <Text style={s.sectionLabel}>BOÎTE DE VITESSES</Text>
        <View style={s.chips}>
          {BOITES.map(b => (
            <TouchableOpacity key={b} style={[s.chip, boite === b && s.chipActive]} onPress={() => setBoite(b)}>
              <Text style={[s.chipText, boite === b && s.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Wilaya */}
        <Text style={s.sectionLabel}>WILAYA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={[s.chips, { flexWrap: 'nowrap' }]}>
            {WILAYAS.map(w => (
              <TouchableOpacity key={w} style={[s.chip, wilaya === w && s.chipActive]} onPress={() => setWilaya(w)}>
                <Text style={[s.chipText, wilaya === w && s.chipTextActive]}>{w}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Summary */}
        <Text style={s.sectionLabel}>RÉSUMÉ</Text>
        <View style={s.summaryBox}>
          {[
            { key: 'Véhicule', val: nom || '—' },
            { key: 'Carburant', val: carburant.replace(/^.+\s/, '') },
            { key: 'Boîte', val: boite.replace(/^.+\s/, '') },
            { key: 'Wilaya', val: wilaya },
            { key: 'Prix / jour', val: prix ? `${parseInt(prix).toLocaleString()} DA` : '—', gold: true },
          ].map((row: any) => (
            <View key={row.key} style={s.summaryRow}>
              <Text style={s.summaryKey}>{row.key}</Text>
              <Text style={[s.summaryVal, row.gold && { color: GOLD }]}>{row.val}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[s.btnPrimary, loading && { opacity: 0.6 }]} onPress={sauvegarder} disabled={loading}>
          <Text style={s.btnPrimaryText}>{loading ? 'Publication...' : 'Publier la voiture'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline}>
          <Text style={s.btnOutlineText}>Enregistrer le brouillon</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, backgroundColor: CARD, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
  body: { paddingHorizontal: 20 },
  uploadArea: { width: '100%', height: 110, backgroundColor: CARD, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 6 },
  uploadTitle: { fontSize: 13, color: TEXT2, fontWeight: '500' },
  uploadSub: { fontSize: 11, color: TEXT3 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: TEXT2, letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: TEXT2, letterSpacing: 0.4, marginBottom: 8 },
  field: { backgroundColor: CARD, borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  fieldInput: { flex: 1, color: TEXT, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: BORDER2 },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { fontSize: 13, fontWeight: '500', color: TEXT2 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  summaryBox: { backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: BORDER2, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  summaryKey: { fontSize: 13, color: TEXT2 },
  summaryVal: { fontSize: 13, fontWeight: '600', color: TEXT },
  btnPrimary: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnOutlineText: { color: TEXT, fontSize: 15, fontWeight: '600' },
})
