// constants.ts - Configuration globale AlloLocation Algérie
export const COLORS = {
  navy: '#0A1628',
  navyLight: '#0D1E35',
  card: '#1E2D45',
  card2: '#243352',
  card3: '#2A3A5C',
  blue: '#2563EB',
  blueLight: '#3B7FF5',
  blueDark: '#1D4ED8',
  gold: '#F59E0B',
  goldLight: '#FCD34D',
  green: '#10B981',
  greenLight: '#34D399',
  red: '#EF4444',
  redLight: '#FCA5A5',
  text: '#F8FAFC',
  text2: '#94A3B8',
  text3: '#475569',
  border: 'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.10)',
  border3: 'rgba(255,255,255,0.12)',
} as const

export const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou',
  'Alger','Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba',
  'Guelma','Constantine','Médéa','Mostaganem',"M'Sila",'Mascara','Ouargla',
  'Oran','El Bayadh','Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf',
  'Tindouf','Tissemsilt','El Oued','Khenchela','Souk Ahras','Tipaza','Mila',
  'Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane','Timimoun','Bordj Badji Mokhtar',
  'Ouled Djellal','Béni Abbès','In Salah','In Guezzam','Touggourt','Djanet',
  "El M'Ghair",'El Meniaa',
] as const

export const CARBURANTS = ['Essence', 'Diesel', 'Électrique', 'Hybride'] as const
export const BOITES = ['Manuelle', 'Automatique'] as const
export const CATEGORIES = ['Économique', 'SUV / 4x4', 'Luxe', 'Camion', 'Berline', 'Citadine'] as const

export const STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  loue: 'Loué',
  maintenance: 'En maintenance',
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  annulee: 'Annulée',
  terminee: 'Terminée',
}

export const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  disponible:  { bg: 'rgba(16,185,129,0.15)',  color: '#34D399', border: 'rgba(52,211,153,0.3)',   label: 'Disponible' },
  loue:        { bg: 'rgba(239,68,68,0.15)',   color: '#FCA5A5', border: 'rgba(239,68,68,0.3)',    label: 'Loué' },
  maintenance: { bg: 'rgba(245,158,11,0.15)',  color: '#FCD34D', border: 'rgba(245,158,11,0.3)',   label: 'En maintenance' },
  en_attente:  { bg: 'rgba(245,158,11,0.15)',  color: '#FCD34D', border: 'rgba(245,158,11,0.3)',   label: 'En attente' },
  confirmee:   { bg: 'rgba(16,185,129,0.15)',  color: '#34D399', border: 'rgba(52,211,153,0.3)',   label: 'Confirmée' },
  annulee:     { bg: 'rgba(239,68,68,0.15)',   color: '#FCA5A5', border: 'rgba(239,68,68,0.3)',    label: 'Annulée' },
  terminee:    { bg: 'rgba(148,163,184,0.15)', color: '#94A3B8', border: 'rgba(148,163,184,0.3)',  label: 'Terminée' },
}

export function formatDA(n: number): string {
  return n.toLocaleString('fr-DZ') + ' DA'
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 30) return `Il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-DZ')
}

export function validatePhoneDZ(phone: string): boolean {
  // Format algérien : 05XX XX XX XX ou +213 5XX XX XX XX
  const cleaned = phone.replace(/\s/g, '').replace(/^\+213/, '0')
  return /^0(5|6|7)[0-9]{8}$/.test(cleaned)
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}


// ============================================
// SQL MIGRATION SUPABASE (à exécuter dans SQL Editor)
// ============================================
export const SQL_MIGRATION = `
-- 1. Ajouter colonnes manquantes sur voitures
ALTER TABLE public.voitures
  ADD COLUMN IF NOT EXISTS annee integer,
  ADD COLUMN IF NOT EXISTS climatisation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- 2. Mettre à jour les contraintes CHECK
ALTER TABLE public.voitures DROP CONSTRAINT IF EXISTS voitures_categorie_check;
ALTER TABLE public.voitures ADD CONSTRAINT voitures_categorie_check
  CHECK (categorie = ANY (ARRAY['Économique','SUV / 4x4','Luxe','Camion','Berline','Citadine']));

ALTER TABLE public.voitures DROP CONSTRAINT IF EXISTS voitures_statut_check;
ALTER TABLE public.voitures ADD CONSTRAINT voitures_statut_check
  CHECK (statut = ANY (ARRAY['disponible','loue','maintenance']));

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_statut_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_statut_check
  CHECK (statut = ANY (ARRAY['en_attente','confirmee','annulee','terminee']));

-- 3. Ajouter photo_url sur profils
ALTER TABLE public.profils ADD COLUMN IF NOT EXISTS photo_url text;

-- 4. Index performance
CREATE INDEX IF NOT EXISTS idx_voitures_agence_id ON public.voitures(agence_id);
CREATE INDEX IF NOT EXISTS idx_voitures_statut ON public.voitures(statut);
CREATE INDEX IF NOT EXISTS idx_voitures_wilaya ON public.voitures(wilaya);
CREATE INDEX IF NOT EXISTS idx_voitures_coords ON public.voitures(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_voiture_id ON public.reservations(voiture_id);
CREATE INDEX IF NOT EXISTS idx_favoris_user_id ON public.favoris(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lu ON public.notifications(lu);

-- 5. RLS notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- 6. Trigger auto profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profils (id, nom, role, telephone, num_rc, wilaya, adresse)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'telephone',
    NEW.raw_user_meta_data->>'num_rc',
    NEW.raw_user_meta_data->>'wilaya',
    NEW.raw_user_meta_data->>'adresse'
  )
  ON CONFLICT (id) DO UPDATE SET
    nom = EXCLUDED.nom,
    role = EXCLUDED.role,
    telephone = EXCLUDED.telephone,
    num_rc = EXCLUDED.num_rc,
    wilaya = EXCLUDED.wilaya,
    adresse = EXCLUDED.adresse;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;