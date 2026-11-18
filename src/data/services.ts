export type Service = {
  id: string
  name: string
  category: 'urgence' | 'hopital' | 'sang' | 'assistance'
  city: string
  phone?: string
  description?: string
  verified: boolean
}

/**
 * Annuaire de base, embarqué dans l'application pour rester disponible hors connexion.
 * Les numéros nationaux sont vérifiés. Les numéros directs des établissements seront
 * renseignés et validés avec chaque partenaire pendant la phase pilote (table service_directory).
 */
export const BASE_SERVICES: Service[] = [
  { id: 'samu', name: 'SAMU — urgence médicale', category: 'urgence', city: 'National', phone: '15', description: 'Malaise, blessé grave, accouchement difficile', verified: true },
  { id: 'police', name: 'Police secours', category: 'urgence', city: 'National', phone: '17', description: 'Agression, vol, accident avec trouble à l’ordre public', verified: true },
  { id: 'pompiers', name: 'Sapeurs-pompiers', category: 'urgence', city: 'National', phone: '18', description: 'Accident de la route, incendie, désincarcération', verified: true },

  { id: 'hnn', name: 'Hôpital National de Niamey', category: 'hopital', city: 'Niamey', verified: false },
  { id: 'hnl', name: 'Hôpital National Amirou Boubacar Diallo (Lamordé)', category: 'hopital', city: 'Niamey', verified: false },
  { id: 'hgr', name: 'Hôpital Général de Référence', category: 'hopital', city: 'Niamey', verified: false },
  { id: 'chr-poudriere', name: 'Centre Hospitalier Régional Poudrière', category: 'hopital', city: 'Niamey', verified: false },
  { id: 'mig', name: 'Maternité Issaka Gazobi', category: 'hopital', city: 'Niamey', verified: false },
  { id: 'cnts', name: 'Centre National de Transfusion Sanguine', category: 'sang', city: 'Niamey', description: 'Disponibilité des poches de sang', verified: false },

  { id: 'chr-dosso', name: 'Centre Hospitalier Régional de Dosso', category: 'hopital', city: 'Dosso', verified: false },
  { id: 'chr-tahoua', name: 'Centre Hospitalier Régional de Tahoua', category: 'hopital', city: 'Tahoua', verified: false },
  { id: 'chr-maradi', name: 'Centre Hospitalier Régional de Maradi', category: 'hopital', city: 'Maradi', verified: false },
  { id: 'hnz', name: 'Hôpital National de Zinder', category: 'hopital', city: 'Zinder', verified: false },
  { id: 'chr-agadez', name: 'Centre Hospitalier Régional d’Agadez', category: 'hopital', city: 'Agadez', verified: false },
  { id: 'chr-diffa', name: 'Centre Hospitalier Régional de Diffa', category: 'hopital', city: 'Diffa', verified: false },
  { id: 'chr-tillaberi', name: 'Centre Hospitalier Régional de Tillabéri', category: 'hopital', city: 'Tillabéri', verified: false },
]

export const CATEGORY_LABEL: Record<Service['category'], string> = {
  urgence: 'Numéros d’urgence',
  hopital: 'Hôpitaux',
  sang: 'Sang',
  assistance: 'Assistance',
}
