'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'

const NAV = [
  { href: '/dashboard',               icon: '⬛', label: 'Vue d\'ensemble' },
  { href: '/dashboard/flotte',        icon: '🚗', label: 'Ma flotte'       },
  { href: '/dashboard/reservations',  icon: '📅', label: 'Réservations'    },
  { href: '/dashboard/clients',       icon: '👥', label: 'Clients'         },
  { href: '/dashboard/notifications', icon: '🔔', label: 'Notifications'   },
  { href: '/dashboard/parametres',    icon: '⚙️', label: 'Paramètres'      },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, profil, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && (!session || profil?.role !== 'agence')) {
      router.replace('/login')
    }
  }, [session, profil, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1628' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl animate-pulse"
            style={{ background: '#1E2D45' }}>🚗</div>
          <span className="text-sm" style={{ color: '#94A3B8' }}>Chargement...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0A1628' }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ background: '#0D1E35', borderColor: 'rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
              🚗
            </div>
            <div>
              <div className="text-sm font-bold leading-none">AlloLocation</div>
              <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Espace Agence</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: isActive ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: isActive ? '#F8FAFC' : '#94A3B8',
                  borderLeft: isActive ? '2px solid #2563EB' : '2px solid transparent',
                }}>
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Profil agence */}
        <div className="px-3 pb-4 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: '#1E2D45' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A1628' }}>
              {profil?.nom?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{profil?.nom ?? 'Mon agence'}</div>
              <div className="text-[10px] truncate" style={{ color: '#475569' }}>{profil?.wilaya ?? '—'}</div>
            </div>
            <button onClick={signOut} title="Déconnexion"
              className="text-xs transition-colors duration-150 hover:text-red-400"
              style={{ color: '#475569' }}>
              ↪
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
