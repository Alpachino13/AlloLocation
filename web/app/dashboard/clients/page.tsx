'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

type ClientStats = {
  id: string
  nom: string
  telephone: string
  nbReservations: number
  totalDepense: number
  derniereReservation: string
  statuts: string[]
}

export default function ClientsPage() {
  const { session } = useAuth()
  const [clients, setClients] = useState<ClientStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchClients = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)

    const { data } = await supabase
      .from('reservations')
      .select('*, voitures!inner(agence_id), profils(id,nom,telephone)')
      .eq('voitures.agence_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Grouper par client
    const map = new Map<string, ClientStats>()
    data.forEach((r: any) => {
      const profil = r.profils
      const key = profil?.id ?? `manuel-${r.client_nom_manuel ?? 'inconnu'}`
      const nom = profil?.nom ?? r.client_nom_manuel ?? 'Client inconnu'
      const tel = profil?.telephone ?? r.client_telephone_manuel ?? '—'

      if (!map.has(key)) {
        map.set(key, { id: key, nom, telephone: tel, nbReservations: 0, totalDepense: 0, derniereReservation: r.created_at, statuts: [] })
      }
      const c = map.get(key)!
      c.nbReservations++
      c.totalDepense += r.montant ?? 0
      if (!c.statuts.includes(r.statut)) c.statuts.push(r.statut)
    })

    setClients(Array.from(map.values()).sort((a, b) => b.totalDepense - a.totalDepense))
    setLoading(false)
  }, [session?.user])

  useEffect(() => { fetchClients() }, [fetchClients])

  const filtres = clients.filter(c =>
    !search ||
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.telephone.includes(search)
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between"
        style={{ background: '#0A1628', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <h1 className="text-xl font-bold">Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{clients.length} client{clients.length > 1 ? 's' : ''} au total</p>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Clients uniques', value: clients.length, icon: '👥', color: '#3B7FF5' },
            { label: 'Total dépensé', value: `${clients.reduce((s, c) => s + c.totalDepense, 0).toLocaleString('fr-DZ')} DA`, icon: '💰', color: '#F59E0B' },
            { label: 'Moy. par client', value: clients.length ? `${Math.round(clients.reduce((s, c) => s + c.totalDepense, 0) / clients.length).toLocaleString('fr-DZ')} DA` : '—', icon: '📊', color: '#34D399' },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl p-5 border"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="text-2xl mb-2">{k.icon}</div>
              <div className="text-xl font-bold mb-0.5" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative mb-5 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, téléphone..."
            className="w-full h-10 pl-9 pr-4 rounded-xl text-sm outline-none border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }} />
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: '#94A3B8' }}>Chargement...</div>
        ) : filtres.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-5xl mb-4">👥</div>
            <p className="font-semibold">Aucun client</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Les clients apparaîtront dès qu'une réservation est enregistrée.</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider"
              style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#475569' }}>
              <span>Client</span>
              <span>Contact</span>
              <span>Réservations</span>
              <span>Total dépensé</span>
            </div>
            {filtres.map((c, i) => (
              <div key={c.id}
                className={`stagger-item grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 items-center px-5 py-4 ${i > 0 ? 'border-t' : ''} hover:bg-white/[0.02] transition-colors duration-150`}
                style={{ borderColor: 'rgba(255,255,255,0.06)', animationDelay: `${i * 30}ms` }}>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff' }}>
                    {c.nom[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{c.nom}</p>
                    <p className="text-xs" style={{ color: '#475569' }}>
                      {new Date(c.derniereReservation).toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <p className="text-sm" style={{ color: '#94A3B8' }}>{c.telephone}</p>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.nbReservations}</span>
                  <span className="text-xs" style={{ color: '#475569' }}>réserv.</span>
                </div>

                <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
                  {c.totalDepense.toLocaleString('fr-DZ')} DA
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
