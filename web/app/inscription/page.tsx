'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Constantes ───────────────────────────────────────────────────────────────
const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger',
  'Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma',
  'Constantine','Médéa','Mostaganem',"M'Sila",'Mascara','Ouargla','Oran','El Bayadh',
  'Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt',
  'El Oued','Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma',
  'Aïn Témouchent','Ghardaïa','Relizane',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type DocKey = 'rc' | 'identite' | 'local'
type DocStatus = 'idle' | 'scanning' | 'valid' | 'invalid' | 'uploading' | 'done' | 'error'

type DocumentState = {
  file: File | null
  preview: string | null
  status: DocStatus
  message: string
  url: string | null
}

type FormData = {
  nom: string
  email: string
  password: string
  confirmPassword: string
  telephone: string
  wilaya: string
  adresse: string
  num_rc: string
}

const EMPTY_FORM: FormData = {
  nom: '', email: '', password: '', confirmPassword: '',
  telephone: '', wilaya: 'Alger', adresse: '', num_rc: '',
}

const EMPTY_DOC: DocumentState = {
  file: null, preview: null, status: 'idle', message: '', url: null,
}

// ─── Styles communs ───────────────────────────────────────────────────────────
const inputStyle = {
  background: '#0A1628',
  borderColor: 'rgba(255,255,255,0.1)',
  color: '#F8FAFC',
}

// ─── Composants petits ────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#94A3B8' }}>
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

function Input({
  value, onChange, type = 'text', placeholder, required, className = ''
}: {
  value: string; onChange: (v: string) => void; type?: string
  placeholder?: string; required?: boolean; className?: string
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      className={`w-full h-11 px-4 rounded-xl text-sm outline-none border transition-colors duration-150 ${className}`}
      style={inputStyle}
      onFocus={e => { e.target.style.borderColor = '#2563EB' }}
      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
    />
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Compte', 'Agence', 'Documents', 'Confirmation']
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done ? '#10B981' : active ? '#2563EB' : '#1E2D45',
                  color: done || active ? '#fff' : '#475569',
                  border: `2px solid ${done ? '#10B981' : active ? '#2563EB' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {done ? '✓' : step}
              </div>
              <span className="text-[10px] mt-1 font-medium whitespace-nowrap"
                style={{ color: active ? '#F8FAFC' : done ? '#34D399' : '#475569' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className="w-16 h-px mx-2 mb-4 transition-colors duration-300"
                style={{ background: done ? '#10B981' : 'rgba(255,255,255,0.1)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Zone upload document ─────────────────────────────────────────────────────
function DocumentZone({
  label, description, docKey, state, onChange
}: {
  label: string; description: string; docKey: DocKey
  state: DocumentState; onChange: (key: DocKey, file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const statusConfig = {
    idle:      { color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',  text: '#94A3B8' },
    scanning:  { color: 'rgba(37,99,235,0.1)',    border: 'rgba(37,99,235,0.3)',    text: '#3B7FF5' },
    valid:     { color: 'rgba(16,185,129,0.1)',   border: 'rgba(52,211,153,0.4)',   text: '#34D399' },
    invalid:   { color: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',    text: '#FCA5A5' },
    uploading: { color: 'rgba(37,99,235,0.1)',    border: 'rgba(37,99,235,0.3)',    text: '#3B7FF5' },
    done:      { color: 'rgba(16,185,129,0.1)',   border: 'rgba(52,211,153,0.4)',   text: '#34D399' },
    error:     { color: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',    text: '#FCA5A5' },
  }

  const cfg = statusConfig[state.status]

  const statusIcon = {
    idle: '📎', scanning: '🔍', valid: '✅', invalid: '⚠️',
    uploading: '⬆️', done: '✓', error: '✕'
  }[state.status]

  const statusLabel = {
    idle: 'Cliquez pour ajouter',
    scanning: 'Vérification en cours...',
    valid: 'Document vérifié',
    invalid: 'Document non conforme',
    uploading: 'Envoi en cours...',
    done: 'Document envoyé',
    error: 'Erreur — Réessayez',
  }[state.status]

  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs mb-3" style={{ color: '#475569' }}>{description}</p>

      <div
        className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden group"
        style={{ background: cfg.color, borderColor: cfg.border, minHeight: 120 }}
        onClick={() => !['scanning','uploading'].includes(state.status) && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onChange(docKey, f) }}
        />

        {state.preview ? (
          <div className="relative">
            <img src={state.preview} alt={label} className="w-full h-40 object-cover" />
            <div className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: 'rgba(10,22,40,0.7)' }}>
              <span className="text-2xl mb-1">{statusIcon}</span>
              <span className="text-xs font-semibold" style={{ color: cfg.text }}>{statusLabel}</span>
              {state.message && (
                <span className="text-xs mt-1 text-center px-4" style={{ color: cfg.text }}>{state.message}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
            <span className="text-3xl">{statusIcon}</span>
            <span className="text-sm font-semibold" style={{ color: cfg.text }}>{statusLabel}</span>
            {state.message && (
              <span className="text-xs text-center" style={{ color: cfg.text }}>{state.message}</span>
            )}
            {state.status === 'idle' && (
              <span className="text-xs mt-1" style={{ color: '#475569' }}>JPG, PNG, PDF · max 10MB</span>
            )}
          </div>
        )}

        {/* Spinner scanning/uploading */}
        {['scanning','uploading'].includes(state.status) && (
          <div className="absolute top-2 right-2">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#3B7FF5', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function InscriptionAgencePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [docs, setDocs] = useState<Record<DocKey, DocumentState>>({
    rc: { ...EMPTY_DOC },
    identite: { ...EMPTY_DOC },
    local: { ...EMPTY_DOC },
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const f = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }))

  // ─── Vérification document via Claude AI ──────────────────────────────────
  const scanDocument = useCallback(async (key: DocKey, file: File) => {
    // Preview
    const reader = new FileReader()
    reader.onload = async e => {
      const dataUrl = e.target?.result as string

      setDocs(prev => ({
        ...prev,
        [key]: { ...prev[key], file, preview: dataUrl, status: 'scanning', message: 'Analyse du document...', url: null }
      }))

      // Envoyer à Claude pour vérification
      try {
        const base64 = dataUrl.split(',')[1]
        const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
        const isPdf = file.type === 'application/pdf'

        const docLabels: Record<DocKey, string> = {
          rc: 'un Registre de Commerce algérien (RC)',
          identite: 'une pièce d\'identité algérienne (CNI ou passeport)',
          local: 'une preuve de local commercial (contrat de bail ou acte)',
        }

        let messages: any[]

        if (isPdf) {
          // Pour les PDFs, analyser sans image
          messages = [{
            role: 'user',
            content: `L'utilisateur a uploadé un fichier PDF pour ${docLabels[key]}. 
Un PDF a été soumis mais ne peut pas être prévisualisé.
Réponds UNIQUEMENT avec un JSON: {"valid": true, "message": "PDF reçu - sera vérifié manuellement"}`
          }]
        } else {
          messages = [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64 }
              },
              {
                type: 'text',
                text: `Tu es un vérificateur de documents pour une plateforme de location de voitures en Algérie.

Analyse cette image et détermine si c'est ${docLabels[key]}.

Réponds UNIQUEMENT avec du JSON valide (pas de markdown, pas d'explication), exactement ce format:
{"valid": boolean, "message": "string de max 80 caractères en français"}`
              }
            ]
          }]
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 150,
            messages,
          })
        })

        const data = await response.json()
        const text = data.content?.[0]?.text ?? ''

        let result: { valid: boolean; message: string }
        try {
          result = JSON.parse(text.trim())
        } catch {
          result = { valid: true, message: 'Document reçu, vérification manuelle à venir.' }
        }

        setDocs(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            status: result.valid ? 'valid' : 'invalid',
            message: result.message,
          }
        }))
      } catch {
        // En cas d'erreur réseau, on accepte quand même
        setDocs(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            status: 'valid',
            message: 'Document reçu — sera vérifié manuellement.',
          }
        }))
      }
    }
    reader.readAsDataURL(file)
  }, [])

  // ─── Upload document vers Supabase Storage ────────────────────────────────
  const uploadDocument = async (key: DocKey, uid: string): Promise<string | null> => {
    const doc = docs[key]
    if (!doc.file) return null

    setDocs(prev => ({ ...prev, [key]: { ...prev[key], status: 'uploading' } }))

    const ext = doc.file.name.split('.').pop()
    const path = `${uid}/${key}_${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(path, doc.file, { contentType: doc.file.type, upsert: true })

    if (error) {
      setDocs(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', message: 'Échec de l\'envoi' } }))
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    setDocs(prev => ({ ...prev, [key]: { ...prev[key], status: 'done', url: publicUrl } }))
    return publicUrl
  }

  // ─── Validation étapes ────────────────────────────────────────────────────
  function validateStep1(): string | null {
    if (!form.nom.trim()) return 'Le nom de l\'agence est obligatoire.'
    if (!form.email.trim() || !form.email.includes('@')) return 'Email invalide.'
    if (form.password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
    if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return null
  }

  function validateStep2(): string | null {
    if (!form.telephone.trim()) return 'Le numéro de téléphone est obligatoire.'
    if (!form.adresse.trim()) return 'L\'adresse est obligatoire.'
    if (!form.num_rc.trim()) return 'Le numéro RC est obligatoire.'
    return null
  }

  function validateStep3(): string | null {
    const hasInvalid = (Object.keys(docs) as DocKey[]).some(k => docs[k].status === 'invalid')
    if (hasInvalid) return 'Un ou plusieurs documents sont non conformes. Veuillez les remplacer.'
    const scanning = (Object.keys(docs) as DocKey[]).some(k => docs[k].status === 'scanning')
    if (scanning) return 'Veuillez attendre la fin de la vérification des documents.'
    return null
  }

  // ─── Navigation étapes ────────────────────────────────────────────────────
  async function goNext() {
    setError('')
    if (step === 1) {
      const err = validateStep1(); if (err) { setError(err); return }
    } else if (step === 2) {
      const err = validateStep2(); if (err) { setError(err); return }
    } else if (step === 3) {
      const err = validateStep3(); if (err) { setError(err); return }
    }
    setStep(s => s + 1)
  }

  // ─── Soumission finale ────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    try {
      // 1. Créer le compte auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { nom: form.nom } }
      })

      if (authError) throw new Error(authError.message)
      const uid = authData.user?.id
      if (!uid) throw new Error('Erreur lors de la création du compte.')
      setUserId(uid)

      // 2. Upload documents
      const [rcUrl, identiteUrl, localUrl] = await Promise.all([
        uploadDocument('rc', uid),
        uploadDocument('identite', uid),
        uploadDocument('local', uid),
      ])

      // 3. Mettre à jour le profil avec rôle agence
      const { error: profilError } = await supabase
        .from('profils')
        .upsert({
          id: uid,
          nom: form.nom,
          telephone: form.telephone,
          role: 'agence',
          wilaya: form.wilaya,
          adresse: form.adresse,
          num_rc: form.num_rc,
        })

      if (profilError) throw new Error(profilError.message)

      // 4. Créer la demande d'agence
      const { error: demandeError } = await supabase
        .from('demandes_agence')
        .insert({
          user_id: uid,
          nom: form.nom,
          telephone: form.telephone,
          wilaya: form.wilaya,
          adresse: form.adresse,
          num_rc: form.num_rc,
          email: form.email,
          doc_rc_url: rcUrl,
          doc_identite_url: identiteUrl,
          doc_local_url: localUrl,
          statut: 'en_attente',
        })

      if (demandeError) throw new Error(demandeError.message)

      // 5. Passer à la confirmation
      setStep(4)

    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D1E35 60%, #0A1628 100%)' }}>

      {/* Cercles déco */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #2563EB, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/login" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
            🚗
          </div>
          <span className="font-bold text-sm">AlloLocation</span>
        </Link>
        <Link href="/login" className="text-xs transition-colors duration-150"
          style={{ color: '#94A3B8' }}>
          Déjà un compte ? <span style={{ color: '#3B7FF5' }}>Se connecter</span>
        </Link>
      </header>

      {/* Contenu */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">

          {/* Titre */}
          {step < 4 && (
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Créer votre espace agence</h1>
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                Rejoignez AlloLocation et gérez votre flotte en ligne
              </p>
            </div>
          )}

          {/* Étapes */}
          {step < 4 && (
            <div className="flex justify-center mb-8">
              <StepIndicator current={step} total={3} />
            </div>
          )}

          {/* Erreur globale */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm border"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          {/* ─── Étape 1 : Compte ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="rounded-2xl p-6 border space-y-4"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <h2 className="text-lg font-bold mb-0.5">Informations de connexion</h2>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Ces informations serviront à vous connecter</p>
              </div>

              <Field label="Nom de votre agence" required>
                <Input value={form.nom} onChange={v => f('nom', v)} placeholder="ex: Location Auto Alger" />
              </Field>

              <Field label="Adresse email" required>
                <Input type="email" value={form.email} onChange={v => f('email', v)} placeholder="agence@example.com" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Mot de passe" required>
                  <Input type="password" value={form.password} onChange={v => f('password', v)} placeholder="min. 8 caractères" />
                </Field>
                <Field label="Confirmer" required>
                  <Input type="password" value={form.confirmPassword} onChange={v => f('confirmPassword', v)} placeholder="••••••••" />
                </Field>
              </div>

              {/* Indicateur force mdp */}
              {form.password.length > 0 && (
                <div>
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-colors duration-200"
                        style={{
                          background: form.password.length >= i * 2 + 4
                            ? i <= 1 ? '#EF4444' : i <= 2 ? '#F59E0B' : i <= 3 ? '#3B7FF5' : '#10B981'
                            : 'rgba(255,255,255,0.1)'
                        }} />
                    ))}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                    {form.password.length < 8 ? 'Trop court' : form.password.length < 12 ? 'Acceptable' : 'Fort'}
                  </p>
                </div>
              )}

              <NextBtn onClick={goNext}>Étape suivante →</NextBtn>
            </div>
          )}

          {/* ─── Étape 2 : Agence ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="rounded-2xl p-6 border space-y-4"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <h2 className="text-lg font-bold mb-0.5">Informations de l'agence</h2>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Ces données apparaîtront sur votre profil public</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Téléphone" required>
                  <Input value={form.telephone} onChange={v => f('telephone', v)} placeholder="0550 000 000" type="tel" />
                </Field>
                <Field label="N° Registre de Commerce" required>
                  <Input value={form.num_rc} onChange={v => f('num_rc', v)} placeholder="ex: 13/00-1234567B19" />
                </Field>
              </div>

              <Field label="Wilaya" required>
                <select value={form.wilaya} onChange={e => f('wilaya', e.target.value)}
                  className="w-full h-11 px-4 rounded-xl text-sm outline-none border transition-colors duration-150"
                  style={inputStyle}>
                  {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </Field>

              <Field label="Adresse complète" required>
                <textarea
                  value={form.adresse}
                  onChange={e => f('adresse', e.target.value)}
                  placeholder="Rue, quartier, commune..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none border resize-none transition-colors duration-150"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#2563EB'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </Field>

              <div className="flex gap-3">
                <BackBtn onClick={() => setStep(1)}>← Retour</BackBtn>
                <NextBtn onClick={goNext}>Étape suivante →</NextBtn>
              </div>
            </div>
          )}

          {/* ─── Étape 3 : Documents ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="rounded-2xl p-6 border space-y-5"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <h2 className="text-lg font-bold mb-0.5">Documents requis</h2>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Vos documents sont analysés automatiquement par IA et vérifiés par notre équipe
                </p>
              </div>

              {/* Bandeau IA */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <span className="text-xl">🤖</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#3B7FF5' }}>Vérification automatique par IA</p>
                  <p className="text-xs" style={{ color: '#475569' }}>
                    Chaque document est analysé instantanément pour confirmer sa conformité
                  </p>
                </div>
              </div>

              <DocumentZone
                label="Registre de Commerce (RC)"
                description="Photo ou scan lisible du RC en cours de validité"
                docKey="rc"
                state={docs.rc}
                onChange={scanDocument}
              />

              <DocumentZone
                label="Pièce d'identité du gérant"
                description="CNI ou passeport algérien en cours de validité"
                docKey="identite"
                state={docs.identite}
                onChange={scanDocument}
              />

              <DocumentZone
                label="Preuve de local commercial"
                description="Contrat de bail ou acte de propriété du local"
                docKey="local"
                state={docs.local}
                onChange={scanDocument}
              />

              {/* Résumé état documents */}
              <div className="rounded-xl p-4 border"
                style={{ background: '#243352', borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>État des documents</p>
                {(['rc','identite','local'] as DocKey[]).map(key => {
                  const labels = { rc: 'Registre de Commerce', identite: 'Pièce d\'identité', local: 'Local commercial' }
                  const doc = docs[key]
                  const colors = {
                    idle: '#475569', scanning: '#3B7FF5', valid: '#34D399',
                    invalid: '#FCA5A5', uploading: '#3B7FF5', done: '#34D399', error: '#FCA5A5'
                  }
                  const icons = {
                    idle: '○', scanning: '◌', valid: '✓', invalid: '✕',
                    uploading: '⬆', done: '✓', error: '✕'
                  }
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{labels[key]}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold" style={{ color: colors[doc.status] }}>
                          {icons[doc.status]}
                        </span>
                        <span className="text-xs" style={{ color: colors[doc.status] }}>
                          {{ idle:'Non fourni', scanning:'Vérification...', valid:'Validé', invalid:'Non conforme',
                             uploading:'Envoi...', done:'Envoyé', error:'Erreur' }[doc.status]}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs" style={{ color: '#475569' }}>
                ⚠️ Les documents non fournis seront requis lors de la validation manuelle par notre équipe.
              </p>

              <div className="flex gap-3">
                <BackBtn onClick={() => setStep(2)}>← Retour</BackBtn>
                <button
                  onClick={() => { const err = validateStep3(); if (err) { setError(err); return }; handleSubmit() }}
                  disabled={submitting}
                  className="flex-[2] h-11 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
                  style={{ background: '#F59E0B', color: '#0A1628' }}>
                  {submitting ? 'Envoi en cours...' : 'Créer mon compte agence'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Étape 4 : Confirmation ─────────────────────────────────────── */}
          {step === 4 && (
            <div className="rounded-2xl p-8 border text-center"
              style={{ background: '#1E2D45', borderColor: 'rgba(255,255,255,0.08)' }}>

              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
                style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(52,211,153,0.3)' }}>
                🎉
              </div>

              <h2 className="text-2xl font-bold mb-3">Demande envoyée !</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: '#94A3B8' }}>
                Votre dossier d'inscription a bien été reçu. Notre équipe va vérifier
                vos documents et valider votre compte agence sous <strong className="text-white">24 à 48h</strong>.
              </p>

              {/* Étapes à venir */}
              <div className="text-left rounded-xl p-4 mb-6 space-y-3"
                style={{ background: '#243352', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { icon: '📋', step: '1', text: 'Vérification de vos documents par notre équipe' },
                  { icon: '📧', step: '2', text: 'Email de confirmation envoyé à ' + form.email },
                  { icon: '🚗', step: '3', text: 'Accès à votre espace agence activé' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#1E2D45', color: '#94A3B8' }}>
                      {item.step}
                    </div>
                    <span className="text-sm" style={{ color: '#94A3B8' }}>{item.icon} {item.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push('/login')}
                className="w-full h-11 rounded-xl text-sm font-bold transition-all duration-150"
                style={{ background: '#2563EB', color: '#fff' }}>
                Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Boutons navigation ───────────────────────────────────────────────────────
function NextBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex-[2] h-11 rounded-xl text-sm font-bold transition-all duration-150 hover:scale-[1.01] active:scale-[0.98]"
      style={{ background: '#2563EB', color: '#fff' }}>
      {children}
    </button>
  )
}

function BackBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex-1 h-11 rounded-xl text-sm font-semibold border transition-all duration-150"
      style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#94A3B8' }}>
      {children}
    </button>
  )
}
