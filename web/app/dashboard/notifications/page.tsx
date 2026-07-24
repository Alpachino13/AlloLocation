'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Notification } from '@/lib/types'

const TYPE_COLORS: Record<string, { icon: string; color: string; bg: string }> = {
  reservation:  { icon: '📅', color: '#3B7FF5', bg: 'rgba(59,127,245,0.1)' },
  confirmation: { icon: '✅', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  annulation:   { icon: '❌', color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)' },
  info:         { icon: 'ℹ️', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'À l\'instant'
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  return `Il y a ${d}j`
}

export default function NotificationsPage() {
  const { session } = useAuth()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifs = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs(data ?? [])
    setLoading(false)
  }, [session?.user])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  useEffect(() => {
    if (!session?.user) return
    const ch = supabase.channel('notifs-web')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${session.user.id}`
      }, () => fetchNotifs())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user, fetchNotifs])

  async function marquerLu(id: string) {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  async function marquerToutLu() {
    if (!session?.user) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', session.user.id).eq('lu', false)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const nonLues = notifs.filter(n => !n.lu).length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between"
        style={{ background: '#0A1628', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Notifications</h1>
          {nonLues > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{ background: '#2563EB', color: '#fff' }}>
              {nonLues}
            </span>
          )}
        </div>
        {nonLues > 0 && (
          <button onClick={marquerToutLu}
            className="text-sm font-medium transition-colors duration-150"
            style={{ color: '#3B7FF5' }}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="text-center py-20" style={{ color: '#94A3B8' }}>Chargement...</div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-5xl mb-4">🔔</div>
            <p className="font-semibold">Aucune notification</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Les nouvelles réservations apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n, i) => {
              const cfg = TYPE_COLORS[n.type ?? 'info'] ?? TYPE_COLORS.info
              return (
                <div key={n.id}
                  className="stagger-item flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-150 hover:border-white/20"
                  style={{
                    background: n.lu ? '#1E2D45' : '#243352',
                    borderColor: n.lu ? 'rgba(255,255,255,0.06)' : 'rgba(37,99,235,0.2)',
                    animationDelay: `${i * 25}ms`,
                  }}
                  onClick={() => !n.lu && marquerLu(n.id)}>

                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: cfg.bg }}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-semibold">{n.titre}</p>
                      <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{n.message}</p>
                  </div>

                  {!n.lu && (
                    <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                      style={{ background: '#2563EB' }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
