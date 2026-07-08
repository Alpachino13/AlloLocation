import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

const CARBURANTS = ['⛽ Essence', '🛢 Diesel', '⚡ Électrique', '🌿 Hybride']
const BOITES = ['⚙️ Manuelle', '🤖 Automatique']
const CATEGORIES = ['Économique', 'SUV / 4x4', 'Luxe', 'Camion']
const WILAYAS = [
  'Tlemcen', 'Alger', 'Oran', 'Constantine', 'Annaba', 'Béjaïa', 'Sétif', 'Tamanrasset'
]

export default function AjouterVoiture() {
  const router = useRouter()
  const { session } = useAuth()
  
  const [loading, setLoading] = useState(false)
  const [nomAgence, setNomAgence] = useState('Mon Agence')
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [caution, setCaution] = useState('')
  const [places, setPlaces] = useState('5')
  const [kmJour, setKmJour] = useState('300')
  
  const [carburant, setCarburant] = useState(CARBURANTS[0])
  const [boite, setBoite] = useState(BOITES[0])
  const [categorie, setCategorie] = useState(CATEGORIES[0])
  const [wilaya, setWilaya] = useState(WILAYAS[0])
  
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // Récupère automatiquement le nom de l'agence si présent dans le profil
    async function fetchAgenceName() {
      if (!session?.user?.id) return
      const { data } = await supabase
        .from('profils')
        .select('nom')
        .eq('id', session.user.id)
        .single()
      if (data?.nom) setNomAgence(data.nom)
    }
    fetchAgenceName()
  }, [session])

  // --- Fonction pour uploader l'image vers Supabase Storage ---
  async function uploadPhoto(uri: string) {
    try {
      setUploading(true)
      const response = await fetch(uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()
      
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error } = await supabase.storage
        .from('voitures')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        })

      if (error) throw error

      const { data: publicData } = supabase.storage
        .from('voitures')
        .getPublicUrl(filePath)

      setImageUrl(publicData.publicUrl)
    } catch (error: any) {
      console.error(error)
      Alert.alert('Erreur d\'upload', "Impossible d'envoyer la photo : " + error.message)
    } finally {
      setUploading(false)
    }
  }

  // --- OPTION 1 : Prendre une photo avec l'appareil photo ---
  async function prendrePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "L'accès à l'appareil photo a été refusé.")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri
      setImageUri(uri)
      await uploadPhoto(uri)
    }
  }

  // --- OPTION 2 : Choisir une photo existante depuis la galerie ---
  async function choisirPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "L'accès à la galerie de photos a été refusé.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri
      setImageUri(uri)
      await uploadPhoto(uri)
    }
  }

  // --- Afficher la boîte de dialogue de sélection ---
  function selectionnerSourcePhoto() {
    Alert.alert(
      "Ajouter une photo du véhicule",
      "Sélectionnez une méthode d'importation :",
      [
        { text: "📸 Prendre une photo", onPress: prendrePhoto },
        { text: "🖼 Choisir depuis la galerie", onPress: choisirPhoto },
        { text: "Annuler", style: "cancel" }
      ]
    )
  }

  async function handleAjouter() {
    if (!nom || !prix) {
      Alert.alert('Champs requis', 'Veuillez renseigner au moins le nom et le prix par jour.')
      return
    }
    if (!imageUrl) {
      Alert.alert('Photo manquante', 'Veuillez ajouter une image du véhicule avant de l\'enregistrer.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('voitures').insert({
        nom,
        prix: parseFloat(prix),
        caution: caution ? parseFloat(caution) : 0,
        places: parseInt(places) || 5,
        km_jour: parseInt(kmJour) || 300,
        carburant,
        boite,
        categorie,
        wilaya,
        image_url: imageUrl,
        statut: 'disponible',
        agence: nomAgence,
      })

      if (error) throw error

      Alert.alert('Succès ! 🎉', 'Le véhicule a bien été ajouté.', [
        { text: 'Continuer', onPress: () => router.replace('/dashboard' as any) }
      ])
    } catch (error: any) {
      Alert.alert('Erreur', "Échec de la création : " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Ajouter un véhicule</Text>
      
      {/* Zone d'importation de la photo */}
      <TouchableOpacity style={s.uploadArea} onPress={selectionnerSourcePhoto} disabled={uploading}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={s.uploadPreview} />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginBottom: 6 }}>📸</Text>
            <Text style={s.uploadTitle}>{uploading ? 'Envoi en cours...' : 'Ajouter une photo'}</Text>
            <Text style={s.uploadSub}>Prendre une photo ou Galerie</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Formulaire */}
      <Text style={s.sectionLabel}>INFORMATIONS GÉNÉRALES</Text>
      
      <Text style={s.fieldLabel}>Nom du véhicule (ex: Golf 8, Hilux...)</Text>
      <View style={s.field}>
        <TextInput 
          style={s.fieldInput} 
          placeholder="Modèle et marque" 
          placeholderTextColor={TEXT3}
          value={nom} 
          onChangeText={setNom} 
        />
      </View>

      <Text style={s.fieldLabel}>Prix de location par jour (DA)</Text>
      <View style={s.field}>
        <TextInput 
          style={s.fieldInput} 
          placeholder="Ex: 8000" 
          placeholderTextColor={TEXT3}
          keyboardType="numeric"
          value={prix} 
          onChangeText={setPrix} 
        />
      </View>

      <Text style={s.fieldLabel}>Montant de la caution (DA)</Text>
      <View style={s.field}>
        <TextInput 
          style={s.fieldInput} 
          placeholder="Ex: 50000 (Optionnel)" 
          placeholderTextColor={TEXT3}
          keyboardType="numeric"
          value={caution} 
          onChangeText={setCaution} 
        />
      </View>

      <Text style={s.sectionLabel}>CARACTÉRISTIQUES</Text>

      <Text style={s.fieldLabel}>Type de carburant</Text>
      <View style={s.chips}>
        {CARBURANTS.map((c) => (
          <TouchableOpacity 
            key={c} 
            style={[s.chip, carburant === c && s.chipActive]} 
            onPress={() => setCarburant(c)}
          >
            <Text style={[s.chipText, carburant === c && s.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>Boîte de vitesse</Text>
      <View style={s.chips}>
        {BOITES.map((b) => (
          <TouchableOpacity 
            key={b} 
            style={[s.chip, boite === b && s.chipActive]} 
            onPress={() => setBoite(b)}
          >
            <Text style={[s.chipText, boite === b && s.chipTextActive]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>Catégorie</Text>
      <View style={s.chips}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity 
            key={cat} 
            style={[s.chip, categorie === cat && s.chipActive]} 
            onPress={() => setCategorie(cat)}
          >
            <Text style={[s.chipText, categorie === cat && s.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>Wilaya de disponibilité</Text>
      <View style={s.chips}>
        {WILAYAS.map((w) => (
          <TouchableOpacity 
            key={w} 
            style={[s.chip, wilaya === w && s.chipActive]} 
            onPress={() => setWilaya(w)}
          >
            <Text style={[s.chipText, wilaya === w && s.chipTextActive]}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLabel}>RÉCAPITULATIF</Text>
      <View style={s.summaryBox}>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Agence émettrice</Text>
          <Text style={s.summaryVal}>{nomAgence}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryKey}>Statut initial</Text>
          <Text style={[s.summaryVal, { color: '#10B981' }]}>Disponible</Text>
        </View>
      </View>

      <TouchableOpacity style={s.btnPrimary} onPress={handleAjouter} disabled={loading || uploading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnPrimaryText}>✨ Publier le véhicule</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: TEXT, marginBottom: 20 },
  
  uploadArea: { height: 160, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 10 },
  uploadPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 2 },
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
  
  btnPrimary: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10, marginBottom: 30 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})