export type StatutVoiture = 'disponible' | 'loue' | 'maintenance'
export type StatutReservation = 'en_attente' | 'confirmee' | 'annulee' | 'terminee'
export type Role = 'client' | 'agence' | 'admin'

export type Voiture = {
  id: string
  nom: string
  agence: string
  agence_id: string
  prix: number
  note: number | null
  carburant: string | null
  boite: string | null
  km_jour: number | null
  places: number | null
  wilaya: string | null
  statut: StatutVoiture
  image_url: string | null
  categorie: string | null
  annee: number | null
  climatisation: boolean | null
  description: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

export type Reservation = {
  id: string
  voiture_id: string | null
  user_id: string | null
  date_debut: string
  date_fin: string
  statut: StatutReservation
  montant: number | null
  client_nom_manuel: string | null
  client_telephone_manuel: string | null
  created_at: string
  voitures?: Pick<Voiture, 'id' | 'nom' | 'image_url' | 'agence_id' | 'prix'> | null
  profils?: Pick<Profil, 'nom' | 'telephone'> | null
}

export type Profil = {
  id: string
  nom: string | null
  telephone: string | null
  role: Role | null
  agence_id: string | null
  wilaya: string | null
  adresse: string | null
  num_rc: string | null
  photo_url: string | null
  push_token: string | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string | null
  titre: string
  message: string
  type: string | null
  lu: boolean | null
  created_at: string
}
