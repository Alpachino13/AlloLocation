import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { COLORS, WILAYAS, validateEmail, validatePhoneDZ } from '../constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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

  // Champs client
  const [nomClient, setNomClient] = useState('')
  const [telephoneClient, setTelephoneClient] = useState('')

  // Champs agence
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
    if (!password || password.length < 6) errs.password = 'Min. 6 caractères'

    if (!isLogin && role === 'client') {
      if (!nomClient.trim()) errs.nomClient = 'Nom requis'
      if (!telephoneClient.trim()) errs.telephoneClient = 'Téléphone requis'
      else if (!validatePhoneDZ(telephoneClient)) errs.telephoneClient = 'Format algérien invalide (05XX...)'
    }

    if (!isLogin && role === 'agence') {
      if (!nomAgence.trim()) errs.nomAgence = 'Nom requis'
      if (!telephone.trim()) errs.telephone = 'Téléphone requis'
      else if (!validatePhoneDZ(telephone)) errs.telephone = 'Format algérien invalide (05XX...)'
      if (!numRC.trim()) errs.numRC = 'N° RC requis'
      if (!adresse.trim()) errs.adresse = 'Adresse requise'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [email, password, isLogin, role, nomAgence, telephone, numRC, adresse])

  async function handleEmail() {
    if (!validate()) return
    setLoading(true)

    try {
      if (!isLogin) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role,
              nom: role === 'agence' ? nomAgence.trim() : email.split('@')[0],
              telephone: telephone.trim(),
              num_rc: role === 'agence' ? numRC.trim() : '',
              wilaya: role === 'agence' ? wilaya : '',
              adresse: role === 'agence' ? adresse.trim() : '',
            }
          }
        })

        if (error) throw error

        if (data.session) {
          await refreshRole()
          router.replace('/')
        } else {
          Alert.alert('✅ Compte créé', 'Vérifiez votre email pour confirmer votre compte.')
          setIsLogin(true)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
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
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoBox}>
          <View style={styles.logoMark}>
            <Text style={{ fontSize: 28 }}>🚗</Text>
          </View>
          <Text style={styles.logoTitle}>Allo<Text style={{ color: COLORS.blue }}>Location</Text></Text>
          <Text style={styles.logoSub}>Location de voitures en Algérie</Text>
        </View>

        {/* Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
            onPress={() => { setIsLogin(true); setErrors({}) }}
          >
            <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
            onPress={() => { setIsLogin(false); setErrors({}) }}
          >
            <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Inscription</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <View style={[styles.field, errors.email && styles.fieldError]}>
            <Ionicons name="mail-outline" size={18} color={COLORS.text3} />
            <TextInput
              style={styles.fieldInput}
              placeholder="vous@example.com"
              placeholderTextColor={COLORS.text3}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* Password */}
          <Text style={styles.fieldLabel}>MOT DE PASSE</Text>
          <View style={[styles.field, errors.password && styles.fieldError]}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.text3} />
            <TextInput
              style={styles.fieldInput}
              placeholder="••••••••"
              placeholderTextColor={COLORS.text3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoComplete={isLogin ? 'password' : 'new-password'}
            />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
              <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.text3} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

          {isLogin && (
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          {!isLogin && (
            <>
              <Text style={[styles.fieldLabel, { marginBottom: 10 }]}>JE SUIS</Text>
              <View style={styles.roleToggle}>
                {(['client', 'agence'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOpt, role === r && styles.roleOptActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{r === 'client' ? '👤' : '🏢'}</Text>
                    <Text style={[styles.roleOptText, role === r && { color: '#fff' }]}>
                      {r === 'client' ? 'Client' : 'Agence'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {role === 'agence' && (
                <View>
                  <Text style={styles.sectionDivider}>INFORMATIONS DE L'AGENCE</Text>

                  <Text style={styles.fieldLabel}>Nom de l"agence</Text>
                  <View style={[styles.field, errors.nomAgence && styles.fieldError]}>
                    <Ionicons name="business-outline" size={18} color={COLORS.text3} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="ex: Luxury Rides Alger"
                      placeholderTextColor={COLORS.text3}
                      value={nomAgence}
                      onChangeText={setNomAgence}
                      autoCapitalize="words"
                    />
                  </View>
                  {errors.nomAgence && <Text style={styles.errorText}>{errors.nomAgence}</Text>}

                  <Text style={styles.fieldLabel}>Téléphone Pro</Text>
                  <View style={[styles.field, errors.telephone && styles.fieldError]}>
                    <Ionicons name="call-outline" size={18} color={COLORS.text3} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="ex: 0550 12 34 56"
                      placeholderTextColor={COLORS.text3}
                      value={telephone}
                      onChangeText={setTelephone}
                      keyboardType="phone-pad"
                    />
                  </View>
                  {errors.telephone && <Text style={styles.errorText}>{errors.telephone}</Text>}

                  <Text style={styles.fieldLabel}>N° Registre du Commerce (RC)</Text>
                  <View style={[styles.field, errors.numRC && styles.fieldError]}>
                    <Ionicons name="document-text-outline" size={18} color={COLORS.text3} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="ex: 23/00-XXXXXXX"
                      placeholderTextColor={COLORS.text3}
                      value={numRC}
                      onChangeText={setNumRC}
                    />
                  </View>
                  {errors.numRC && <Text style={styles.errorText}>{errors.numRC}</Text>}

                  {/* Wilaya Picker */}
                  <Text style={styles.fieldLabel}>Wilaya</Text>
                  <TouchableOpacity
                    style={styles.field}
                    onPress={() => setShowWilayaPicker(!showWilayaPicker)}
                  >
                    <Ionicons name="location-outline" size={18} color={COLORS.text3} />
                    <Text style={[styles.fieldInput, { color: COLORS.text }]}>{wilaya}</Text>
                    <Ionicons name={showWilayaPicker ? "chevron-up" : "chevron-down"} size={18} color={COLORS.text3} />
                  </TouchableOpacity>

                  {showWilayaPicker && (
                    <View style={styles.wilayaList}>
                      <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                        {WILAYAS.map(w => (
                          <TouchableOpacity
                            key={w}
                            style={[styles.wilayaItem, wilaya === w && styles.wilayaItemActive]}
                            onPress={() => { setWilaya(w); setShowWilayaPicker(false) }}
                          >
                            <Text style={[styles.wilayaText, wilaya === w && { color: '#fff', fontWeight: '700' }]}>{w}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Adresse du Bureau</Text>
                  <View style={[styles.field, errors.adresse && styles.fieldError]}>
                    <Ionicons name="map-outline" size={18} color={COLORS.text3} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Adresse complète"
                      placeholderTextColor={COLORS.text3}
                      value={adresse}
                      onChangeText={setAdresse}
                    />
                  </View>
                  {errors.adresse && <Text style={styles.errorText}>{errors.adresse}</Text>}
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
            onPress={handleEmail}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {isLogin ? 'Se connecter' : role === 'agence' ? 'Créer mon compte Agence' : 'Créer mon compte'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.btnOutline} onPress={() => router.replace('/')}>
            <Text style={styles.btnOutlineText}>Continuer sans compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  content: { paddingBottom: 40 },
  logoBox: { alignItems: 'center', paddingTop: 20, paddingBottom: 28 },
  logoMark: { width: 60, height: 60, backgroundColor: COLORS.blue, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  logoSub: { fontSize: 14, color: COLORS.text2, marginTop: 4 },
  toggle: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 4, marginHorizontal: 20, marginBottom: 24, borderWidth: 0.5, borderColor: COLORS.border3 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: COLORS.blue },
  toggleText: { fontSize: 14, fontWeight: '500', color: COLORS.text2 },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  form: { paddingHorizontal: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text2, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  field: { backgroundColor: COLORS.card, borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  fieldError: { borderColor: COLORS.red, borderWidth: 1 },
  fieldInput: { flex: 1, color: COLORS.text, fontSize: 15 },
  errorText: { color: COLORS.redLight, fontSize: 12, marginBottom: 10, marginLeft: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { fontSize: 13, color: COLORS.blueLight },
  roleToggle: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  roleOpt: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border3, alignItems: 'center', backgroundColor: COLORS.card },
  roleOptActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  roleOptText: { fontSize: 14, fontWeight: '600', color: COLORS.text2 },
  btnPrimary: { backgroundColor: COLORS.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16, marginTop: 10 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.text3 },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 0.5, borderColor: COLORS.border3, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  sectionDivider: { fontSize: 11, fontWeight: '700', color: COLORS.blueLight, letterSpacing: 1, marginTop: 10, marginBottom: 16, textAlign: 'center' },
  wilayaList: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border3, marginBottom: 14, overflow: 'hidden' },
  wilayaItem: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  wilayaItemActive: { backgroundColor: COLORS.blue },
  wilayaText: { fontSize: 14, color: COLORS.text2 },
})