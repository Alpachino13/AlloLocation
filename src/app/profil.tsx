import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { COLORS } from '../constants'

type MenuItem = {
  icon: string; label: string; value?: string; onPress: () => void; danger?: boolean
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <TouchableOpacity style={[s.menuRow, item.danger && { opacity: 0.9 }]} onPress={item.onPress} activeOpacity={0.75}>
      <View style={[s.menuIconBox, item.danger && { backgroundColor: "rgba(239,68,68,0.1)" }]}>
        <Ionicons name={item.icon as any} size={18} color={item.danger ? COLORS.redLight : COLORS.text2} />
      </View>
      <Text style={[s.menuLabel, item.danger && { color: COLORS.redLight }]}>{item.label}</Text>
      {item.value !== undefined && <Text style={s.menuValue}>{item.value}</Text>}
      {!item.danger && <Ionicons name="chevron-forward" size={15} color={COLORS.text3} />}
    </TouchableOpacity>
  )
}

export default function Profil() {
  const router = useRouter()
  const { session, role, signOut } = useAuth()
  const insets = useSafeAreaInsets()

  const email = session?.user?.email ?? ''
  const roleLabel = role === 'agence' ? 'Agence' : role === 'admin' ? 'Admin' : 'Client'
  const roleIcon: any = role === 'agence' ? 'business-outline' : role === 'admin' ? 'flash-outline' : 'person-outline'
  const roleColor = role === 'agence' ? COLORS.blueLight : role === 'admin' ? COLORS.gold : COLORS.text2

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [nbReservations, setNbReservations] = useState(0)
  const [nbFavoris, setNbFavoris] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [editNom, setEditNom] = useState('')
  const [editTel, setEditTel] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return
    const id = session.user.id
    const { data: p } = await supabase.from('profils').select('nom,telephone,photo_url').eq('id', id).single()
    if (p) { setNom(p.nom ?? ''); setTelephone(p.telephone ?? ''); setPhotoUrl(p.photo_url ?? null); setEditNom(p.nom ?? ''); setEditTel(p.telephone ?? '') }
    const { count: rc } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('user_id', id)
    setNbReservations(rc ?? 0)
    const { count: fc } = await supabase.from('favoris').select('*', { count: 'exact', head: true }).eq('user_id', id)
    setNbFavoris(fc ?? 0)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveProfil() {
    if (!session?.user?.id) return
    setSaving(true)
    const { error } = await supabase.from('profils').update({ nom: editNom.trim(), telephone: editTel.trim(), updated_at: new Date().toISOString() }).eq('id', session.user.id)
    setSaving(false)
    if (error) Alert.alert('Erreur', error.message)
    else { setNom(editNom.trim()); setTelephone(editTel.trim()); setEditModal(false) }
  }

  const menuItems: MenuItem[] = [
    { icon: 'calendar-outline', label: 'Mes réservations', value: String(nbReservations), onPress: () => router.push('/reservations') },
    { icon: 'heart-outline', label: 'Mes favoris', value: String(nbFavoris), onPress: () => router.push('/favoris') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
    { icon: 'help-circle-outline', label: 'Aide & support', onPress: () => {} },
  ]

  const initials = (nom || email || 'U')[0]?.toUpperCase() ?? 'U'

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.pageTitle}>Mon profil</Text>
          <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={17} color={COLORS.blueLight} />
          </TouchableOpacity>
        </View>

        {/* ── Profile card ── */}
        <View style={s.profileCard}>
          <View style={s.banner} />
          <View style={s.cardBody}>
            <View style={s.avatarWrap}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={s.avatarImg} />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={s.profileInfo}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.blue} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
              ) : (
                <>
                  <Text style={s.profileName} numberOfLines={1}>{nom || 'Utilisateur'}</Text>
                  <Text style={s.profileEmail} numberOfLines={1}>{email}</Text>
                  {telephone ? (
                    <View style={s.telRow}>
                      <Ionicons name="call-outline" size={12} color={COLORS.text3} />
                      <Text style={s.profileTel}>{telephone}</Text>
                    </View>
                  ) : null}
                  <View style={s.roleBadge}>
                    <Ionicons name={roleIcon} size={11} color={roleColor} />
                    <Text style={[s.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: COLORS.blueLight }]}>{loading ? '—' : nbReservations}</Text>
            <Text style={s.statLabel}>Réservations</Text>
          </View>
          <View style={[s.statCard, { borderColor: COLORS.border2 }]}>
            <Text style={[s.statVal, { color: COLORS.gold }]}>{loading ? '—' : nbFavoris}</Text>
            <Text style={s.statLabel}>Favoris</Text>
          </View>
        </View>

        {/* ── Menu ── */}
        <View style={s.menuSection}>
          <Text style={s.menuSectionTitle}>Compte</Text>
          <View style={s.menuCard}>
            {menuItems.map((item, i) => (
              <View key={item.label}>
                <MenuRow item={item} />
                {i < menuItems.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={s.menuSection}>
          <View style={s.menuCard}>
            <MenuRow item={{
              icon: 'log-out-outline',
              label: 'Se déconnecter',
              danger: true,
              onPress: () => Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnecter', style: 'destructive', onPress: signOut }
              ]),
            }} />
          </View>
        </View>

      </ScrollView>

      {/* ── Edit modal ── */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Modifier le profil</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text2} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalLabel}>Nom complet</Text>
            <TextInput style={s.modalInput} value={editNom} onChangeText={setEditNom} placeholder="Votre nom" placeholderTextColor={COLORS.text3} />
            <Text style={s.modalLabel}>Téléphone</Text>
            <TextInput style={s.modalInput} value={editTel} onChangeText={setEditTel} placeholder="05XX XX XX XX" placeholderTextColor={COLORS.text3} keyboardType="phone-pad" />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(false)} activeOpacity={0.8}>
                <Text style={{ color: COLORS.text2, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={saveProfil} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Sauvegarder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.navyLight },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  pageTitle:      { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  editBtn:        { width: 38, height: 38, backgroundColor: COLORS.blueMuted, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },

  profileCard:    { marginHorizontal: 20, marginBottom: 16, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border2, overflow: 'hidden' },
  banner:         { height: 72, backgroundColor: COLORS.blueDark, opacity: 0.7 },
  cardBody:       { padding: 16, paddingTop: 0, position: 'relative' },
  avatarWrap:     { position: 'absolute', top: -32, left: 16 },
  avatar:         { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.blue, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.navyLight },
  avatarImg:      { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: COLORS.navyLight },
  avatarText:     { color: '#fff', fontSize: 24, fontWeight: '800' },
  profileInfo:    { paddingTop: 36 },
  profileName:    { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  profileEmail:   { fontSize: 13, color: COLORS.text2, marginBottom: 4 },
  telRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  profileTel:     { fontSize: 13, color: COLORS.text3 },
  roleBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: COLORS.blueMuted, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },
  roleBadgeText:  { fontSize: 11, fontWeight: '600' },

  statsRow:       { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginBottom: 20 },
  statCard:       { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border2, alignItems: 'center' },
  statVal:        { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  statLabel:      { fontSize: 11, color: COLORS.text3, fontWeight: '500' },

  menuSection:    { paddingHorizontal: 20, marginBottom: 16 },
  menuSectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  menuCard:       { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border2, overflow: 'hidden' },
  menuRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  menuIconBox:    { width: 36, height: 36, backgroundColor: COLORS.card2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel:      { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  menuValue:      { fontSize: 13, color: COLORS.text3, marginRight: 4 },
  divider:        { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  modalBox:       { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border2 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 7, marginTop: 12 },
  modalInput:     { backgroundColor: COLORS.card2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border2 },
  modalBtns:      { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtnCancel: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.card2, borderWidth: 1, borderColor: COLORS.border2 },
  modalBtnSave:   { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.blue },

  
})
