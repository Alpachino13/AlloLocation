import { useEffect, useState } from 'react'
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, formatDA } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function displayDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ReservationConfirm() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(false)
  const [loadingVoiture, setLoadingVoiture] = useState(true)
  const [nomVoiture, setNomVoiture] = useState('')
  const [nomAgence, setNomAgence] = useState('')
  const [prixJour, setPrixJour] = useState(0)
  const [voitureStatut, setVoitureStatut] = useState('disponible')

  const idVoiture = params.id as string

  // Dates depuis params ou défaut
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const defaultFin = new Date(today)
  defaultFin.setDate(today.getDate() + 3)

  const [dateDebut, setDateDebut] = useState((params.date_debut as string) || formatDate(today))
  const [dateFin, setDateFin] = useState((params.date_fin as string) || formatDate(defaultFin))

  const duree = Math.max(1, Math.round((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 86400000))
  const total = duree * prixJour

  useEffect(() => {
    if (idVoiture) fetchVoiture()
    else setLoadingVoiture(false)
  }, [idVoiture])

  async function fetchVoiture() {
    const { data, error } = await supabase
      .from('voitures')
      .select('nom, prix, agence, statut')
      .eq('id', idVoiture)
      .single()

    if (!error && data) {
      setNomVoiture(data.nom)
      setPrixJour(data.prix)
      setNomAgence(data.agence ?? '')
      setVoitureStatut(data.statut ?? 'disponible')
    } else {
      Alert.alert('Erreur', "Impossible de charger les informations du véhicule.")
    }
    setLoadingVoiture(false)
  }

  async function handleConfirm() {
    if (!session?.user?.id) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour réserver.')
      return
    }
    if (!idVoiture) {
      Alert.alert('Erreur', 'Aucun véhicule sélectionné.')
      return
    }
    if (voitureStatut !== 'disponible') {
      Alert.alert('Indisponible', "Ce véhicule n'est plus disponible.")
      return
    }

    // Validation dates
    const debut = new Date(dateDebut)
    const fin = new Date(dateFin)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (debut < now) {
      Alert.alert('Date invalide', 'La date de départ ne peut pas être dans le passé.')
      return
    }
    if (fin <= debut) {
      Alert.alert('Date invalide', 'La date de retour doit être après la date de départ.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from('reservations').insert({
        voiture_id: idVoiture,
        user_id: session.user.id,
        statut: 'en_attente',
        montant: total,
        date_debut: dateDebut,
        date_fin: dateFin,
      })
      if (error) throw error

      // Créer notification pour l'agence
      const { data: voiture } = await supabase.from('voitures').select('agence_id').eq('id', idVoiture).single()
      if (voiture?.agence_id) {
        await supabase.from('notifications').insert({
          user_id: voiture.agence_id,
          titre: 'Nouvelle réservation',
          message: `Nouvelle demande pour ${nomVoiture}`,
          type: 'reservation',
        })
      }

      Alert.alert(
        '✅ Réservation envoyée',
        `Votre demande pour ${nomVoiture} a été transmise à ${nomAgence}. Vous serez notifié dès qu'elle sera traitée.`,
        [{ text: 'Voir mes réservations', onPress: () => router.replace('/reservations') }]
      )
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible d'envoyer la réservation.")
    } finally {
      setLoading(false)
    }
  }

  if (loadingVoiture) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Confirmer la réservation</Text>
        </View>

        {/* Récap véhicule */}
        <View style={s.card}>
          {nomVoiture && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>Véhicule</Text>
              <Text style={s.value}>{nomVoiture}</Text>
            </View>
          )}
          {nomAgence && (
            <View style={[s.row, { marginBottom: 12 }]}>
              <Text style={s.label}>Agence</Text>
              <Text style={s.value}>{nomAgence}</Text>
            </View>
          )}

          <View style={s.row}>
            <Text style={s.label}>Du</Text>
            <Text style={s.value}>{displayDate(dateDebut)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Au</Text>
            <Text style={s.value}>{displayDate(dateFin)}</Text>
          </View>
          <View style={[s.row, { marginTop: 8 }]}>
            <Text style={s.label}>Durée</Text>
            <Text style={s.value}>{duree} jour{duree > 1 ? 's' : ''}</Text>
          </View>
          <View style={[s.row, { marginTop: 8 }]}>
            <Text style={s.label}>Prix / jour</Text>
            <Text style={s.value}>{formatDA(prixJour)}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.row}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatDA(total)}</Text>
          </View>
        </View>

        {/* Documents */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.blue} />
            <Text style={s.cardTitle}>Documents à apporter</Text>
          </View>
          {[
            { icon: 'card-outline', text: 'Permis de conduire algérien valide' },
            { icon: 'id-card-outline', text: "Carte nationale d'identité (CNI)" },
            { icon: 'cash-outline', text: 'Caution : 20 000 DA (remboursable)' },
          ].map((item, i) => (
            <View key={i} style={s.checkItem}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
              <Text style={s.checkText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Paiement */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="card-outline" size={20} color={COLORS.gold} />
            <Text style={s.cardTitle}>Mode de paiement</Text>
          </View>
          <View style={[s.paymentOption, s.paymentOptionActive]}>
            <Ionicons name="cash-outline" size={20} color={COLORS.gold} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.paymentTextActive}>Paiement à l'agence</Text>
              <Text style={s.paymentSub}>En espèces ou par CIB/Edahabia</Text>
            </View>
            <View style={s.radioOuter}><View style={s.radioInner} /></View>
          </View>
          <View style={[s.paymentOption, { marginTop: 10, opacity: 0.5 }]}>
            <Ionicons name="phone-portrait-outline" size={20} color={COLORS.text3} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.paymentText}>Paiement en ligne</Text>
              <Text style={s.paymentSub}>CIB / Edahabia (bientôt disponible)</Text>
            </View>
          </View>
        </View>

        {/* Contrat */}
        <View style={[s.card, { backgroundColor: 'rgba(37,99,235,0.08)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.blue} />
            <Text style={{ fontSize: 13, color: COLORS.blueLight, flex: 1, lineHeight: 18 }}>
              En confirmant, vous acceptez les conditions de location et vous engagez à fournir les documents requis.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 12 : 16 }]}>
        <TouchableOpacity style={s.btnModifier} onPress={() => router.back()} disabled={loading}>
          <Text style={s.btnModifierText}>← Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnConfirmer, loading && { opacity: 0.7 }]} onPress={handleConfirm} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.navy} /> : <Text style={s.btnConfirmerText}>✅ Confirmer</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  content: { padding: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 36, height: 36, backgroundColor: COLORS.card, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border3 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: COLORS.border3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: COLORS.text2, fontSize: 14 },
  value: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  totalLabel: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  totalValue: { color: COLORS.gold, fontSize: 20, fontWeight: '800' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  checkText: { color: COLORS.text2, fontSize: 14 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border3 },
  paymentOptionActive: { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: COLORS.blue },
  paymentText: { flex: 1, color: COLORS.text2, fontSize: 14, fontWeight: '500' },
  paymentTextActive: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  paymentSub: { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.blue, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.blue },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.navy, gap: 12 },
  btnModifier: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderWidth: 1, borderColor: COLORS.border3 },
  btnModifierText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  btnConfirmer: { flex: 2, backgroundColor: COLORS.gold, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  btnConfirmerText: { color: COLORS.navy, fontSize: 16, fontWeight: '800' },
})
