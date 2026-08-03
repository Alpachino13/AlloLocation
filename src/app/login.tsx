import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { COLORS, WILAYAS, validateEmail, validatePhoneDZ } from '../constants'

// ─── Field component ─────────────────────────────────────────
function Field({
  label, icon, error, children,
}: {
  label: string; icon: string; error?: string; children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: error ? 4 : 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.field, error ? s.fieldErr : null]}>
        <Ionicons name={icon as any} size={17} color={COLORS.text3} />
        {children}
      </View>
      {error ? <Text style={s.errText}>{error}</Text> : null}
    </View>
  )
}

export default function Login() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'client' | 'agence'>('client')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const { refreshRole } = useAuth()

  // Client fields
  const [nomClient, setNomClient] = useState('')
  const [telephoneClient, setTelephoneClient] = useState('')
  // Agency fields
  const [nomAgence, setNomAgence] = useState('')
  const [telephone, setTelephone] = useState('')
  const [numRC, setNumRC] = useState('')
  const [wilaya, setWilaya] = useState('Alger')
  const [adresse, setAdresse] = useState('')
  const [showWilayaPicker, setShowWilayaPicker] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback(() => {
    const errs: Record<string, string> = {}
    if (!email.trim()) errs.email = 'Email requis'
    else if (!validateEmail(email)) errs.email = 'Email invalide'
    if (!password || password.length < 6) errs.password = 'Minimum 6 caractères'
    if (!isLogin && role === 'client') {
      if (!nomClient.trim()) errs.nomClient = 'Nom requis'
      if (!telephoneClient.trim()) errs.telephoneClient = 'Téléphone requis'
      else if (!validatePhoneDZ(telephoneClient)) errs.telephoneClient = 'Format invalide (05/06/07XX...)'
    }
    if (!isLogin && role === 'agence') {
      if (!nomAgence.trim()) errs.nomAgence = 'Nom requis'
      if (!telephone.trim()) errs.telephone = 'Téléphone requis'
      else if (!validatePhoneDZ(telephone)) errs.telephone = 'Format invalide (05/06/07XX...)'
      if (!numRC.trim()) errs.numRC = 'N° RC requis'
      if (!adresse.trim()) errs.adresse = 'Adresse requise'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [email, password, isLogin, role, nomClient, telephoneClient, nomAgence, telephone, numRC, adresse])

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    try {
      if (!isLogin) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: {
            role,
            nom:       role === 'agence' ? nomAgence.trim() : nomClient.trim(),
            telephone: role === 'agence' ? telephone.trim() : telephoneClient.trim(),
            num_rc:    role === 'agence' ? numRC.trim() : '',
            wilaya:    role === 'agence' ? wilaya : '',
            adresse:   role === 'agence' ? adresse.trim() : '',
          }},
        })
        if (error) throw error
        if (data.session) { await refreshRole(); router.replace('/') }
        else { Alert.alert('Compte créé', 'Vérifiez votre email pour confirmer votre compte.'); setIsLogin(true) }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        await refreshRole()
        router.replace('/')
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[s.container, { paddingTop: insets.top }]}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Logo ── */}
        <View style={s.logoSection}>
          <View style={s.logoMark}>
            <Ionicons name="car-sport" size={28} color="#fff" />
          </View>
          <Text style={s.logoTitle}>
            Allo<Text style={{ color: COLORS.blueLight }}>Location</Text>
          </Text>
          <Text style={s.logoSub}>Location de voitures en Algérie</Text>
        </View>

        {/* ── Tab toggle ── */}
        <View style={s.tabBar}>
          {(['Connexion', 'Inscription'] as const).map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[s.tab, (i === 0 ? isLogin : !isLogin) && s.tabActive]}
              onPress={() => { setIsLogin(i === 0); setErrors({}) }}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, (i === 0 ? isLogin : !isLogin) && s.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Form ── */}
        <View style={s.form}>
          <Field label="EMAIL" icon="mail-outline" error={errors.email}>
            <TextInput
              style={s.input} placeholder="vous@example.com" placeholderTextColor={COLORS.text3}
              value={email} onChangeText={v => { setEmail(v); if (errors.email) setErrors(e => ({ ...e, email: '' })) }}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            />
          </Field>

          <Field label="MOT DE PASSE" icon="lock-closed-outline" error={errors.password}>
            <TextInput
              style={s.input} placeholder="••••••••" placeholderTextColor={COLORS.text3}
              value={password} onChangeText={v => { setPassword(v); if (errors.password) setErrors(e => ({ ...e, password: '' })) }}
              secureTextEntry={!showPwd} autoComplete={isLogin ? 'password' : 'new-password'}
            />
            <TouchableOpacity onPress={() => setShowPwd(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={17} color={COLORS.text3} />
            </TouchableOpacity>
          </Field>

          {isLogin && (
            <TouchableOpacity style={s.forgotRow}>
              <Text style={s.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          {/* ── Registration extras ── */}
          {!isLogin && (
            <>
              <Text style={s.sectionLabel}>JE SUIS</Text>
              <View style={s.roleRow}>
                {(['client', 'agence'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.roleBtn, role === r && s.roleBtnActive]}
                    onPress={() => { setRole(r); setErrors({}) }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={r === 'client' ? 'person-outline' : 'business-outline'}
                      size={20}
                      color={role === r ? '#fff' : COLORS.text3}
                    />
                    <Text style={[s.roleBtnText, role === r && { color: '#fff' }]}>
                      {r === 'client' ? 'Client' : 'Agence'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {role === 'client' && (
                <View>
                  <Field label="NOM COMPLET" icon="person-outline" error={errors.nomClient}>
                    <TextInput style={s.input} placeholder="Ahmed Benali" placeholderTextColor={COLORS.text3}
                      value={nomClient} onChangeText={v => { setNomClient(v); if (errors.nomClient) setErrors(e => ({ ...e, nomClient: '' })) }}
                      autoCapitalize="words" />
                  </Field>
                  <Field label="TÉLÉPHONE" icon="call-outline" error={errors.telephoneClient}>
                    <TextInput style={s.input} placeholder="0550 12 34 56" placeholderTextColor={COLORS.text3}
                      value={telephoneClient} onChangeText={v => { setTelephoneClient(v); if (errors.telephoneClient) setErrors(e => ({ ...e, telephoneClient: '' })) }}
                      keyboardType="phone-pad" />
                  </Field>
                </View>
              )}

              {role === 'agence' && (
                <View>
                  <Field label="NOM DE L'AGENCE" icon="business-outline" error={errors.nomAgence}>
                    <TextInput style={s.input} placeholder="Luxury Rides Alger" placeholderTextColor={COLORS.text3}
                      value={nomAgence} onChangeText={v => { setNomAgence(v); if (errors.nomAgence) setErrors(e => ({ ...e, nomAgence: '' })) }}
                      autoCapitalize="words" />
                  </Field>
                  <Field label="TÉLÉPHONE PRO" icon="call-outline" error={errors.telephone}>
                    <TextInput style={s.input} placeholder="0550 12 34 56" placeholderTextColor={COLORS.text3}
                      value={telephone} onChangeText={v => { setTelephone(v); if (errors.telephone) setErrors(e => ({ ...e, telephone: '' })) }}
                      keyboardType="phone-pad" />
                  </Field>
                  <Field label="N° REGISTRE DU COMMERCE" icon="document-text-outline" error={errors.numRC}>
                    <TextInput style={s.input} placeholder="23/00-XXXXXXX" placeholderTextColor={COLORS.text3}
                      value={numRC} onChangeText={v => { setNumRC(v); if (errors.numRC) setErrors(e => ({ ...e, numRC: '' })) }} />
                  </Field>

                  <Text style={s.label}>WILAYA</Text>
                  <TouchableOpacity style={s.field} onPress={() => setShowWilayaPicker(p => !p)}>
                    <Ionicons name="location-outline" size={17} color={COLORS.text3} />
                    <Text style={[s.input, { color: COLORS.text }]}>{wilaya}</Text>
                    <Ionicons name={showWilayaPicker ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.text3} />
                  </TouchableOpacity>
                  {showWilayaPicker && (
                    <View style={s.wilayaList}>
                      <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                        {WILAYAS.map(w => (
                          <TouchableOpacity key={w} style={[s.wilayaItem, wilaya === w && s.wilayaItemActive]}
                            onPress={() => { setWilaya(w); setShowWilayaPicker(false) }}>
                            <Text style={[s.wilayaText, wilaya === w && { color: '#fff', fontWeight: '700' }]}>{w}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <Field label="ADRESSE DU BUREAU" icon="map-outline" error={errors.adresse}>
                    <TextInput style={s.input} placeholder="Rue, quartier, ville" placeholderTextColor={COLORS.text3}
                      value={adresse} onChangeText={v => { setAdresse(v); if (errors.adresse) setErrors(e => ({ ...e, adresse: '' })) }} />
                  </Field>
                </View>
              )}
            </>
          )}

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[s.btnPrimary, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnPrimaryText}>
                  {isLogin ? 'Se connecter' : role === 'agence' ? 'Créer mon compte Agence' : 'Créer mon compte'}
                </Text>
            }
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>ou</Text>
            <View style={s.divLine} />
          </View>

          <TouchableOpacity style={s.btnGhost} onPress={() => router.replace('/')} activeOpacity={0.8}>
            <Text style={s.btnGhostText}>Continuer sans compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.navyLight },
  content:        { paddingBottom: 48 },
  
  logoSection:    { alignItems: 'center', paddingTop: 28, paddingBottom: 32 },
  logoMark:       { width: 64, height: 64, backgroundColor: COLORS.blue, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: COLORS.blue, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  logoTitle:      { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  logoSub:        { fontSize: 13, color: COLORS.text2, marginTop: 4 },

  tabBar:         { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginHorizontal: 20, marginBottom: 28, borderWidth: 1, borderColor: COLORS.border2 },
  tab:            { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  tabActive:      { backgroundColor: COLORS.blue },
  tabText:        { fontSize: 14, fontWeight: '500', color: COLORS.text3 },
  tabTextActive:  { color: '#fff', fontWeight: '700' },

  form:           { paddingHorizontal: 20 },
  label:          { fontSize: 11, fontWeight: '700', color: COLORS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 7, marginTop: 2 },
  field:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, gap: 10, marginBottom: 14 },
  fieldErr:       { borderColor: COLORS.red, borderWidth: 1.5 },
  input:          { flex: 1, color: COLORS.text, fontSize: 15 },
  errText:        { color: COLORS.redLight, fontSize: 12, marginBottom: 10, marginLeft: 2 },
  
  forgotRow:      { alignSelf: 'flex-end', marginBottom: 20, marginTop: -6 },
  forgotText:     { fontSize: 13, color: COLORS.blueLight },

  sectionLabel:   { fontSize: 11, fontWeight: '700', color: COLORS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  roleRow:        { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleBtn:        { flex: 1, gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border2, alignItems: 'center', backgroundColor: COLORS.card },
  roleBtnActive:  { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  roleBtnText:    { fontSize: 14, fontWeight: '600', color: COLORS.text3 },

  wilayaList:     { backgroundColor: COLORS.card2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border2, marginBottom: 14, overflow: 'hidden' },
  wilayaItem:     { paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  wilayaItemActive: { backgroundColor: COLORS.blue },
  wilayaText:     { fontSize: 14, color: COLORS.text2 },

  btnPrimary:     { backgroundColor: COLORS.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16, marginTop: 8, shadowColor: COLORS.blue, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  divider:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  divLine:        { flex: 1, height: 1, backgroundColor: COLORS.border },
  divText:        { fontSize: 12, color: COLORS.text3 },
  
  btnGhost:       { borderWidth: 1, borderColor: COLORS.border2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnGhostText:   { color: COLORS.text2, fontSize: 15, fontWeight: '600' },
})
