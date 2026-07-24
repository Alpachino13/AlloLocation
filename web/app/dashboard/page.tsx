'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Voiture, Reservation } from '@/lib/types'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function formatAmount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString('fr-DZ')
}

function diffDays(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function statutLabel(s: string) {
  return { en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée', terminee: 'Terminée' }[s] ?? s
}

export default function DashboardPage() {
  const { session, profil } = useAuth()
  const [voitures, setVoitures] = useState<Voiture[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    const [{ data: voit }, { data: res }] = await Promise.all([
      supabase.from('voitures').select('*').eq('agence_id', session.user.id),
      supabase.from('reservations')
        .select('*, voitures!inner(id,nom,image_url,agence_id,prix), profils(nom,telephone)')
        .eq('voitures.agence_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setVoitures(voit ?? [])
    setReservations((res as any) ?? [])
    setLoading(false)
  }, [session?.user])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Realtime
  useEffect(() => {
    if (!session?.user) return
    const ch = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voitures' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user, fetchAll])

  async function changerStatut(id: string, statut: string, voitureId?: string | null) {
    await supabase.from('reservations').update({ statut }).eq('id', id)
    if (voitureId) {
      await supabase.from('voitures').update({
        statut: statut === 'confirmee' ? 'loue' : 'disponible'
      }).eq('id', voitureId)
    }
    fetchAll()
  }

  // KPIs
  const total = voitures.length
  const dispos = voitures.filter(v => v.statut === 'disponible').length
  const loues = total - dispos
  const taux = total > 0 ? Math.round((loues / total) * 100) : 0
  const mois = new Date().getMonth()
  const revenusMois = reservations
    .filter(r => r.statut === 'confirmee' && new Date(r.date_debut).getMonth() === mois)
    .reduce((s, r) => s + (r.montant ?? 0), 0)
  const enAttente = reservations.filter(r => r.statut === 'en_attente')

  // Chart barres hebdo
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0,0,0,0)
  const weekTotals = Array(7).fill(0)
  reservations.filter(r => r.statut === 'confirmee').forEach(r => {
    const d = new Date(r.date_debut); d.setHours(0,0,0,0)
    const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) weekTotals[diff] += r.montant ?? 0
  })
  const maxBar = Math.max(...weekTotals, 1)

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-sm" style={{ color: '#94A3B8' }}>Chargement...</div>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between"
        style={{ background: '#0A1628', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <h1 className="text-xl font-bold">Vue d'ensemble</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {profil?.nom ?? 'Mon agence'} · {new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {enAttente.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.3)' }}>
            ⏳ {enAttente.length} en attente
          </div>
        )}
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-4 stagger-item">
          {[
            { icon: '💰', label: 'Revenus ce mois', value: `${formatAmount(revenusMois)} DA`, color: '#F59E0B', sub: `≈ ${formatAmount(Math.round(revenusMois * 0.82))} DA net` },
            { icon: '📅', label: 'Réservations', value: String(reservations.length), color: '#3B7FF5', sub: `${enAttente.length} en attente` },
            { icon: '🚗', label: 'Flotte', value: `${dispos}/${total}`, color: '#94A3B8', sub: `${loues} loués` },
            { icon: '📊', label: 'Occupation', value: `${taux}%`, color: '#10B981', sub: 'de la flotte' },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl p-5 border transition-transform duration-150 hover:scale-[1.01]"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="text-2xl mb-3">{k.icon}</div>
              <div className="text-2xl font-bold mb-1" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs font-medium mb-0.5" style={{ color: '#F8FAFC' }}>{k.label}</div>
              <div className="text-xs" style={{ color: '#475569' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Chart barres */}
          <div className="col-span-2 rounded-2xl p-6 border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Revenus hebdomadaires</h2>
              <div className="flex items-center gap-4 text-xs" style={{ color: '#475569' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#F59E0B' }} />Aujourd'hui
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#3B7FF5' }} />Autres jours
                </span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-36">
              {weekTotals.map((val, i) => {
                const h = Math.max(4, Math.round((val / maxBar) * 128))
                const isToday = i === dow
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    {val > 0 && (
                      <span className="text-[10px]" style={{ color: '#475569' }}>{formatAmount(val)}</span>
                    )}
                    <div className="w-full flex items-end" style={{ height: 128 }}>
                      <div className="w-full rounded-t-md transition-all duration-300"
                        style={{
                          height: h,
                          background: isToday
                            ? 'linear-gradient(to top, #F59E0B, #FCD34D)'
                            : 'rgba(59,127,245,0.5)',
                          boxShadow: isToday ? '0 0 12px rgba(245,158,11,0.4)' : 'none',
                        }} />
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: isToday ? '#F59E0B' : '#475569' }}>
                      {DAY_LABELS[i]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Occupation gauge */}
          <div className="rounded-2xl p-6 border flex flex-col"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
            <h2 className="font-semibold mb-6">Occupation flotte</h2>
            <div className="flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-2 text-center mb-6">
                {[
                  { val: loues,  label: 'Loués',  color: '#3B7FF5' },
                  { val: dispos, label: 'Dispo',  color: '#34D399' },
                  { val: total,  label: 'Total',  color: '#F8FAFC' },
                ].map((g, i) => (
                  <div key={i}>
                    <div className="text-2xl font-bold" style={{ color: g.color }}>{g.val}</div>
                    <div className="text-xs mt-1" style={{ color: '#475569' }}>{g.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="h-3 rounded-full overflow-hidden mb-2"
                  style={{ background: '#243352' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${taux}%`,
                      background: 'linear-gradient(90deg, #2563EB, #3B7FF5)',
                    }} />
                </div>
                <div className="flex justify-between text-xs" style={{ color: '#475569' }}>
                  <span>{taux}% occupé</span>
                  <span>{100 - taux}% libre</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Réservations en attente */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Réservations en attente</h2>
            {enAttente.length === 0 && (
              <span className="text-xs" style={{ color: '#475569' }}>Aucune pour l'instant</span>
            )}
          </div>
          {enAttente.length === 0 ? (
            <div className="rounded-2xl p-10 text-center border"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="text-4xl mb-3">✅</div>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Toutes les demandes ont été traitées</p>
            </div>
          ) : (
            <div className="space-y-3">
              {enAttente.map((res, i) => {
                const voiture = (res as any).voitures
                const client = (res as any).profils
                const duree = diffDays(res.date_debut, res.date_fin)
                const nom = client?.nom ?? res.client_nom_manuel ?? '—'
                const tel = client?.telephone ?? res.client_telephone_manuel ?? '—'
                return (
                  <div key={res.id}
                    className="stagger-item rounded-2xl border overflow-hidden"
                    style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)', animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-4 p-5">
                      {/* Image */}
                      <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0"
                        style={{ background: '#243352' }}>
                        {voiture?.image_url
                          ? <img src={voiture.image_url} alt={voiture.nom} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-2xl">🚗</div>
                        }
                      </div>
                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">{voiture?.nom ?? '—'}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                              👤 {nom} · 📞 {tel}
                            </p>
                            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                              📅 {res.date_debut} → {res.date_fin} · {duree}j
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-lg" style={{ color: '#F59E0B' }}>
                              {(res.montant ?? 0).toLocaleString('fr-DZ')} DA
                            </p>
                            <p className="text-xs" style={{ color: '#475569' }}>{duree}j × {voiture?.prix?.toLocaleString() ?? '—'} DA</p>
                          </div>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => changerStatut(res.id, 'annulee', res.voiture_id)}
                          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#FCA5A5',
                          }}>
                          ✕ Refuser
                        </button>
                        <button
                          onClick={() => changerStatut(res.id, 'confirmee', res.voiture_id)}
                          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: '#2563EB',
                            color: '#fff',
                          }}>
                          ✓ Confirmer
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Récentes confirmées */}
        {reservations.filter(r => r.statut === 'confirmee').length > 0 && (
          <div>
            <h2 className="font-semibold mb-4">Récemment confirmées</h2>
            <div className="rounded-2xl border overflow-hidden"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              {reservations.filter(r => r.statut === 'confirmee').slice(0, 5).map((res, i) => {
                const voiture = (res as any).voitures
                const client = (res as any).profils
                return (
                  <div key={res.id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t' : ''}`}
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
                      style={{ background: '#243352' }}>
                      {voiture?.image_url
                        ? <img src={voiture.image_url} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">🚗</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{voiture?.nom ?? '—'}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#475569' }}>
                        {client?.nom ?? res.client_nom_manuel ?? '—'} · {res.date_debut} → {res.date_fin}
                      </p>
                    </div>
                    <div className="px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}>
                      ✓ Confirmée
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#F59E0B' }}>
                      {(res.montant ?? 0).toLocaleString('fr-DZ')} DA
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
