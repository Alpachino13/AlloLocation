import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://fmfpqqmksqasyhizeqiq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_D9ZEvoA14e_eXgg3uNjFAA_vvI3t0Cn'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})