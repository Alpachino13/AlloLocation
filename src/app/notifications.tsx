import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NAVY = '#0A1628'; const CARD = '#1E2D45'
const BLUE = '#2563EB'; const GOLD = '#F59E0B'
const GREEN = '#10B981'; const RED = '#EF4444'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER2 = 'rgba(255,255,255,0.12)'

type Notif = {
  id: string; titre: string; message: string
  type: string; lu: boolean; created_at: string
}

const TYPE_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  reservation: { icon: '📅', color: BLUE, bg: 'rgba(37,99,235,0.15)' },
  confirmation: { icon: '✅', color: GREEN, bg: 'rgba(16,185,129,0.15)' },
  annulation: { icon: '❌', color: RED, bg: 'rgba(239,68,68,0.15)' },
  info: { icon: '💡', color: GOLD, bg: 'rgba(245,158,11,0.15)' },
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const [notifs, setNotifs] = useState<Notif[]>([])

  useEffect(() => { fetchNotifs() }, [])

  async function fetchNotifs() {
    if (!session) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setNotifs(data)
  }

  async function marquerTousLus() {
    if (!session) return
    await supabase.from('notifications')
      .update({ lu: true })
      .eq('user_id', session.user.id)
    fetchNotifs()
  }

  async function marquerLu(id: string) {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  const nonLues = notifs.filter(n => !n.lu).length

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return "À l'instant"
    if (mins < 60) return `Il y a ${mins} min`
    if (hours < 24) return `Il y a ${hours}h`
    return `Il y a ${days}j`
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.statusBar}>
        <Text style={s.time}>9:41</Text>
        <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
      </View>

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ color: TEXT, fontSize: 18 }}>←</Text>
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
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔔</Text>
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
            >
              <View style={[s.notifIcon, { backgroundColor: st.bg }]}>
                <Text style={{ fontSize: 20 }}>{st.icon}</Text>
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
  container: { flex: 1, backgroundColor: NAVY },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, backgroundColor: CARD, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: BORDER2 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
  pageSub: { fontSize: 13, color: TEXT2, marginTop: 2 },
  markAllBtn: { backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.3)' },
  markAllText: { fontSize: 12, color: '#3B7FF5', fontWeight: '600' },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER2 },
  notifCardUnread: { borderColor: 'rgba(37,99,235,0.3)', backgroundColor: 'rgba(37,99,235,0.05)' },
  notifIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitre: { fontSize: 14, fontWeight: '700', color: TEXT, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginLeft: 6 },
  notifMessage: { fontSize: 13, color: TEXT2, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: TEXT3 },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 13, color: TEXT2, textAlign: 'center' },
})