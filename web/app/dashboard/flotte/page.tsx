'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { Voiture } from '@/lib/types'

const CATEGORIES  = ['Économique', 'SUV / 4x4', 'Luxe', 'Camion']
const CARBURANTS  = ['Essence', 'Diesel', 'Électrique', 'Hybride']
const BOITES      = ['Manuelle', 'Automatique']
const WILAYAS     = ['Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar','Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger','Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma','Constantine','Médéa','Mostaganem',"M'Sila",'Mascara','Ouargla','Oran','El Bayadh','Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued','Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane']

type FormData = {
  nom: string; prix: string; categorie: string; carburant: string
  boite: string; wilaya: string; places: string; km_jour: string
  annee: string; climatisation: boolean; description: string; image_url: string
}

const EMPTY: FormData = {
  nom: '', prix: '', categorie: 'Économique', carburant: 'Essence',
  boite: 'Manuelle', wilaya: 'Alger', places: '5', km_jour: '300',
  annee: '', climatisation: false, description: '', image_url: '',
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export default function FlottePage() {
  const { session, profil } = useAuth()
  const [voitures, setVoitures] = useState<Voiture[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchVoitures = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    const { data } = await supabase
      .from('voitures')
      .select('*')
      .eq('agence_id', session.user.id)
      .order('created_at', { ascending: false })
    setVoitures(data ?? [])
    setLoading(false)
  }, [session?.user])

  useEffect(() => { fetchVoitures() }, [fetchVoitures])

  // Realtime
  useEffect(() => {
    if (!session?.user) return
    const ch = supabase.channel('flotte-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voitures' }, fetchVoitures)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user, fetchVoitures])

  function openAdd() { setEditingId(null); setForm(EMPTY); setFormError(''); setModalOpen(true) }
  function openEdit(v: Voiture) {
    setEditingId(v.id)
    setForm({
      nom: v.nom, prix: String(v.prix), categorie: v.categorie ?? 'Économique',
      carburant: v.carburant ?? 'Essence', boite: v.boite ?? 'Manuelle',
      wilaya: v.wilaya ?? 'Alger', places: String(v.places ?? 5),
      km_jour: String(v.km_jour ?? 300), annee: v.annee ? String(v.annee) : '',
      climatisation: v.climatisation ?? false, description: v.description ?? '',
      image_url: v.image_url ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) { setFormError('Le nom est obligatoire.'); return }
    if (!form.prix || isNaN(parseInt(form.prix))) { setFormError('Le prix est invalide.'); return }
    setSaving(true)
    setFormError('')

    const payload = {
      nom: form.nom.trim(),
      prix: parseInt(form.prix),
      categorie: form.categorie,
      carburant: form.carburant,
      boite: form.boite,
      wilaya: form.wilaya,
      places: parseInt(form.places) || 5,
      km_jour: parseInt(form.km_jour) || 300,
      annee: form.annee ? parseInt(form.annee) : null,
      climatisation: form.climatisation,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('voitures').update(payload).eq('id', editingId)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('voitures').insert({
        ...payload,
        agence: profil?.nom ?? '',
        agence_id: session!.user.id,
        statut: 'disponible',
        note: 5.0,
      })
      if (error) { setFormError(error.message); setSaving(false); return }
    }
    setSaving(false)
    setModalOpen(false)
    fetchVoitures()
  }

  async function handleDelete(id: string, nom: string) {
    if (!confirm(`Supprimer "${nom}" définitivement ?`)) return
    await supabase.from('voitures').delete().eq('id', id)
    fetchVoitures()
  }

  async function changerStatutVoiture(id: string, statut: string) {
    await supabase.from('voitures').update({ statut }).eq('id', id)
    fetchVoitures()
  }

  const filtrees = voitures
    .filter(v => filterStatut === 'tous' || v.statut === filterStatut)
    .filter(v => !search || v.nom.toLowerCase().includes(search.toLowerCase()) || (v.wilaya ?? '').toLowerCase().includes(search.toLowerCase()))

  const f = (k: keyof FormData, val: any) => setForm(p => ({ ...p, [k]: val }))

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 py-5 border-b flex items-center justify-between"
        style={{ background: '#0A1628', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <h1 className="text-xl font-bold">Ma flotte</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{voitures.length} véhicule{voitures.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: '#2563EB', color: '#fff' }}>
          + Ajouter un véhicule
        </button>
      </div>

      <div className="px-8 py-6">
        {/* Filtres */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, wilaya..."
              className="w-full h-10 pl-9 pr-4 rounded-xl text-sm outline-none border"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)', color: '#F8FAFC' }} />
          </div>
          {['tous', 'disponible', 'loue', 'maintenance'].map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              style={{
                background: filterStatut === s ? '#2563EB' : '#1E2D45',
                color: filterStatut === s ? '#fff' : '#94A3B8',
                border: `1px solid ${filterStatut === s ? '#2563EB' : 'rgba(255,255,255,0.08)'}`,
              }}>
              {{ tous: 'Tous', disponible: '🟢 Disponible', loue: '🔵 Loué', maintenance: '🟡 Maintenance' }[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: '#94A3B8' }}>Chargement...</div>
        ) : filtrees.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border"
            style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="text-5xl mb-4">🚗</div>
            <p className="font-semibold mb-1">Aucun véhicule</p>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {search ? 'Aucun résultat pour cette recherche.' : 'Commencez par ajouter votre première voiture.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtrees.map((v, i) => (
              <div key={v.id}
                className="stagger-item rounded-2xl border overflow-hidden group transition-all duration-200 hover:border-blue-500/30"
                style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)', animationDelay: `${i * 40}ms` }}>
                {/* Image */}
                <div className="relative h-44 overflow-hidden" style={{ background: '#243352' }}>
                  {v.image_url
                    ? <img src={v.image_url} alt={v.nom} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                    : <div className="w-full h-full flex items-center justify-center text-5xl opacity-40">🚗</div>
                  }
                  {/* Badge statut */}
                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: v.statut === 'disponible' ? 'rgba(16,185,129,0.2)' : v.statut === 'loue' ? 'rgba(37,99,235,0.2)' : 'rgba(245,158,11,0.2)',
                        color: v.statut === 'disponible' ? '#34D399' : v.statut === 'loue' ? '#3B7FF5' : '#FCD34D',
                        border: `1px solid ${v.statut === 'disponible' ? 'rgba(52,211,153,0.3)' : v.statut === 'loue' ? 'rgba(59,127,245,0.3)' : 'rgba(252,211,77,0.3)'}`,
                      }}>
                      {v.statut === 'disponible' ? '● Disponible' : v.statut === 'loue' ? '● Loué' : '● Maintenance'}
                    </span>
                  </div>
                  {/* Actions overlay */}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button onClick={() => openEdit(v)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors duration-150"
                      style={{ background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
                      title="Modifier">✏️</button>
                    <button onClick={() => handleDelete(v.id, v.nom)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors duration-150"
                      style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}
                      title="Supprimer">🗑️</button>
                  </div>
                </div>

                {/* Infos */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{v.nom}</h3>
                      {v.annee && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Année {v.annee}</p>}
                    </div>
                    <span className="text-lg font-bold" style={{ color: '#F59E0B' }}>
                      {v.prix.toLocaleString('fr-DZ')} <span className="text-xs font-normal" style={{ color: '#475569' }}>DA/j</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {[v.carburant, v.boite, `${v.places ?? 5} places`, v.wilaya, v.categorie]
                      .filter(Boolean)
                      .map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-md"
                          style={{ background: '#243352', color: '#94A3B8' }}>
                          {tag}
                        </span>
                      ))}
                  </div>

                  {/* Changer statut */}
                  <div className="flex gap-1.5">
                    {['disponible', 'loue', 'maintenance'].map(s => (
                      <button key={s} onClick={() => changerStatutVoiture(v.id, s)}
                        disabled={v.statut === s}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                        style={{
                          background: v.statut === s ? (s === 'disponible' ? 'rgba(16,185,129,0.2)' : s === 'loue' ? 'rgba(37,99,235,0.2)' : 'rgba(245,158,11,0.2)') : 'rgba(255,255,255,0.04)',
                          color: v.statut === s ? (s === 'disponible' ? '#34D399' : s === 'loue' ? '#3B7FF5' : '#FCD34D') : '#475569',
                          border: '1px solid rgba(255,255,255,0.06)',
                          cursor: v.statut === s ? 'default' : 'pointer',
                        }}>
                        {{ disponible: 'Dispo', loue: 'Loué', maintenance: 'Maint.' }[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Ajout/Édition */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="px-6 pt-6 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="text-lg font-bold">{editingId ? 'Modifier le véhicule' : 'Ajouter un véhicule'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="px-4 py-3 rounded-xl text-sm border"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }}>
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nom du véhicule *</Label>
              <Input value={form.nom} onChange={e => f('nom', e.target.value)} placeholder="ex: Dacia Logan 2022" required />
            </div>
            <div>
              <Label>Prix / jour (DA) *</Label>
              <Input type="number" value={form.prix} onChange={e => f('prix', e.target.value)} placeholder="ex: 3500" required />
            </div>
            <div>
              <Label>Année</Label>
              <Input type="number" value={form.annee} onChange={e => f('annee', e.target.value)} placeholder="ex: 2022" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Places</Label>
              <Input type="number" value={form.places} onChange={e => f('places', e.target.value)} placeholder="5" />
            </div>
            <div>
              <Label>Km / jour</Label>
              <Input type="number" value={form.km_jour} onChange={e => f('km_jour', e.target.value)} placeholder="300" />
            </div>
          </div>

          <Chips label="Catégorie" options={CATEGORIES} value={form.categorie} onChange={v => f('categorie', v)} />
          <Chips label="Carburant" options={CARBURANTS} value={form.carburant} onChange={v => f('carburant', v)} />
          <Chips label="Boîte" options={BOITES} value={form.boite} onChange={v => f('boite', v)} />

          <div>
            <Label>Wilaya</Label>
            <select value={form.wilaya} onChange={e => f('wilaya', e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm outline-none border"
              style={{ background: '#243352', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
              {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div>
            <Label>URL Image (optionnel)</Label>
            <Input value={form.image_url} onChange={e => f('image_url', e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <Label>Description (optionnel)</Label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)}
              placeholder="Décrivez brièvement le véhicule..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
              style={{ background: '#243352', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC' }} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative w-10 h-5">
              <input type="checkbox" className="sr-only" checked={form.climatisation}
                onChange={e => f('climatisation', e.target.checked)} />
              <div className="w-10 h-5 rounded-full transition-colors duration-200"
                style={{ background: form.climatisation ? '#2563EB' : '#243352' }} />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                style={{ transform: form.climatisation ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
            <span className="text-sm">Climatisation</span>
          </label>

          <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 h-10 rounded-xl text-sm font-semibold border transition-all duration-150"
              style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#94A3B8' }}>
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-[2] h-10 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
              style={{ background: '#F59E0B', color: '#0A1628' }}>
              {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#94A3B8' }}>{children}</label>
}

function Input({ className = '', style = {}, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full h-10 px-3 rounded-xl text-sm outline-none border transition-colors duration-150 ${className}`}
      style={{ background: '#243352', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC', ...style }}
      onFocus={e => e.target.style.borderColor = '#2563EB'}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
    />
  )
}

function Chips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
            style={{
              background: value === o ? '#2563EB' : '#243352',
              color: value === o ? '#fff' : '#94A3B8',
              border: `1px solid ${value === o ? '#2563EB' : 'rgba(255,255,255,0.08)'}`,
            }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
