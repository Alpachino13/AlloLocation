'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Reservation } from '@/lib/types'

const STATUTS = ['tous', 'en_attente', 'confirmee', 'annulee', 'terminee']
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  en_attente: { label: 'En attente', color: '#FCD34D', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  confirmee:  { label: 'Confirmée',  color: '#34D399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(52,211,153,0.3)' },
  annulee:    { label: 'Annulée',    color: '#FCA5A5', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)' },
  terminee:   { label: 'Terminée',   color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' },
}

function diffDays(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

export default function ReservationsPage() {
  const { session } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [search, setSearch] = useState('')

  const fetchReservations = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select('*, voitures!inner(id,nom,image_url,agence_id,prix), profils(nom,telephone)')
      .eq('voitures.agence_id', session.user.id)
      .order('created_at', { ascending: false })
    setReservations((data as any) ?? [])
    setLoading(false)
  }, [session?.user])

  useEffect(() => { fetchReservations() }, [fetchReservations])

  useEffect(() => {
    if (!session?.user) return
    const ch = supabase.channel('reservations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchReservations)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user, fetchReservations])

  async function changerStatut(id: string, statut: string, voitureId?: string | null) {
    await supabase.from('reservations').update({ statut }).eq('id', id)
    if (voitureId) {
      await supabase.from('voitures').update({
        statut: statut === 'confirmee' ? 'loue' : 'disponible'
      }).eq('id', voitureId)
    }
    fetchReservations()
  }

  const filtrees = reservations
    .filter(r => filterStatut === 'tous' || r.statut === filterStatut)
    .filter(r => {
      if (!search) return true
      const v = (r as any).voitures
      const c = (r as any).profils
      const q = search.toLowerCase()
      return (v?.nom ?? '').toLowerCase().includes(q)
        || (c?.nom ?? '').toLowerCase().includes(q)
        || (r.client_nom_manuel ?? '').toLowerCase().includes(q)
    })

  const counts = STATUTS.reduce((acc, s) => ({
    ...acc,
    [s]: s === 'tous' ? reservations.length : reservations.filter(r => r.statut === s).length
  }), {} as Record<string, number>)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between"
        style={{ background: '#0A1628', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <h1 className="text-xl font-bold">Réservations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{reservations.length} au total</p>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Filtres statut */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {STATUTS.map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
              style={{
                background: filterStatut === s ? '#2563EB' : '#1E2D45',
                color: filterStatut === s ? '#fff' : '#94A3B8',
                border: `1px solid ${filterStatut === s ? '#2563EB' : 'rgba(255,255,255,0.08)'}`,
              }}>
              {s === 'tous' ? 'Toutes' : STATUT_CONFIG[s]?.label}
              <span className="px-1.5 py-0.5 rounded-md text-[10px]"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                {counts[s] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative mb-6 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Voiture, client..."
            className="w-full h-10 pl-9 pr-4 rounded-xl text-sm outline-none border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }} />
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: '#94A3B8' }}>Chargement...</div>
        ) : filtrees.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-5xl mb-4">📅</div>
            <p className="font-semibold">Aucune réservation</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Aucun résultat pour ces filtres.</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider"
              style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#475569' }}>
              <span>Véhicule</span>
              <span>Client</span>
              <span>Période</span>
              <span>Montant</span>
              <span>Statut</span>
              <span>Actions</span>
            </div>

            {filtrees.map((res, i) => {
              const voiture = (res as any).voitures
              const client = (res as any).profils
              const cfg = STATUT_CONFIG[res.statut] ?? STATUT_CONFIG.annulee
              const duree = diffDays(res.date_debut, res.date_fin)
              const nom = client?.nom ?? res.client_nom_manuel ?? '—'
              const tel = client?.telephone ?? res.client_telephone_manuel ?? '—'

              return (
                <div key={res.id}
                  className={`stagger-item grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 ${i > 0 ? 'border-t' : ''} transition-colors duration-150 hover:bg-white/[0.02]`}
                  style={{ borderColor: 'rgba(255,255,255,0.06)', animationDelay: `${i * 30}ms` }}>

                  {/* Véhicule */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#243352' }}>
                      {voiture?.image_url
                        ? <img src={voiture.image_url} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-lg">🚗</div>
                      }
                    </div>
                    <span className="text-sm font-semibold truncate">{voiture?.nom ?? '—'}</span>
                  </div>

                  {/* Client */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{nom}</p>
                    <p className="text-xs truncate" style={{ color: '#475569' }}>{tel}</p>
                  </div>

                  {/* Période */}
                  <div>
                    <p className="text-sm">{res.date_debut} → {res.date_fin}</p>
                    <p className="text-xs" style={{ color: '#475569' }}>{duree} jour{duree > 1 ? 's' : ''}</p>
                  </div>

                  {/* Montant */}
                  <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
                    {(res.montant ?? 0).toLocaleString('fr-DZ')} DA
                  </span>

                  {/* Statut badge */}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold w-fit"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    {res.statut === 'en_attente' && (
                      <>
                        <button onClick={() => changerStatut(res.id, 'confirmee', res.voiture_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 hover:scale-[1.02]"
                          style={{ background: '#2563EB', color: '#fff' }}>
                          ✓
                        </button>
                        <button onClick={() => changerStatut(res.id, 'annulee', res.voiture_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
                          ✕
                        </button>
                      </>
                    )}
                    {res.statut === 'confirmee' && (
                      <button onClick={() => changerStatut(res.id, 'terminee', res.voiture_id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                        style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
                        ✓ Terminée
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
