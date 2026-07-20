import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, Modal, TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { COLORS, formatDA } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Profil() {
  const router = useRouter()
  const { session, role, signOut } = useAuth()
  const insets = useSafeAreaInsets()

  const email = session?.user?.email ?? 'Utilisateur'
  const roleLabel = role === 'agence' ? '🏢 Agence' : role === 'admin' ? '⚡ Admin' : '👤 Client'

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [wilaya, setWilaya] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [nbReservations, setNbReservations] = useState(0)
  const [nbFavoris, setNbFavoris] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [editNom, setEditNom] = useState('')
  const [editTel, setEditTel] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchProfilData = useCallback(async () => {
    if (!session?.user?.id) return
    const userId = session.user.id

    const { data: profilData } = await supabase.from('profils').select('nom,telephone,wilaya,photo_url').eq('id', userId).single()
    if (profilData) {
      setNom(profilData.nom ?? '')
      setTelephone(profilData.telephone ?? '')
      setWilaya(profilData.wilaya ?? '')
      setPhotoUrl(profilData.photo_url ?? null)
      setEditNom(profilData.nom ?? '')
      setEditTel(profilData.telephone ?? '')
    }

    const { count: resCount } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    setNbReservations(resCount ?? 0)

    const { count: favCount } = await supabase.from('favoris').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    setNbFavoris(favCount ?? 0)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { fetchProfilData() }, [fetchProfilData])

  async function saveProfil() {
    if (!session?.user?.id) return
    setSaving(true)
    const { error } = await supabase.from('profils').update({
      nom: editNom.trim(),
      telephone: editTel.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', session.user.id)
    setSaving(false)
    if (error) Alert.alert('Erreur', error.message)
    else {
      setNom(editNom.trim())
      setTelephone(editTel.trim())
      setEditModal(false)
    }
  }

  async function handleSignOut() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: signOut }
    ])
  }

  const menuItems = [
    { icon: 'calendar-outline', label: 'Mes réservations', value: String(nbReservations), onPress: () => router.push('/reservations') },
    { icon: 'heart-outline', label: 'Mes favoris', value: String(nbFavoris), onPress: () => router.push('/favoris') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
    { icon: 'help-circle-outline', label: 'Aide & support', onPress: () => {} },
  ]

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Mon profil</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditModal(true)}>
          <Ionicons name="create-outline" size={18} color={COLORS.blueLight} />
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileBanner} />
        <View style={styles.profileBody}>
          <View style={styles.avatar}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%', borderRadius: 35 }} />
            ) : (
              <Text style={styles.avatarText}>{(nom || email)[0]?.toUpperCase() ?? 'U'}</Text>
            )}
          </View>
          <View style={{ paddingTop: 38, flex: 1 }}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.blue} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
            ) : (
              <>
                <Text style={styles.profileName} numberOfLines={1}>{nom || 'Utilisateur'}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
                {telephone && <Text style={styles.profileTel}>📞 {telephone}</Text>}
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: COLORS.blue }]}>{loading ? '—' : nbReservations}</Text>
          <Text style={styles.statLabel}>Réservations</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: COLORS.gold }]}>{loading ? '—' : nbFavoris}</Text>
          <Text style={styles.statLabel}>Favoris</Text>
        </View>
      </View>

      {/* Menu */}
      {menuItems.map((item, i) => (
        <TouchableOpacity key={item.label} style={[styles.menuItem, i === 0 && { borderTopWidth: 0 }]} onPress={item.onPress}>
          <View style={styles.menuIcon}>
            <Ionicons name={item.icon as any} size={18} color={COLORS.text2} />
          </View>
          <Text style={styles.menuLabel}>{item.label}</Text>
          {item.value && <Text style={styles.menuValue}>{item.value}</Text>}
          <Ionicons name="chevron-forward" size={16} color={COLORS.text3} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.menuItem, { marginTop: 10 }]} onPress={handleSignOut}>
        <View style={[styles.menuIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
        </View>
        <Text style={[styles.menuLabel, { color: COLORS.redLight }]}>Se déconnecter</Text>
      </TouchableOpacity>

      <View style={{ height: 80 }} />

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le profil</Text>
            <Text style={styles.modalLabel}>Nom</Text>
            <TextInput style={styles.modalInput} value={editNom} onChangeText={setEditNom} placeholder="Votre nom" placeholderTextColor={COLORS.text3} />
            <Text style={styles.modalLabel}>Téléphone</Text>
            <TextInput style={styles.modalInput} value={editTel} onChangeText={setEditTel} placeholder="05XX XX XX XX" placeholderTextColor={COLORS.text3} keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { flex: 1, backgroundColor: COLORS.card }]} onPress={() => setEditModal(false)}>
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { flex: 1, backgroundColor: COLORS.blue }]} onPress={saveProfil} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Sauvegarder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  editBtn: { width: 36, height: 36, backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
  profileCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border3, overflow: 'hidden' },
  profileBanner: { height: 70, backgroundColor: COLORS.blueDark },
  profileBody: { padding: 20, paddingTop: 0, position: 'relative' },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.blue, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.navy, position: 'absolute', top: -35, left: 20, overflow: 'hidden' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  profileName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  profileEmail: { fontSize: 13, color: COLORS.text2, marginVertical: 4 },
  profileTel: { fontSize: 13, color: COLORS.blueLight, marginBottom: 6 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.blueLight },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: COLORS.border3, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: COLORS.text2, marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  menuIcon: { width: 36, height: 36, backgroundColor: COLORS.card, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text, flex: 1 },
  menuValue: { fontSize: 13, color: COLORS.text3, marginRight: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: COLORS.border3 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text2, marginBottom: 6, marginTop: 10 },
  modalInput: { backgroundColor: COLORS.navy, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 15, borderWidth: 0.5, borderColor: COLORS.border3 },
  modalBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
})
