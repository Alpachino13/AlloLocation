import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NAVY = '#0A1628'; const CARD = '#1E2D45'
const BLUE = '#2563EB'; const BLUE_L = '#3B7FF5'
const TEXT = '#F8FAFC'; const TEXT2 = '#94A3B8'; const TEXT3 = '#475569'
const BORDER = 'rgba(255,255,255,0.08)'; const BORDER2 = 'rgba(255,255,255,0.12)'

export default function Login() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'client' | 'agence'>('client')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const { refreshRole } = useAuth()

  async function handleEmail() {
    if (!email || !password) return Alert.alert('Erreur', 'Remplis tous les champs')
    setLoading(true)

    if (!isLogin) {
      // On passe les infos (role, nom) dans les métadonnées de Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role,
            nom: email.split('@')[0],
            telephone: ''
          }
        }
      })

      if (error) {
        Alert.alert('Erreur', error.message)
        setLoading(false)
        return
      }

      // Le trigger SQL s'est occupé de créer le profil.
      // Si une session est directement renvoyée (pas de confirmation email exigée)
      if (data.session) {
        await refreshRole()
        router.replace('/' as any)
      } else {
        Alert.alert('✅ Compte créé', 'Vérifie ton email pour confirmer ou connecte-toi')
        setIsLogin(true) // On bascule sur l'écran de connexion par confort
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        Alert.alert('Erreur', error.message)
      } else {
        await refreshRole()
        router.replace('/' as any)
      }
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Status */}
        <View style={s.statusBar}>
          <Text style={s.time}>9:41</Text>
          <Text style={{ color: TEXT, fontSize: 13 }}>📶 🔋</Text>
        </View>

        {/* Logo */}
        <View style={s.logoBox}>
          <View style={s.logoMark}>
            <Text style={{ fontSize: 28 }}>🚗</Text>
          </View>
          <Text style={s.logoTitle}>Allo<Text style={{ color: BLUE }}>Location</Text></Text>
          <Text style={s.logoSub}>Location de voitures en Algérie</Text>
        </View>

        {/* Login / Register toggle */}
        <View style={s.toggle}>
          <TouchableOpacity style={[s.toggleBtn, isLogin && s.toggleBtnActive]} onPress={() => setIsLogin(true)}>
            <Text style={[s.toggleText, isLogin && s.toggleTextActive]}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toggleBtn, !isLogin && s.toggleBtnActive]} onPress={() => setIsLogin(false)}>
            <Text style={[s.toggleText, !isLogin && s.toggleTextActive]}>Inscription</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.fieldLabel}>EMAIL</Text>
          <View style={s.field}>
            <Text style={{ fontSize: 18, color: TEXT3 }}>📧</Text>
            <TextInput style={s.fieldInput} placeholder="vous@example.com" placeholderTextColor={TEXT3}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <Text style={s.fieldLabel}>MOT DE PASSE</Text>
          <View style={s.field}>
            <Text style={{ fontSize: 18, color: TEXT3 }}>🔒</Text>
            <TextInput style={s.fieldInput} placeholder="••••••••" placeholderTextColor={TEXT3}
              value={password} onChangeText={setPassword} secureTextEntry={!showPwd} />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
              <Text style={{ fontSize: 16, color: TEXT3 }}>{showPwd ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {isLogin && (
            <TouchableOpacity style={s.forgotBtn}>
              <Text style={s.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          {!isLogin && (
            <>
              <Text style={[s.fieldLabel, { marginBottom: 10 }]}>JE SUIS</Text>
              <View style={s.roleToggle}>
                {(['client', 'agence'] as const).map(r => (
                  <TouchableOpacity key={r} style={[s.roleOpt, role === r && s.roleOptActive]} onPress={() => setRole(r)}>
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{r === 'client' ? '👤' : '🏢'}</Text>
                    <Text style={[s.roleOptText, role === r && { color: '#fff' }]}>
                      {r === 'client' ? 'Client' : 'Agence'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={[s.btnPrimary, loading && { opacity: 0.6 }]} onPress={handleEmail} disabled={loading}>
            <Text style={s.btnPrimaryText}>{loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Créer mon compte'}</Text>
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>ou</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.btnOutline} onPress={() => router.replace('/' as any)}>
            <Text style={s.btnOutlineText}>Continuer sans compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  content: { paddingBottom: 40 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  time: { fontSize: 15, fontWeight: '700', color: TEXT },
  logoBox: { alignItems: 'center', paddingTop: 20, paddingBottom: 28 },
  logoMark: { width: 60, height: 60, backgroundColor: BLUE, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoTitle: { fontSize: 26, fontWeight: '900', color: TEXT, letterSpacing: -0.5 },
  logoSub: { fontSize: 14, color: TEXT2, marginTop: 4 },
  toggle: { flexDirection: 'row', backgroundColor: CARD, borderRadius: 14, padding: 4, marginHorizontal: 20, marginBottom: 24, borderWidth: 0.5, borderColor: BORDER2 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: BLUE },
  toggleText: { fontSize: 14, fontWeight: '500', color: TEXT2 },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  form: { paddingHorizontal: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: TEXT2, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  field: { backgroundColor: CARD, borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  fieldInput: { flex: 1, color: TEXT, fontSize: 15 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { fontSize: 13, color: BLUE_L },
  roleToggle: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  roleOpt: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: BORDER2, alignItems: 'center' },
  roleOptActive: { backgroundColor: BLUE, borderColor: BLUE },
  roleOptText: { fontSize: 14, fontWeight: '600', color: TEXT2 },
  btnPrimary: { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: BORDER },
  dividerText: { fontSize: 12, color: TEXT3 },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 0.5, borderColor: BORDER2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { color: TEXT, fontSize: 15, fontWeight: '600' },
})
