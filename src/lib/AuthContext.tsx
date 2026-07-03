import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
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
    signOut: async () => { },
    refreshRole: async () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [role, setRole] = useState<Role>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) fetchRole(session.user.id)
            else setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session) fetchRole(session.user.id)
            else { setRole(null); setLoading(false) }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchRole(userId: string, retry = 0): Promise<void> {
        const { data } = await supabase
            .from('profils')
            .select('role')
            .eq('id', userId)
            .single()

        if (!data && retry < 3) {
            // Le profil n'est pas encore créé (race condition après signUp) → on réessaie
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
    }

    return (
        <AuthContext.Provider value={{ session, role, loading, signOut, refreshRole }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)