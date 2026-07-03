import { useEffect, useState } from 'react'
import {
    Alert, ScrollView, StyleSheet, Text,
    TouchableOpacity, View
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { envoyerNotification } from '../lib/notifications'

const NAVY = '#0A1628'; const CARD = '#1E2D45'; const CARD2 = '#243352'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'; const GREEN = '#10B981'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER2 = 'rgba(255,255,255,0.12)'
const AGENCE_USER_ID = '4820f4a1-9104-473a-8f92-f0ac6d2224de'

type Voiture = {
    id: string; nom: string; agence: string
    prix: number; carburant: string; places: number
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
}

function formatDateFr(date: Date): string {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function Reservation() {
    const router = useRouter()
    const { id } = useLocalSearchParams()
    const { session } = useAuth()

    const [voiture, setVoiture] = useState<Voiture | null>(null)
    const [loading, setLoading] = useState(false)
    const [dateDebut, setDateDebut] = useState<Date | null>(null)
    const [dateFin, setDateFin] = useState<Date | null>(null)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [step, setStep] = useState<'dates' | 'recap'>('dates')

    useEffect(() => { fetchVoiture() }, [])

    async function fetchVoiture() {
        const { data } = await supabase.from('voitures').select('*').eq('id', id as string).single()
        if (data) setVoiture(data)
    }

    function getDaysInMonth(date: Date) {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        return { firstDay, daysInMonth }
    }

    function handleDayPress(day: number) {
        const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        if (selected < today) return

        if (!dateDebut || (dateDebut && dateFin)) {
            setDateDebut(selected)
            setDateFin(null)
        } else {
            if (selected <= dateDebut) {
                setDateDebut(selected)
                setDateFin(null)
            } else {
                setDateFin(selected)
            }
        }
    }

    function isDaySelected(day: number) {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
        if (dateDebut && formatDate(d) === formatDate(dateDebut)) return 'start'
        if (dateFin && formatDate(d) === formatDate(dateFin)) return 'end'
        if (dateDebut && dateFin && d > dateDebut && d < dateFin) return 'between'
        return null
    }

    function isDayPast(day: number) {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        return d < today
    }

    const nbJours = dateDebut && dateFin
        ? Math.ceil((dateFin.getTime() - dateDebut.getTime()) / 86400000)
        : 0
    const montantTotal = voiture ? voiture.prix * nbJours : 0

    async function confirmerReservation() {
        if (!session) { router.push('/login' as any); return }
        if (!dateDebut || !dateFin || !voiture) return

        setLoading(true)
        const { error } = await supabase.from('reservations').insert({
            voiture_id: voiture.id,
            user_id: session.user.id,
            date_debut: formatDate(dateDebut),
            date_fin: formatDate(dateFin),
            statut: 'en_attente',
            montant: montantTotal,
        })

        if (error) {
            Alert.alert('Erreur', error.message)
            setLoading(false)
            return
        }

        // Notifier le client
        await envoyerNotification({
            userId: session.user.id,
            titre: '📅 Réservation envoyée !',
            message: `Votre demande pour ${voiture.nom} du ${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)} est en attente.`,
            type: 'reservation',
        })

        // Notifier l'agence
        await envoyerNotification({
            userId: AGENCE_USER_ID,
            titre: '🚗 Nouvelle réservation !',
            message: `Un client veut louer ${voiture.nom} du ${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)} — ${montantTotal.toLocaleString()} DA.`,
            type: 'reservation',
        })

        setLoading(false)
        Alert.alert('✅ Réservation envoyée !', "L'agence va confirmer sous peu.", [
            { text: 'OK', onPress: () => router.replace('/reservations' as any) }
        ])
    }

    const { firstDay, daysInMonth } = getDaysInMonth(currentMonth)

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
                <Text style={s.headerTitle}>Réserver</Text>
            </View>

            {/* Voiture info */}
            {voiture && (
                <View style={s.voitureCard}>
                    <View style={s.voitureEmoji}>
                        <Text style={{ fontSize: 28 }}>🚗</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.voitureName}>{voiture.nom}</Text>
                        <Text style={s.voitureAgence}>{voiture.agence}</Text>
                    </View>
                    <Text style={s.voiturePrix}>{voiture.prix.toLocaleString()} DA/j</Text>
                </View>
            )}

            {step === 'dates' && (
                <>
                    {/* Calendrier */}
                    <View style={s.calCard}>
                        {/* Nav mois */}
                        <View style={s.calNav}>
                            <TouchableOpacity
                                style={s.calNavBtn}
                                onPress={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                            >
                                <Text style={{ color: TEXT, fontSize: 18 }}>‹</Text>
                            </TouchableOpacity>
                            <Text style={s.calMonth}>
                                {MOIS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </Text>
                            <TouchableOpacity
                                style={s.calNavBtn}
                                onPress={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                            >
                                <Text style={{ color: TEXT, fontSize: 18 }}>›</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Jours de la semaine */}
                        <View style={s.calWeek}>
                            {JOURS.map(j => (
                                <Text key={j} style={s.calWeekDay}>{j}</Text>
                            ))}
                        </View>

                        {/* Grille des jours */}
                        <View style={s.calGrid}>
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <View key={`empty-${i}`} style={s.calDay} />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1
                                const sel = isDaySelected(day)
                                const past = isDayPast(day)
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        style={[
                                            s.calDay,
                                            sel === 'start' && s.calDayStart,
                                            sel === 'end' && s.calDayEnd,
                                            sel === 'between' && s.calDayBetween,
                                            past && s.calDayPast,
                                        ]}
                                        onPress={() => !past && handleDayPress(day)}
                                        disabled={past}
                                    >
                                        <Text style={[
                                            s.calDayText,
                                            (sel === 'start' || sel === 'end') && s.calDayTextSelected,
                                            past && s.calDayTextPast,
                                        ]}>
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </View>

                    {/* Sélection résumé */}
                    <View style={s.selRow}>
                        <View style={s.selBox}>
                            <Text style={s.selLabel}>Départ</Text>
                            <Text style={s.selDate}>
                                {dateDebut ? formatDateFr(dateDebut) : '— Choisir —'}
                            </Text>
                        </View>
                        <Text style={{ color: TEXT3, fontSize: 20 }}>→</Text>
                        <View style={s.selBox}>
                            <Text style={s.selLabel}>Retour</Text>
                            <Text style={s.selDate}>
                                {dateFin ? formatDateFr(dateFin) : '— Choisir —'}
                            </Text>
                        </View>
                    </View>

                    {nbJours > 0 && (
                        <View style={s.durationBadge}>
                            <Text style={s.durationText}>🕐 {nbJours} nuit{nbJours > 1 ? 's' : ''}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[s.btnPrimary, (!dateDebut || !dateFin) && { opacity: 0.4 }]}
                        disabled={!dateDebut || !dateFin}
                        onPress={() => setStep('recap')}
                    >
                        <Text style={s.btnPrimaryText}>Continuer →</Text>
                    </TouchableOpacity>
                </>
            )}

            {step === 'recap' && voiture && (
                <>
                    <View style={s.recapCard}>
                        <Text style={s.recapTitle}>Récapitulatif</Text>

                        {[
                            { label: 'Véhicule', val: voiture.nom },
                            { label: 'Agence', val: voiture.agence },
                            { label: 'Date de départ', val: formatDateFr(dateDebut!) },
                            { label: 'Date de retour', val: formatDateFr(dateFin!) },
                            { label: 'Durée', val: `${nbJours} jour${nbJours > 1 ? 's' : ''}` },
                            { label: 'Prix / jour', val: `${voiture.prix.toLocaleString()} DA` },
                        ].map((row, i) => (
                            <View key={i} style={s.recapRow}>
                                <Text style={s.recapLabel}>{row.label}</Text>
                                <Text style={s.recapVal}>{row.val}</Text>
                            </View>
                        ))}

                        <View style={s.recapDivider} />
                        <View style={s.recapRow}>
                            <Text style={[s.recapLabel, { fontWeight: '700', color: TEXT }]}>Total</Text>
                            <Text style={s.recapTotal}>{montantTotal.toLocaleString()} DA</Text>
                        </View>
                    </View>

                    {/* Documents requis */}
                    <View style={s.docsCard}>
                        <Text style={s.docsTitle}>📋 Documents à apporter</Text>
                        {["Permis de conduire", "Carte nationale d'identité", "Caution : 20 000 DA"].map(doc => (
                            <View key={doc} style={s.docRow}>
                                <Text style={{ color: GREEN }}>✓</Text>
                                <Text style={s.docText}>{doc}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Paiement */}
                    <View style={s.payCard}>
                        <Text style={s.payTitle}>💳 Mode de paiement</Text>
                        <View style={[s.payOpt, s.payOptActive]}>
                            <Text style={{ fontSize: 20 }}>💵</Text>
                            <Text style={[s.payOptText, { color: TEXT }]}>Paiement à l'agence</Text>
                            <View style={s.payRadioActive} />
                        </View>
                        <View style={s.payOpt}>
                            <Text style={{ fontSize: 20 }}>💳</Text>
                            <Text style={s.payOptText}>CIB / Edahabia (bientôt)</Text>
                        </View>
                    </View>

                    <View style={s.btnRow}>
                        <TouchableOpacity style={s.btnOutline} onPress={() => setStep('dates')}>
                            <Text style={s.btnOutlineText}>← Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.btnConfirm, loading && { opacity: 0.6 }]}
                            onPress={confirmerReservation}
                            disabled={loading}
                        >
                            <Text style={s.btnConfirmText}>
                                {loading ? 'Envoi...' : '✅ Confirmer'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            <View style={{ height: 60 }} />
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
    voitureCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 20, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2 },
    voitureEmoji: { width: 48, height: 48, backgroundColor: CARD2, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    voitureName: { fontSize: 15, fontWeight: '700', color: TEXT },
    voitureAgence: { fontSize: 12, color: TEXT2, marginTop: 2 },
    voiturePrix: { fontSize: 15, fontWeight: '800', color: GOLD },
    calCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: BORDER2 },
    calNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    calNavBtn: { width: 32, height: 32, backgroundColor: CARD2, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    calMonth: { fontSize: 15, fontWeight: '700', color: TEXT },
    calWeek: { flexDirection: 'row', marginBottom: 8 },
    calWeekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: TEXT3 },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calDay: { width: '14.28%', height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
    calDayStart: { backgroundColor: BLUE, borderRadius: 18 },
    calDayEnd: { backgroundColor: BLUE, borderRadius: 18 },
    calDayBetween: { backgroundColor: 'rgba(37,99,235,0.2)' },
    calDayPast: { opacity: 0.3 },
    calDayText: { fontSize: 13, color: TEXT, fontWeight: '500' },
    calDayTextSelected: { color: '#fff', fontWeight: '800' },
    calDayTextPast: { color: TEXT3 },
    selRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 12, gap: 8 },
    selBox: { flex: 1, backgroundColor: CARD, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: BORDER2 },
    selLabel: { fontSize: 11, color: TEXT3, fontWeight: '600', marginBottom: 4 },
    selDate: { fontSize: 13, fontWeight: '600', color: TEXT },
    durationBadge: { alignSelf: 'center', backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
    durationText: { fontSize: 13, fontWeight: '600', color: '#3B7FF5' },
    btnPrimary: { marginHorizontal: 20, backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
    btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    recapCard: { marginHorizontal: 20, marginBottom: 14, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: BORDER2 },
    recapTitle: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 14 },
    recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
    recapLabel: { fontSize: 13, color: TEXT2 },
    recapVal: { fontSize: 13, fontWeight: '600', color: TEXT },
    recapDivider: { height: 1, backgroundColor: BORDER2, marginVertical: 8 },
    recapTotal: { fontSize: 18, fontWeight: '800', color: GOLD },
    docsCard: { marginHorizontal: 20, marginBottom: 14, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: BORDER2 },
    docsTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 12 },
    docRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
    docText: { fontSize: 13, color: TEXT2 },
    payCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: BORDER2 },
    payTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 12 },
    payOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: BORDER2, marginBottom: 8 },
    payOptActive: { borderColor: BLUE, backgroundColor: 'rgba(37,99,235,0.1)' },
    payOptText: { flex: 1, fontSize: 14, color: TEXT2, fontWeight: '500' },
    payRadioActive: { width: 16, height: 16, borderRadius: 8, backgroundColor: BLUE },
    btnRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
    btnOutline: { flex: 1, borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    btnOutlineText: { color: TEXT, fontSize: 14, fontWeight: '600' },
    btnConfirm: { flex: 2, backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    btnConfirmText: { color: '#1a1200', fontSize: 15, fontWeight: '800' },
})