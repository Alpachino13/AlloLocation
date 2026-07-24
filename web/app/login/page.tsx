'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    // Vérifier que c'est bien un compte agence
    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profil?.role !== 'agence') {
      await supabase.auth.signOut()
      setError('Cet espace est réservé aux comptes agence.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D1E35 50%, #0A1628 100%)' }}>

      {/* Cercles décoratifs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #2563EB, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
              🚗
            </div>
            <span className="text-2xl font-bold tracking-tight">AlloLocation</span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">Espace Agence</h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Connectez-vous pour gérer votre flotte
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border"
          style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
              style={{
                background: 'rgba(239,68,68,0.1)',
                borderColor: 'rgba(239,68,68,0.25)',
                color: '#FCA5A5'
              }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: '#94A3B8' }}>
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agence@example.com"
                required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none border transition-colors duration-150"
                style={{
                  background: '#0A1628',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#F8FAFC',
                }}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: '#94A3B8' }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-11 px-4 rounded-xl text-sm outline-none border transition-colors duration-150"
                style={{
                  background: '#0A1628',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#F8FAFC',
                }}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-sm mt-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
              style={{
                background: loading ? '#1D4ED8' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: '#fff',
                boxShadow: '0 4px 24px rgba(37,99,235,0.3)',
              }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div className="flex flex-col items-center gap-2 mt-6">
          <p className="text-xs" style={{ color: '#475569' }}>
            Cet espace est réservé aux agences partenaires AlloLocation
          </p>
          <a href="/inscription"
            className="text-xs font-medium transition-colors duration-150"
            style={{ color: '#3B7FF5' }}>
            Pas encore partenaire ? Créer mon espace agence →
          </a>
        </div>
      </div>
    </div>
  )
}
