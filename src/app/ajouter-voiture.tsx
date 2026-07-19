import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'
const GREEN = '#10B981'

const CARBURANTS = ['⛽ Essence', '🛢 Diesel', '⚡ Électrique', '🌿 Hybride']
const BOITES = ['⚙️ Manuelle', '🤖 Automatique']
const CATEGORIES = ['Économique', 'SUV / 4x4', 'Luxe', 'Camion']
const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou',
  'Alger','Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba',
  'Guelma','Constantine','Médéa','Mostaganem',"M'Sila",'Mascara','Ouargla',
  'Oran','El Bayadh','Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf',
  'Tindouf','Tissemsilt','El Oued','Khenchela','Souk Ahras','Tipaza','Mila',
  'Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane',
]

export default function AjouterVoiture() {
  const router = useRouter()
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [nomAgence, setNomAgence] = useState('Mon Agence')
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [categorie, setCategorie] = useState('Économique')
  const [carburant, setCarburant] = useState('⛽ Essence')
  const [boite, setBoite] = useState('⚙️ Manuelle')
  const [wilaya, setWilaya] = useState('Tlemcen')
  const [photoUri, setPhotoUri] = useState<string | null>(null)   // aperçu local
  const [imageUrl, setImageUrl] = useState<string | null>(null)   // URL Supabase finale
  const [uploadErreur, setUploadErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('profils').select('nom').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.nom) setNomAgence(data.nom) })
  }, [session?.user?.id])

  async function lancerCamera() {
    setShowPhotoModal(false)
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les paramètres.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    })
    if (!result.canceled) await traiterPhoto(result.assets[0].uri)
  }

  async function lancerGalerie() {
    setShowPhotoModal(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les paramètres.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    })
    if (!result.canceled) await traiterPhoto(result.assets[0].uri)
  }

  async function traiterPhoto(uri: string) {
    setPhotoUri(uri)
    setImageUrl(null)
    setUploadErreur(null)
    setUploading(true)

    try {
      if (!session?.user?.id) throw new Error('Non connecté')

      // ✅ NOUVEAU : Utiliser fetch + blob (compatible Expo SDK 54+)
      const response = await fetch(uri)
      const blob = await response.blob()

      // Déterminer le type MIME
      const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const fileName = `${session.user.id}/${Date.now()}.${ext}`

      // Upload direct du blob dans Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('voitures')
        .upload(fileName, blob, { contentType: mimeType, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      // Récupérer l'URL publique
      const { data } = supabase.storage.from('voitures').getPublicUrl(fileName)
      setImageUrl(data.publicUrl)

    } catch (e: any) {
      console.error('Upload error:', e)
      setUploadErreur(e.message)
      Alert.alert('Erreur upload', e.message)
    } finally {
      setUploading(false)
    }
  }

  function supprimerPhoto() {
    setPhotoUri(null)
    setImageUrl(null)
    setUploadErreur(null)
  }

  function showAlert(title: string, message: string, onOk?: () => void) {
    if (typeof window !== 'undefined' && !(globalThis as any).isNative) {
      window.alert(`${title}\n${message}`)
      onOk?.()
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined)
    }
  }

  async function sauvegarder() {
    if (!session?.user?.id) return showAlert('Erreur', 'Vous devez être connecté.')
    if (!nom.trim()) return showAlert('Erreur', 'Le nom du véhicule est obligatoire')
    if (!prix.trim() || isNaN(parseInt(prix))) return showAlert('Erreur', 'Le prix est obligatoire')
    if (uploading) return showAlert('Patientez', "L'upload de la photo est en cours...")
    if (photoUri && !imageUrl) {
      return showAlert('Erreur', "La photo n'a pas pu être uploadée. Réessayez ou supprimez la photo.")
    }

    setLoading(true)
    const { error } = await supabase.from('voitures').insert({
      nom: nom.trim(),
      agence: nomAgence,
      agence_id: session.user.id,
      prix: parseInt(prix),
      carburant: carburant.replace(/^[^\s]+\s/, ''),
      boite: boite.replace(/^[^\s]+\s/, ''),
      categorie,
      wilaya,
      statut: 'disponible',
      note: 5.0,
      places: 5,
      km_jour: 300,
      image_url: imageUrl ?? null,
    })
    setLoading(false)

    if (error) showAlert('Erreur', error.message)
    else showAlert('✅ Succès', 'Voiture publiée avec succès !', () => router.back())
  }

  const photoAffichee = imageUrl ?? photoUri

  return (
    <>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.statusBar}>
          <Text style={s.time}>9:41</Text>
          <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
        </View>

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ color: TEXT, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ajouter une voiture</Text>
        </View>

        <View style={s.body}>

          {photoAffichee ? (
            <View style={s.previewWrap}>
              <Image source={{ uri: photoAffichee }} style={s.previewImg} resizeMode="cover" />
              <View style={s.previewOverlay}>
                {uploading ? (
                  <View style={s.uploadingBadge}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={s.uploadingText}>Upload en cours...</Text>
                  </View>
                ) : imageUrl ? (
                  <View style={s.successBadge}>
                    <Text style={s.successText}>✓ Photo prête</Text>
                  </View>
                ) : uploadErreur ? (
                  <View style={s.errorBadge}>
                    <Text style={s.errorText}>✕ Échec upload</Text>
                  </View>
                ) : null}
              </View>

              {uploadErreur && !uploading && (
                <TouchableOpacity
                  style={s.retryBtn}
                  onPress={() => photoUri && traiterPhoto(photoUri)}
                >
                  <Text style={s.retryText}>↻ Réessayer l'upload</Text>
                </TouchableOpacity>
              )}

              <View style={s.previewActions}>
                <TouchableOpacity style={s.previewBtn} onPress={() => setShowPhotoModal(true)} disabled={uploading}>
                  <Text style={s.previewBtnIcon}>✏️</Text>
                  <Text style={s.previewBtnText}>Changer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.previewBtn, s.previewBtnDanger]} onPress={supprimerPhoto} disabled={uploading}>
                  <Text style={s.previewBtnIcon}>🗑️</Text>
                  <Text style={[s.previewBtnText, { color: '#FCA5A5' }]}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.uploadArea} onPress={() => setShowPhotoModal(true)} activeOpacity={0.8}>
              <View style={s.uploadIconCircle}>
                <Text style={{ fontSize: 28 }}>📸</Text>
              </View>
              <Text style={s.uploadTitle}>Ajouter une photo</Text>
              <Text style={s.uploadSub}>Prendre une photo ou choisir depuis la galerie</Text>
              <View style={s.uploadHints}>
                <View style={s.uploadHint}>
                  <Text style={s.uploadHintIcon}>📷</Text>
                  <Text style={s.uploadHintText}>Caméra</Text>
                </View>
                <View style={s.uploadHintDivider} />
                <View style={s.uploadHint}>
                  <Text style={s.uploadHintIcon}>🖼️</Text>
                  <Text style={s.uploadHintText}>Galerie</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

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

          <Text style={s.sectionLabel}>CATÉGORIE</Text>
          <View style={s.chips}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[s.chip, categorie === c && s.chipActive]} onPress={() => setCategorie(c)}>
                <Text style={[s.chipText, categorie === c && s.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.sectionLabel}>CARBURANT</Text>
          <View style={s.chips}>
            {CARBURANTS.map(c => (
              <TouchableOpacity key={c} style={[s.chip, carburant === c && s.chipActive]} onPress={() => setCarburant(c)}>
                <Text style={[s.chipText, carburant === c && s.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.sectionLabel}>BOÎTE DE VITESSES</Text>
          <View style={s.chips}>
            {BOITES.map(b => (
              <TouchableOpacity key={b} style={[s.chip, boite === b && s.chipActive]} onPress={() => setBoite(b)}>
                <Text style={[s.chipText, boite === b && s.chipTextActive]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>

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

          <Text style={s.sectionLabel}>RÉSUMÉ</Text>
          <View style={s.summaryBox}>
            {[
              { key: 'Véhicule', val: nom || '—' },
              { key: 'Catégorie', val: categorie },
              { key: 'Carburant', val: carburant.replace(/^[^\s]+\s/, '') },
              { key: 'Boîte', val: boite.replace(/^[^\s]+\s/, '') },
              { key: 'Wilaya', val: wilaya },
              {
                key: 'Photo',
                val: uploading ? '⏳ Upload...' : imageUrl ? '✓ Prête' : uploadErreur ? '✕ Échec' : '—',
                green: !!imageUrl,
                red: !!uploadErreur && !uploading,
              },
              { key: 'Prix / jour', val: prix ? `${parseInt(prix).toLocaleString()} DA` : '—', gold: true },
            ].map((row: any) => (
              <View key={row.key} style={s.summaryRow}>
                <Text style={s.summaryKey}>{row.key}</Text>
                <Text style={[
                  s.summaryVal,
                  row.gold && { color: GOLD },
                  row.green && { color: GREEN },
                  row.red && { color: '#FCA5A5' },
                ]}>{row.val}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, (loading || uploading) && { opacity: 0.6 }]}
            onPress={sauvegarder}
            disabled={loading || uploading}
          >
            <Text style={s.btnPrimaryText}>
              {loading ? 'Publication...' : uploading ? '⏳ Upload photo...' : 'Publier la voiture'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showPhotoModal} transparent animationType="slide" onRequestClose={() => setShowPhotoModal(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowPhotoModal(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Ajouter une photo</Text>
          <Text style={s.modalSub}>Choisissez la source de la photo</Text>

          <TouchableOpacity style={s.modalOption} onPress={lancerCamera} activeOpacity={0.8}>
            <View style={[s.modalOptionIcon, { backgroundColor: 'rgba(37,99,235,0.15)' }]}>
              <Text style={{ fontSize: 24 }}>📷</Text>
            </View>
            <View style={s.modalOptionBody}>
              <Text style={s.modalOptionTitle}>Prendre une photo</Text>
              <Text style={s.modalOptionSub}>Utiliser l'appareil photo de votre téléphone</Text>
            </View>
            <Text style={{ color: TEXT3, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          <View style={s.modalDivider} />

          <TouchableOpacity style={s.modalOption} onPress={lancerGalerie} activeOpacity={0.8}>
            <View style={[s.modalOptionIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Text style={{ fontSize: 24 }}>🖼️</Text>
            </View>
            <View style={s.modalOptionBody}>
              <Text style={s.modalOptionTitle}>Choisir depuis la galerie</Text>
              <Text style={s.modalOptionSub}>Sélectionner une photo existante</Text>
            </View>
            <Text style={{ color: TEXT3, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.modalCancel} onPress={() => setShowPhotoModal(false)}>
            <Text style={s.modalCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
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
  uploadArea: { width: '100%', backgroundColor: CARD, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER2, borderStyle: 'dashed', alignItems: 'center', paddingVertical: 28, gap: 8, marginBottom: 6 },
  uploadIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(37,99,235,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  uploadTitle: { fontSize: 15, color: TEXT, fontWeight: '600' },
  uploadSub: { fontSize: 12, color: TEXT2, textAlign: 'center', paddingHorizontal: 30 },
  uploadHints: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 0.5, borderColor: BORDER2 },
  uploadHint: { flex: 1, alignItems: 'center', gap: 4 },
  uploadHintIcon: { fontSize: 20 },
  uploadHintText: { fontSize: 12, color: TEXT2, fontWeight: '500' },
  uploadHintDivider: { width: 1, height: 30, backgroundColor: BORDER2, marginHorizontal: 16 },
  previewWrap: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 6, backgroundColor: CARD },
  previewImg: { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', top: 10, left: 10 },
  uploadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,22,40,0.75)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  uploadingText: { color: TEXT2, fontSize: 12 },
  successBadge: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.4)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  successText: { color: '#34D399', fontSize: 12, fontWeight: '600' },
  errorBadge: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  errorText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
  retryBtn: { position: 'absolute', top: 50, left: 10, backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  previewActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(10,22,40,0.75)' },
  previewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  previewBtnDanger: { borderLeftWidth: 0.5, borderLeftColor: BORDER2 },
  previewBtnIcon: { fontSize: 14 },
  previewBtnText: { fontSize: 13, color: TEXT, fontWeight: '500' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#131F35', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 4 },
  modalSub: { fontSize: 13, color: TEXT2, marginBottom: 20 },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  modalOptionIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalOptionBody: { flex: 1 },
  modalOptionTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 2 },
  modalOptionSub: { fontSize: 12, color: TEXT2 },
  modalDivider: { height: 0.5, backgroundColor: BORDER2, marginVertical: 4 },
  modalCancel: { marginTop: 16, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
  modalCancelText: { fontSize: 15, color: TEXT2, fontWeight: '600' },
})