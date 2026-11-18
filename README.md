# NIGORA — Sécurité et assistance des voyageurs au Niger

Application web progressive (PWA, installable sur Android et iPhone) qui met en œuvre les quatre capacités du pitch NIGORA, plus les espaces professionnels du modèle économique.

| Pilier du pitch | Dans l’application |
|---|---|
| **1. Préparer et sécuriser les déplacements** | Trajet (départ, destination, heure d’arrivée estimée, compagnie, immatriculation), contacts de confiance, partage par SMS, **suivi volontaire** (position enregistrée à intervalle choisi), points d’étape, « Je suis arrivé·e », **détection de retard** (15 min après l’heure prévue) avec notification et SMS de retard pré-rempli, lien de suivi pour les proches. |
| **2. Alerte SOS** | Bouton SOS avec type d’urgence et compte à rebours annulable, récupération de la position (repli sur la dernière position connue), SMS multi-destinataires vers les contacts, WhatsApp, appel direct SAMU 15 / Police 17 / Pompiers 18, « Je suis en sécurité » pour clôturer, historique. |
| **3. Profil médical d’urgence** | Groupe sanguin, allergies, antécédents, traitements, personne à contacter. **Trois consentements distincts** : joindre au SMS d’alerte, afficher sur la fiche d’urgence, partager avec les partenaires. Fiche plein écran + **QR code lisible sans Internet**, imprimable. |
| **4. Mode connexion limitée** | Tout est stocké sur le téléphone (IndexedDB + copie de secours), application disponible hors ligne (service worker), dernière position connue, alertes par **SMS natif** (réseau GSM suffit), file d’attente **synchronisée automatiquement** au retour d’Internet. |
| **Modèle B2B** | **Espace entreprise / transporteur** : alertes en temps réel, trajets en cours et retards, véhicules, équipe, code d’adhésion pour les voyageurs/chauffeurs. Les entreprises ne voient **jamais** les données médicales. |
| **Partenariats autorités / hôpitaux** | **Espace partenaires** : réception des alertes, prise en charge, clôture, journal des changements de statut ; données médicales visibles uniquement avec le consentement du voyageur. |

Les fonctions voyageur sont **gratuites et marchent sans compte**. Les comptes servent à la synchronisation et aux espaces professionnels.

## Aperçu

<p>
<img src="docs/captures/1-accueil.png" width="200"> <img src="docs/captures/2-sos.png" width="200"> <img src="docs/captures/4-fiche.png" width="200"> <img src="docs/captures/3-trajet.png" width="200">
</p>
<img src="docs/captures/8-espace-entreprise.png" width="820">

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production dans dist/
```

Sans configuration, NIGORA tourne en **mode local** : toutes les fonctions voyageur sont actives, et les espaces entreprise / partenaires s’affichent avec des données de démonstration.

## Activer le serveur (Supabase)

1. Créer un projet Supabase.
2. Exécuter `supabase/migrations/20261118000000_init.sql` (SQL Editor ou `supabase db push`).
3. Copier `.env.example` en `.env` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. Donner l’accès partenaire à un compte (après son inscription) :
   ```sql
   insert into partners (name, kind, region) values ('SAMU Niamey', 'secours', 'Niamey') returning id;
   insert into partner_members (partner_id, user_id) values ('<id partenaire>', '<id utilisateur>');
   ```
5. Valider les coordonnées des établissements dans la table `service_directory` (`verified = true`) au fil du pilote.

### SMS envoyés par le serveur (facultatif)

Le SMS part d’abord du téléphone (fonctionne sans Internet). En complément, la fonction `supabase/functions/notify-alert` envoie automatiquement un SMS aux contacts dès qu’une alerte arrive au serveur :

```bash
supabase functions deploy notify-alert --no-verify-jwt
supabase secrets set SMS_PROVIDER=africastalking AT_USERNAME=... AT_API_KEY=... WEBHOOK_SECRET=...
```

Puis créer un **Database Webhook** (table `alerts`, événement `INSERT`) vers cette fonction avec l’en-tête `x-webhook-secret`. Twilio est aussi pris en charge (`SMS_PROVIDER=twilio`).

## Déploiement

Site statique : Vercel, Netlify ou Cloudflare Pages (`npm run build`, dossier `dist`). Configurer la réécriture de toutes les routes vers `index.html`. Le HTTPS est obligatoire pour la géolocalisation et le mode hors ligne.

## Sécurité des données

- Row Level Security sur toutes les tables ; chaque voyageur ne voit que ses données.
- Entreprises : trajets, positions et alertes de leurs membres, sans données médicales.
- Partenaires : alertes des 7 derniers jours ; médical seulement si `consent_share_with_partners`.
- Une resynchronisation tardive du téléphone ne peut pas annuler une prise en charge en cours.
- Lien de suivi : uniquement si le suivi est activé, prénom seul, expire 24 h après la fin du trajet.

## Limites connues (navigateur)

- Le suivi de position fonctionne **tant que l’application est ouverte** (écran allumé ou en arrière-plan récent). Un suivi permanent écran éteint nécessite l’empaquetage en application native (Capacitor), prévu après le pilote.
- L’envoi du SMS demande une validation dans l’application Messages du téléphone (restriction des navigateurs) ; l’envoi automatique est assuré par la fonction serveur quand Internet est disponible.

## Structure

```
src/
  lib/          état local, synchronisation, messages SMS, géolocalisation, Supabase
  pages/        Accueil, SOS, Trajets, Médical (+ fiche), Contacts, Services, Hors ligne, Compte, Pro, Partenaires, Suivi
  components/   interface, suivi des trajets et synchronisation en tâche de fond
  data/         villes du Niger, annuaire de base, données de démonstration
supabase/       migration SQL (schéma, RLS, RPC) et fonction SMS
```

NIGORA ne remplace pas les services de secours. En danger immédiat : **SAMU 15 · Police 17 · Pompiers 18**.
