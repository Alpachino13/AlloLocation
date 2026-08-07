import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { supabase } from './supabase'
import { enregistrerPushToken } from './notifications'
import { Session } from '@supabase/supabase-js'

type Role = 'client' | 'agence' | 'admin' | null

type AuthContextType = {
  session: Session | null
  role: Role
  loading: boolean
  signOut: () => Promise<void>
  refreshRole: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshRole: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole]       = useState<Role>(null)
  const [loading, setLoading] = useState(true)
  const pushRegistered        = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchRole(session.user.id)
        registerPush(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchRole(session.user.id)
        registerPush(session.user.id)
      } else {
        setRole(null)
        setLoading(false)
        pushRegistered.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Re-register push token quand l'app revient au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && session?.user?.id && !pushRegistered.current) {
        registerPush(session.user.id)
      }
    })
    return () => sub.remove()
  }, [session])

  async function registerPush(userId: string) {
    if (pushRegistered.current) return
    pushRegistered.current = true  // optimiste pour éviter les appels multiples

    const token = await enregistrerPushToken(userId)

    if (!token) {
      // Échec → reset pour permettre un retry plus tard
      pushRegistered.current = false
    }
  }

  async function fetchRole(userId: string, retry = 0): Promise<void> {
    const { data } = await supabase
      .from('profils')
      .select('role')
      .eq('id', userId)
      .single()

    if (!data && retry < 3) {
      await new Promise(r => setTimeout(r, 400))
      return fetchRole(userId, retry + 1)
    }

    setRole((data?.role as Role) ?? 'client')
    setLoading(false)
  }

  async function refreshRole() {
    if (session) {
      setLoading(true)
      await fetchRole(session.user.id)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setRole(null)
    pushRegistered.current = false
  }

  return (
    <AuthContext.Provider value={{ session, role, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
