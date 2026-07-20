import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, timeAgo } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Notif = {
  id: string; titre: string; message: string
  type: string; lu: boolean; created_at: string
}

const TYPE_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  reservation: { icon: 'calendar-outline', color: COLORS.blue, bg: 'rgba(37,99,235,0.15)' },
  confirmation: { icon: 'checkmark-circle-outline', color: COLORS.green, bg: 'rgba(16,185,129,0.15)' },
  annulation: { icon: 'close-circle-outline', color: COLORS.red, bg: 'rgba(239,68,68,0.15)' },
  info: { icon: 'information-circle-outline', color: COLORS.gold, bg: 'rgba(245,158,11,0.15)' },
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()
  const [notifs, setNotifs] = useState<Notif[]>([])

  useEffect(() => {
    fetchNotifs()
    if (!session?.user?.id) return
    const channel = supabase.channel('notifs-screen')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${session.user.id}`
      }, (payload) => setNotifs(prev => [payload.new as Notif, ...prev]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

  async function fetchNotifs() {
    if (!session) return
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setNotifs(data)
  }

  async function marquerTousLus() {
    if (!session) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', session.user.id)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  async function marquerLu(id: string) {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  async function supprimerNotif(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const nonLues = notifs.filter(n => !n.lu).length

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>Notifications</Text>
          {nonLues > 0 && <Text style={s.pageSub}>{nonLues} non lue{nonLues > 1 ? 's' : ''}</Text>}
        </View>
        {nonLues > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={marquerTousLus}>
            <Text style={s.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifs.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.text3} />
          <Text style={s.emptyTitle}>Aucune notification</Text>
          <Text style={s.emptySub}>Vous serez notifié ici de toute activité</Text>
        </View>
      ) : (
        notifs.map(notif => {
          const st = TYPE_STYLE[notif.type] ?? TYPE_STYLE['info']
          return (
            <TouchableOpacity
              key={notif.id}
              style={[s.notifCard, !notif.lu && s.notifCardUnread]}
              onPress={() => marquerLu(notif.id)}
              activeOpacity={0.8}
              onLongPress={() => supprimerNotif(notif.id)}
            >
              <View style={[s.notifIcon, { backgroundColor: st.bg }]}>
                <Ionicons name={st.icon as any} size={20} color={st.color} />
              </View>
              <View style={s.notifBody}>
                <View style={s.notifTop}>
                  <Text style={s.notifTitre}>{notif.titre}</Text>
                  {!notif.lu && <View style={s.unreadDot} />}
                </View>
                <Text style={s.notifMessage}>{notif.message}</Text>
                <Text style={s.notifTime}>{timeAgo(notif.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )
        })
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, backgroundColor: COLORS.card, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border3 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  pageSub: { fontSize: 13, color: COLORS.text2, marginTop: 2 },
  markAllBtn: { backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
  markAllText: { fontSize: 12, color: COLORS.blueLight, fontWeight: '600' },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, marginBottom: 10, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: COLORS.border3 },
  notifCardUnread: { borderColor: 'rgba(37,99,235,0.3)', backgroundColor: 'rgba(37,99,235,0.05)' },
  notifIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitre: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.blue, marginLeft: 6 },
  notifMessage: { fontSize: 13, color: COLORS.text2, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: COLORS.text3 },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.text2, textAlign: 'center' },
})
