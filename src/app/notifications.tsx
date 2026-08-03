import { useEffect, useState } from 'react'
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COLORS, timeAgo } from '../constants'

type Notif = {
  id: string; titre: string; message: string
  type: string; lu: boolean; created_at: string
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  reservation:  { icon: 'calendar',               color: COLORS.blueLight, bg: COLORS.blueMuted },
  confirmation: { icon: 'checkmark-circle',        color: COLORS.greenLight, bg: COLORS.greenMuted },
  annulation:   { icon: 'close-circle',            color: COLORS.redLight,  bg: COLORS.redMuted },
  info:         { icon: 'information-circle',      color: COLORS.gold,       bg: COLORS.goldMuted },
}

const DEFAULT_META = { icon: 'notifications', color: COLORS.text2, bg: COLORS.card2 }

function NotifCard({ notif, onRead, onDelete }: {
  notif: Notif; onRead: () => void; onDelete: () => void
}) {
  const meta = TYPE_META[notif.type] ?? DEFAULT_META
  return (
    <TouchableOpacity
      style={[s.card, !notif.lu && s.cardUnread]}
      onPress={onRead}
      activeOpacity={0.8}
    >
      {/* Unread indicator */}
      {!notif.lu && <View style={s.unreadBar} />}

      <View style={[s.iconBox, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>

      <View style={s.textBlock}>
        <View style={s.titleRow}>
          <Text style={[s.notifTitle, !notif.lu && { color: COLORS.text }]} numberOfLines={1}>
            {notif.titre}
          </Text>
          <Text style={s.timeText}>{timeAgo(notif.created_at)}</Text>
        </View>
        <Text style={s.notifMsg} numberOfLines={2}>{notif.message}</Text>
      </View>

      <TouchableOpacity
        style={s.deleteBtn}
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={15} color={COLORS.text3} />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const insets = useSafeAreaInsets()
  const [notifs, setNotifs] = useState<Notif[]>([])

  useEffect(() => {
    fetchNotifs()
    if (!session?.user?.id) return
    const ch = supabase.channel('notifs-screen')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, payload => setNotifs(prev => [payload.new as Notif, ...prev]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user?.id])

  async function fetchNotifs() {
    if (!session) return
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setNotifs(data)
  }

  async function marquerLu(id: string) {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  async function marquerTousLus() {
    if (!session) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', session.user.id)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  async function supprimer(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  const nonLues = notifs.filter(n => !n.lu).length

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>Notifications</Text>
          {nonLues > 0 && <Text style={s.pageSub}>{nonLues} non lue{nonLues > 1 ? 's' : ''}</Text>}
        </View>
        {nonLues > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={marquerTousLus} activeOpacity={0.8}>
            <Ionicons name="checkmark-done-outline" size={16} color={COLORS.blueLight} />
            <Text style={s.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {notifs.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={30} color={COLORS.text3} />
            </View>
            <Text style={s.emptyTitle}>Aucune notification</Text>
            <Text style={s.emptySub}>Vous serez notifié ici pour vos réservations</Text>
          </View>
        ) : (
          <View style={s.list}>
            {notifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onRead={() => marquerLu(n.id)}
                onDelete={() => supprimer(n.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.navyLight },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  backBtn:      { width: 40, height: 40, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border2, justifyContent: 'center', alignItems: 'center' },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  pageSub:      { fontSize: 12, color: COLORS.text3, marginTop: 1 },
  markAllBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.blueMuted, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },
  markAllText:  { fontSize: 12, color: COLORS.blueLight, fontWeight: '600' },

  list:         { paddingHorizontal: 20, gap: 8 },

  card:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border2, position: 'relative', overflow: 'hidden' },
  cardUnread:   { backgroundColor: COLORS.card2, borderColor: COLORS.border3 },
  unreadBar:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: COLORS.blue, borderRadius: 2 },
  iconBox:      { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  textBlock:    { flex: 1 },
  titleRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 },
  notifTitle:   { fontSize: 13, fontWeight: '600', color: COLORS.text2, flex: 1 },
  timeText:     { fontSize: 10, color: COLORS.text3, flexShrink: 0 },
  notifMsg:     { fontSize: 12, color: COLORS.text3, lineHeight: 17 },
  deleteBtn:    { padding: 4, flexShrink: 0 },

  emptyBox:     { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconWrap:{ width: 72, height: 72, backgroundColor: COLORS.card, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border2, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: COLORS.text2, textAlign: 'center', lineHeight: 20 },
})
