import { useEffect, useState } from 'react'
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// --- Couleurs du thème ---
const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD_ACTIVE = '#243352'
const GOLD = '#F59E0B'; const GREEN = '#10B981'; const BLUE = '#2563EB'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'

function formatDate(d: Date) {
    return d.toISOString().split('T')[0]
}

export default function ReservationConfirm() {
    const router = useRouter()
    const params = useLocalSearchParams()
    const { session } = useAuth()

    const [loading, setLoading] = useState(false)
    const [loadingVoiture, setLoadingVoiture] = useState(true)
    const [nomVoiture, setNomVoiture] = useState('')
    const [nomAgence, setNomAgence] = useState('')
    const [prixJour, setPrixJour] = useState(0)

    // Récupération de l'ID de la voiture depuis l'URL (?id=...)
    const idVoiture = params.id as string

    // Dates : si transmises depuis la fiche voiture (?date_debut=&date_fin=),
    // sinon période par défaut de 6 jours à partir d'aujourd'hui.
    const dateDebut = (params.date_debut as string) || formatDate(new Date())
    const dateFin = (params.date_fin as string) || formatDate(new Date(Date.now() + 6 * 86400000))
    const duree = Math.max(1, Math.round((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 86400000))

    const total = duree * prixJour

    useEffect(() => {
        if (idVoiture) fetchVoiture()
        else setLoadingVoiture(false)
    }, [idVoiture])

    async function fetchVoiture() {
        const { data, error } = await supabase
            .from('voitures')
            .select('nom, prix, agence')
            .eq('id', idVoiture)
            .single()

        if (!error && data) {
            setNomVoiture(data.nom)
            setPrixJour(data.prix)
            setNomAgence(data.agence ?? '')
        } else {
            Alert.alert('Erreur', "Impossible de charger les informations du véhicule.")
        }
        setLoadingVoiture(false)
    }

    // --- Fonction de Confirmation ---
    async function handleConfirm() {
        if (!session?.user?.id) {
            return Alert.alert("Erreur", "Vous devez être connecté pour réserver.")
        }

        if (!idVoiture) {
            return Alert.alert("Erreur", "Aucun véhicule sélectionné.")
        }

        setLoading(true)

        try {
            // 1. Envoi à Supabase
            const { error } = await supabase
                .from('reservations')
                .insert({
                    voiture_id: idVoiture,
                    user_id: session.user.id,
                    statut: 'en_attente',
                    montant: total,
                    date_debut: dateDebut,
                    date_fin: dateFin,
                })
            if (error) throw error

            // 2. Alerte et Redirection
            Alert.alert(
                "✅ Réservation envoyée",
                "Votre demande a bien été transmise à l'agence. Elle est actuellement en attente de validation.",
                [
                    {
                        text: "Génial !",
                        onPress: () => router.replace('/reservations' as any)
                    }
                ]
            )

        } catch (err: any) {
            console.error(err)
            Alert.alert("Erreur", "Impossible d'envoyer la réservation : " + err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loadingVoiture) {
        return (
            <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={GOLD} />
            </View>
        )
    }

    return (
        <View style={s.container}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

                {/* CARTE 1 : Récapitulatif du prix */}
                <View style={s.card}>
                    {!!nomVoiture && (
                        <View style={[s.row, { marginBottom: 6 }]}>
                            <Text style={s.label}>Véhicule</Text>
                            <Text style={s.value}>{nomVoiture}</Text>
                        </View>
                    )}
                    {!!nomAgence && (
                        <View style={[s.row, { marginBottom: 12 }]}>
                            <Text style={s.label}>Agence</Text>
                            <Text style={s.value}>{nomAgence}</Text>
                        </View>
                    )}

                    <View style={s.row}>
                        <Text style={s.label}>Durée</Text>
                        <Text style={s.value}>{duree} jour{duree > 1 ? 's' : ''}</Text>
                    </View>

                    <View style={[s.row, { marginTop: 12 }]}>
                        <Text style={s.label}>Prix / jour</Text>
                        <Text style={s.value}>{prixJour.toLocaleString('fr-DZ')} DA</Text>
                    </View>

                    <View style={s.divider} />

                    <View style={s.row}>
                        <Text style={s.totalLabel}>Total</Text>
                        <Text style={s.totalValue}>{total.toLocaleString('fr-DZ')} DA</Text>
                    </View>
                </View>

                {/* CARTE 2 : Documents à apporter */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <Text style={s.cardIcon}>📄</Text>
                        <Text style={s.cardTitle}>Documents à apporter</Text>
                    </View>

                    <View style={s.checkItem}>
                        <Text style={s.checkMark}>✓</Text>
                        <Text style={s.checkText}>Permis de conduire</Text>
                    </View>
                    <View style={s.checkItem}>
                        <Text style={s.checkMark}>✓</Text>
                        <Text style={s.checkText}>Carte nationale d'identité</Text>
                    </View>
                    <View style={s.checkItem}>
                        <Text style={s.checkMark}>✓</Text>
                        <Text style={s.checkText}>Caution : 20 000 DA</Text>
                    </View>
                </View>

                {/* CARTE 3 : Mode de paiement */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <Text style={s.cardIcon}>💳</Text>
                        <Text style={s.cardTitle}>Mode de paiement</Text>
                    </View>

                    {/* Option 1 : Active */}
                    <View style={[s.paymentOption, s.paymentOptionActive]}>
                        <Text style={s.paymentIcon}>💵</Text>
                        <Text style={s.paymentTextActive}>Paiement à l'agence</Text>
                        <View style={s.radioOuter}>
                            <View style={s.radioInner} />
                        </View>
                    </View>

                    {/* Option 2 : Inactive */}
                    <View style={[s.paymentOption, { marginTop: 10 }]}>
                        <Text style={s.paymentIcon}>💳</Text>
                        <Text style={s.paymentText}>CIB / Edahabia (bientôt)</Text>
                    </View>
                </View>

            </ScrollView>

            {/* BOUTONS D'ACTION (Fixés en bas) */}
            <View style={s.footer}>
                <TouchableOpacity
                    style={s.btnModifier}
                    onPress={() => router.back()}
                    disabled={loading}
                >
                    <Text style={s.btnModifierText}>← Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.btnConfirmer, loading && { opacity: 0.7 }]}
                    onPress={handleConfirm}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={NAVY} />
                    ) : (
                        <Text style={s.btnConfirmerText}>✅ Confirmer</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: NAVY },
    content: { padding: 16, paddingBottom: 100 },

    // Cartes
    card: { backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: TEXT2, fontSize: 14 },
    value: { color: TEXT, fontSize: 14, fontWeight: '700' },
    divider: { height: 1, backgroundColor: BORDER, marginVertical: 16 },
    totalLabel: { color: TEXT, fontSize: 16, fontWeight: '800' },
    totalValue: { color: GOLD, fontSize: 18, fontWeight: '800' },

    // En-têtes de cartes
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
    cardIcon: { fontSize: 18 },
    cardTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },

    // Checkbox (Documents)
    checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    checkMark: { color: GREEN, fontSize: 16, fontWeight: 'bold' },
    checkText: { color: TEXT2, fontSize: 14 },

    // Modes de paiement
    paymentOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
    paymentOptionActive: { backgroundColor: CARD_ACTIVE, borderColor: BLUE },
    paymentIcon: { fontSize: 18, marginRight: 12 },
    paymentText: { flex: 1, color: TEXT2, fontSize: 14, fontWeight: '500' },
    paymentTextActive: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '700' },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: BLUE, justifyContent: 'center', alignItems: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },

    // Footer / Boutons
    footer: { flexDirection: 'row', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: NAVY, gap: 12 },

    btnModifier: { flex: 1, backgroundColor: CARD, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderWidth: 1, borderColor: BORDER },
    btnModifierText: { color: TEXT, fontSize: 15, fontWeight: '600' },

    btnConfirmer: { flex: 2, backgroundColor: GOLD, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
    btnConfirmerText: { color: NAVY, fontSize: 16, fontWeight: '800' },
})
