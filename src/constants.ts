// constants.ts - AlloLocation Design System
export const COLORS = {
  // Base surfaces
  navy:       '#080F1E',    // deepest bg
  navyLight:  '#0C1628',    // page bg
  card:       '#111E33',    // card surface
  card2:      '#162440',    // elevated card / input bg
  card3:      '#1C2D4E',    // highest card elevation
  
  // Brand
  blue:       '#2563EB',
  blueLight:  '#60A5FA',
  blueDark:   '#1D4ED8',
  blueMuted:  'rgba(37,99,235,0.12)',
  
  // Accent
  gold:       '#F59E0B',
  goldLight:  '#FCD34D',
  goldMuted:  'rgba(245,158,11,0.12)',
  
  // Status
  green:      '#10B981',
  greenLight: '#34D399',
  greenMuted: 'rgba(16,185,129,0.12)',
  red:        '#EF4444',
  redLight:   '#FCA5A5',
  redMuted:   'rgba(239,68,68,0.12)',
  
  // Text
  text:       '#F1F5F9',
  text2:      '#94A3B8',
  text3:      '#4A5568',
  
  // Borders & separators
  border:     'rgba(255,255,255,0.05)',
  border2:    'rgba(255,255,255,0.08)',
  border3:    'rgba(255,255,255,0.10)',

  // Semantic aliases
  surface:    '#111E33',
  surfaceRaised: '#162440',
} as const

// Spacing scale (4pt grid)
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
} as const

// Border radius tokens
export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  full: 999,
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
export const BOITES     = ['Manuelle', 'Automatique'] as const
export const CATEGORIES_LIST = ['Tous', 'Économique', 'SUV / 4x4', 'Luxe', 'Camion', 'Berline', 'Citadine'] as const
export const CATEGORIES = ['Économique', 'SUV / 4x4', 'Luxe', 'Camion', 'Berline', 'Citadine'] as const

export const CATEGORY_ICONS: Record<string, string> = {
  'Tous':       'car-sport-outline',
  'Économique': 'speedometer-outline',
  'SUV / 4x4':  'fitness-outline',
  'Luxe':       'diamond-outline',
  'Camion':     'cube-outline',
  'Berline':    'car-outline',
  'Citadine':   'navigate-circle-outline',
}

export const STATUS_LABELS: Record<string, string> = {
  disponible:  'Disponible',
  loue:        'Loué',
  maintenance: 'En maintenance',
  en_attente:  'En attente',
  confirmee:   'Confirmée',
  annulee:     'Annulée',
  terminee:    'Terminée',
}

export const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  disponible:  { bg: 'rgba(16,185,129,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.25)',  label: 'Disponible' },
  loue:        { bg: 'rgba(239,68,68,0.12)',   color: '#FCA5A5', border: 'rgba(239,68,68,0.25)',   label: 'Loué' },
  maintenance: { bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D', border: 'rgba(245,158,11,0.25)',  label: 'En maintenance' },
  en_attente:  { bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D', border: 'rgba(245,158,11,0.25)',  label: 'En attente' },
  confirmee:   { bg: 'rgba(16,185,129,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.25)',  label: 'Confirmée' },
  annulee:     { bg: 'rgba(239,68,68,0.12)',   color: '#FCA5A5', border: 'rgba(239,68,68,0.25)',   label: 'Annulée' },
  terminee:    { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.25)', label: 'Terminée' },
}

export function formatDA(n: number): string {
  return n.toLocaleString('fr-DZ') + ' DA'
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return "À l'instant"
  if (mins < 60)  return `Il y a ${mins} min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 30)  return `Il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-DZ')
}

export function validatePhoneDZ(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '').replace(/^\+213/, '0')
  return /^0(5|6|7)[0-9]{8}$/.test(cleaned)
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const SQL_MIGRATION = ``
