import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { File } from 'expo-file-system'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, CARBURANTS, BOITES, CATEGORIES, WILAYAS, formatDA } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getCurrentPosition, formatCoords, Coords } from '../lib/location'
export default function AjouterVoiture() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showWilayaPicker, setShowWilayaPicker] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [locating, setLocating] = useState(false)

  const [nomAgence, setNomAgence] = useState('Mon Agence')
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [annee, setAnnee] = useState('')
  const [places, setPlaces] = useState('5')
  const [kmJour, setKmJour] = useState('300')
  const [categorie, setCategorie] = useState('Économique')
  const [carburant, setCarburant] = useState('Essence')
  const [boite, setBoite] = useState('Manuelle')
  const [wilaya, setWilaya] = useState('Alger')
  const [climatisation, setClimatisation] = useState(true)
  const [description, setDescription] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploadErreur, setUploadErreur] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('profils').select('nom').eq('id', session.user.id).single()
      .then(({ data }) => { if (data?.nom) setNomAgence(data.nom) })
  }, [session?.user?.id])

  async function lancerCamera() {
    setShowPhotoModal(false)
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la caméra.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    })
    if (!result.canceled) await traiterPhoto(result.assets[0].uri)
  }

  async function lancerGalerie() {
    setShowPhotoModal(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
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
      const file = new File(uri)
      const bytes = await file.bytes()
      const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const fileName = `${session.user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('voitures').upload(fileName, bytes, { contentType: mimeType, upsert: true })
      if (uploadError) throw new Error(uploadError.message)

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

  async function utiliserMaPosition() {
    setLocating(true)
    const pos = await getCurrentPosition()
    if (pos) setCoords(pos)
    setLocating(false)
  }

  function supprimerPhoto() {
    setPhotoUri(null)
    setImageUrl(null)
    setUploadErreur(null)
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!nom.trim()) errs.nom = 'Nom obligatoire'
    if (!prix.trim() || isNaN(parseInt(prix)) || parseInt(prix) <= 0) errs.prix = 'Prix invalide'
    if (annee && (parseInt(annee) < 1990 || parseInt(annee) > new Date().getFullYear())) errs.annee = 'Année invalide'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function sauvegarder() {
    if (!session?.user?.id) { Alert.alert('Erreur', 'Vous devez être connecté.'); return }
    if (!validate()) return
    if (uploading) { Alert.alert('Patientez', "L'upload est en cours..."); return }
    if (photoUri && !imageUrl) {
      Alert.alert('Erreur', "La photo n'a pas pu être uploadée. Réessayez ou supprimez-la.")
      return
    }

    setLoading(true)
    const { error } = await supabase.from('voitures').insert({
      nom: nom.trim(),
      agence: nomAgence,
      agence_id: session.user.id,
      prix: parseInt(prix),
      annee: annee ? parseInt(annee) : null,
      carburant,
      boite,
      categorie,
      wilaya,
      statut: 'disponible',
      note: 5.0,
      places: parseInt(places) || 5,
      km_jour: parseInt(kmJour) || 300,
      climatisation,
      description: description.trim() || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      image_url: imageUrl ?? null,
    })
    setLoading(false)

    if (error) Alert.alert('Erreur', error.message)
    else {
      Alert.alert('✅ Succès', 'Voiture publiée avec succès !', [
        { text: 'OK', onPress: () => router.back() }
      ])
    }
  }

  const photoAffichee = imageUrl ?? photoUri

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ajouter une voiture</Text>
        </View>

        <View style={styles.body}>
          {/* Photo */}
          {photoAffichee ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photoAffichee }} style={styles.previewImg} resizeMode="cover" />
              <View style={styles.previewOverlay}>
                {uploading ? (
                  <View style={styles.uploadingBadge}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.uploadingText}>Upload...</Text>
                  </View>
                ) : imageUrl ? (
                  <View style={styles.successBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.greenLight} />
                    <Text style={styles.successText}>Photo prête</Text>
                  </View>
                ) : uploadErreur ? (
                  <View style={styles.errorBadge}>
                    <Ionicons name="close-circle" size={14} color={COLORS.redLight} />
                    <Text style={styles.errorBadgeText}>Échec upload</Text>
                  </View>
                ) : null}
              </View>

              {uploadErreur && !uploading && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => photoUri && traiterPhoto(photoUri)}>
                  <Text style={styles.retryText}>↻ Réessayer</Text>
                </TouchableOpacity>
              )}

              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.previewBtn} onPress={() => setShowPhotoModal(true)} disabled={uploading}>
                  <Ionicons name="create-outline" size={14} color={COLORS.text} />
                  <Text style={styles.previewBtnText}>Changer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.previewBtn, styles.previewBtnDanger]} onPress={supprimerPhoto} disabled={uploading}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.redLight} />
                  <Text style={[styles.previewBtnText, { color: COLORS.redLight }]}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadArea} onPress={() => setShowPhotoModal(true)} activeOpacity={0.8}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="camera" size={28} color={COLORS.blue} />
              </View>
              <Text style={styles.uploadTitle}>Ajouter une photo</Text>
              <Text style={styles.uploadSub}>Prendre une photo ou choisir depuis la galerie</Text>
              <View style={styles.uploadHints}>
                <View style={styles.uploadHint}>
                  <Ionicons name="camera" size={20} color={COLORS.text2} />
                  <Text style={styles.uploadHintText}>Caméra</Text>
                </View>
                <View style={styles.uploadHintDivider} />
                <View style={styles.uploadHint}>
                  <Ionicons name="images" size={20} color={COLORS.text2} />
                  <Text style={styles.uploadHintText}>Galerie</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Infos */}
          <Text style={styles.sectionLabel}>INFORMATIONS</Text>

          <Text style={styles.fieldLabel}>Nom du véhicule</Text>
          <View style={[styles.field, errors.nom && styles.fieldError]}>
            <Ionicons name="car-sport-outline" size={18} color={COLORS.text3} />
            <TextInput style={styles.fieldInput} placeholder="ex: Dacia Logan 2022" placeholderTextColor={COLORS.text3}
              value={nom} onChangeText={setNom} />
          </View>
          {errors.nom && <Text style={styles.errorText}>{errors.nom}</Text>}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Prix / jour (DA)</Text>
              <View style={[styles.field, errors.prix && styles.fieldError]}>
                <Ionicons name="cash-outline" size={18} color={COLORS.text3} />
                <TextInput style={styles.fieldInput} placeholder="3500" placeholderTextColor={COLORS.text3}
                  value={prix} onChangeText={setPrix} keyboardType="numeric" />
              </View>
              {errors.prix && <Text style={styles.errorText}>{errors.prix}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Année</Text>
              <View style={[styles.field, errors.annee && styles.fieldError]}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.text3} />
                <TextInput style={styles.fieldInput} placeholder="2022" placeholderTextColor={COLORS.text3}
                  value={annee} onChangeText={setAnnee} keyboardType="numeric" maxLength={4} />
              </View>
              {errors.annee && <Text style={styles.errorText}>{errors.annee}</Text>}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Places</Text>
              <View style={styles.field}>
                <Ionicons name="people-outline" size={18} color={COLORS.text3} />
                <TextInput style={styles.fieldInput} placeholder="5" placeholderTextColor={COLORS.text3}
                  value={places} onChangeText={setPlaces} keyboardType="numeric" maxLength={1} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Km / jour</Text>
              <View style={styles.field}>
                <Ionicons name="speedometer-outline" size={18} color={COLORS.text3} />
                <TextInput style={styles.fieldInput} placeholder="300" placeholderTextColor={COLORS.text3}
                  value={kmJour} onChangeText={setKmJour} keyboardType="numeric" />
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Description (optionnel)</Text>
          <View style={[styles.field, { alignItems: 'flex-start', paddingVertical: 12 }]}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.text3} style={{ marginTop: 2 }} />
            <TextInput
              style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Décrivez le véhicule..."
              placeholderTextColor={COLORS.text3}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Catégorie */}
          <Text style={styles.sectionLabel}>CATÉGORIE</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.chip, categorie === c && styles.chipActive]} onPress={() => setCategorie(c)}>
                <Text style={[styles.chipText, categorie === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Carburant */}
          <Text style={styles.sectionLabel}>CARBURANT</Text>
          <View style={styles.chips}>
            {CARBURANTS.map(c => (
              <TouchableOpacity key={c} style={[styles.chip, carburant === c && styles.chipActive]} onPress={() => setCarburant(c)}>
                <Text style={[styles.chipText, carburant === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Boîte */}
          <Text style={styles.sectionLabel}>BOÎTE DE VITESSES</Text>
          <View style={styles.chips}>
            {BOITES.map(b => (
              <TouchableOpacity key={b} style={[styles.chip, boite === b && styles.chipActive]} onPress={() => setBoite(b)}>
                <Text style={[styles.chipText, boite === b && styles.chipTextActive]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Climatisation */}
          <Text style={styles.sectionLabel}>OPTIONS</Text>
          <TouchableOpacity style={styles.optionRow} onPress={() => setClimatisation(!climatisation)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="snow-outline" size={18} color={COLORS.text2} />
              <Text style={styles.optionText}>Climatisation</Text>
            </View>
            <View style={[styles.toggleSwitch, climatisation && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, climatisation && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* Localisation GPS */}
          <Text style={styles.sectionLabel}>LOCALISATION GPS</Text>
          {coords ? (
            <View style={styles.locCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="location" size={18} color={COLORS.green} />
                <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }}>Position enregistrée</Text>
              </View>
              <Text style={{ color: COLORS.text2, fontSize: 13, marginBottom: 10 }}>
                {formatCoords(coords.latitude, coords.longitude)}
              </Text>
              <TouchableOpacity style={styles.locBtnSecondary} onPress={() => setCoords(null)}>
                <Ionicons name="trash-outline" size={14} color={COLORS.redLight} />
                <Text style={{ color: COLORS.redLight, fontSize: 12, fontWeight: '600' }}>Supprimer la position</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.locBtn, locating && { opacity: 0.6 }]}
              onPress={utiliserMaPosition}
              disabled={locating}
              activeOpacity={0.85}
            >
              {locating ? (
                <ActivityIndicator size="small" color={COLORS.blue} />
              ) : (
                <>
                  <Ionicons name="locate" size={18} color={COLORS.blue} />
                  <Text style={styles.locBtnText}>Utiliser ma position actuelle</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Wilaya */}
          <Text style={styles.sectionLabel}>WILAYA</Text>
          <TouchableOpacity style={styles.field} onPress={() => setShowWilayaPicker(!showWilayaPicker)}>
            <Ionicons name="location-outline" size={18} color={COLORS.text3} />
            <Text style={[styles.fieldInput, { color: COLORS.text }]}>{wilaya}</Text>
            <Ionicons name={showWilayaPicker ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.text3} />
          </TouchableOpacity>

          {showWilayaPicker && (
            <View style={styles.wilayaList}>
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                {WILAYAS.map(w => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.wilayaItem, wilaya === w && styles.wilayaItemActive]}
                    onPress={() => { setWilaya(w); setShowWilayaPicker(false) }}
                  >
                    <Text style={[styles.wilayaText, wilaya === w && { color: '#fff', fontWeight: '700' }]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Résumé */}
          <Text style={styles.sectionLabel}>RÉSUMÉ</Text>
          <View style={styles.summaryBox}>
            {[
              { key: 'Véhicule', val: nom || '—' },
              { key: 'Catégorie', val: categorie },
              { key: 'Carburant', val: carburant },
              { key: 'Boîte', val: boite },
              { key: 'Wilaya', val: wilaya },
              { key: 'Climatisation', val: climatisation ? 'Oui ❄️' : 'Non' },
              {
                key: 'Photo', val: uploading ? '⏳ Upload...' : imageUrl ? '✓ Prête' : uploadErreur ? '✕ Échec' : '—',
                green: !!imageUrl, red: !!uploadErreur && !uploading,
              },
              { key: 'Prix / jour', val: prix ? formatDA(parseInt(prix)) : '—', gold: true },
            ].map((row: any) => (
              <View key={row.key} style={styles.summaryRow}>
                <Text style={styles.summaryKey}>{row.key}</Text>
                <Text style={[styles.summaryVal, row.gold && { color: COLORS.gold }, row.green && { color: COLORS.green }, row.red && { color: COLORS.redLight }]}>{row.val}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, (loading || uploading) && { opacity: 0.6 }]}
            onPress={sauvegarder}
            disabled={loading || uploading}
          >
            <Text style={styles.btnPrimaryText}>
              {loading ? 'Publication...' : uploading ? '⏳ Upload photo...' : 'Publier la voiture'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Photo Modal */}
      <Modal visible={showPhotoModal} transparent animationType="slide" onRequestClose={() => setShowPhotoModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPhotoModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Ajouter une photo</Text>
          <Text style={styles.modalSub}>Choisissez la source</Text>

          <TouchableOpacity style={styles.modalOption} onPress={lancerCamera} activeOpacity={0.8}>
            <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(37,99,235,0.15)' }]}>
              <Ionicons name="camera" size={24} color={COLORS.blue} />
            </View>
            <View style={styles.modalOptionBody}>
              <Text style={styles.modalOptionTitle}>Prendre une photo</Text>
              <Text style={styles.modalOptionSub}>Utiliser l'appareil photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text3} />
          </TouchableOpacity>

          <View style={styles.modalDivider} />

          <TouchableOpacity style={styles.modalOption} onPress={lancerGalerie} activeOpacity={0.8}>
            <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="images" size={24} color={COLORS.gold} />
            </View>
            <View style={styles.modalOptionBody}>
              <Text style={styles.modalOptionTitle}>Choisir depuis la galerie</Text>
              <Text style={styles.modalOptionSub}>Sélectionner une photo existante</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text3} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPhotoModal(false)}>
            <Text style={styles.modalCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, backgroundColor: COLORS.card, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border3 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  body: { paddingHorizontal: 20 },
  uploadArea: { width: '100%', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border3, borderStyle: 'dashed', alignItems: 'center', paddingVertical: 28, gap: 8, marginBottom: 6 },
  uploadIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(37,99,235,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  uploadTitle: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  uploadSub: { fontSize: 12, color: COLORS.text2, textAlign: 'center', paddingHorizontal: 30 },
  uploadHints: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 0.5, borderColor: COLORS.border3 },
  uploadHint: { flex: 1, alignItems: 'center', gap: 4 },
  uploadHintIcon: { fontSize: 20 },
  uploadHintText: { fontSize: 12, color: COLORS.text2, fontWeight: '500' },
  uploadHintDivider: { width: 1, height: 30, backgroundColor: COLORS.border3, marginHorizontal: 16 },
  previewWrap: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 6, backgroundColor: COLORS.card },
  previewImg: { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', top: 10, left: 10 },
  uploadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,22,40,0.75)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  uploadingText: { color: COLORS.text2, fontSize: 12 },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.4)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  successText: { color: COLORS.greenLight, fontSize: 12, fontWeight: '600' },
  errorBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 0.5, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  errorBadgeText: { color: COLORS.redLight, fontSize: 12, fontWeight: '600' },
  retryBtn: { position: 'absolute', top: 50, left: 10, backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  previewActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(10,22,40,0.75)' },
  previewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  previewBtnDanger: { borderLeftWidth: 0.5, borderLeftColor: COLORS.border3 },
  previewBtnText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text2, letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text2, letterSpacing: 0.4, marginBottom: 8 },
  field: { backgroundColor: COLORS.card, borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  fieldError: { borderColor: COLORS.red, borderWidth: 1 },
  fieldInput: { flex: 1, color: COLORS.text, fontSize: 15 },
  errorText: { color: COLORS.redLight, fontSize: 12, marginBottom: 10, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border3, backgroundColor: COLORS.card },
  chipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.text2 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 14 },
  optionText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: COLORS.card2, justifyContent: 'center', paddingHorizontal: 2 },
  toggleSwitchActive: { backgroundColor: COLORS.green },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.text3 },
  toggleKnobActive: { backgroundColor: '#fff', transform: [{ translateX: 20 }] },
  wilayaList: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 14, overflow: 'hidden' },
  wilayaItem: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  wilayaItemActive: { backgroundColor: COLORS.blue },
  wilayaText: { fontSize: 14, color: COLORS.text2 },
  summaryBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  summaryKey: { fontSize: 13, color: COLORS.text2 },
  summaryVal: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  btnPrimary: { backgroundColor: COLORS.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#131F35', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: COLORS.text2, marginBottom: 20 },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  modalOptionIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalOptionBody: { flex: 1 },
  modalOptionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  modalOptionSub: { fontSize: 12, color: COLORS.text2 },
  modalDivider: { height: 0.5, backgroundColor: COLORS.border3, marginVertical: 4 },
  modalCancel: { marginTop: 16, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border3 },
  modalCancelText: { fontSize: 15, color: COLORS.text2, fontWeight: '600' },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 14, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 14 },
  locBtnText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
  locBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  locCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 14 },
})