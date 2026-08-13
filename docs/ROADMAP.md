# MOTOBOY — Reste à faire

> **Ce document ne contient ni dates ni estimations.** L'ordre est contraint par
> les dépendances techniques, pas par un calendrier : la taille de l'équipe et sa
> disponibilité ne sont pas connues, et inventer des durées produirait une
> fiction dont personne ne se servirait.
>
> Il se périme si on ne le tient pas à jour. L'état des lieux est donc adossé à
> ce qui se vérifie par commande, pas à ce dont on se souvient.
>
> **Dernière mise à jour** — 13 août 2026

---

## 1. État des lieux

Tout ce qui suit est vérifiable : `pnpm verify` à la racine, `composer check`
dans `apps/api`.

| Chantier | État | Vérification |
|---|---|---|
| Décisions produit | 6 points bloquants et 10 points importants tranchés | [BRIEF.md](BRIEF.md) |
| Modèle de données | 33 tables, garde-fous de concurrence éprouvés | [SCHEMA.md](SCHEMA.md) · 18 migrations |
| Contrat d'API | **lot 1 seulement** — 24 opérations | [openapi.yaml](openapi.yaml) |
| Monorepo | pnpm, Laravel hors workspace, chaîne de génération éprouvée | `pnpm verify` |
| Standard de code | outillé : Pint, Larastan 8, Prettier, oxlint, CI | [CODING-STANDARD.md](CODING-STANDARD.md) |
| Référentiel | 26 villes, alias, rôles et permissions, idempotent | `php artisan db:seed` |
| Modèles Eloquent | 35 modèles, exercés contre le vrai schéma | `composer check` |
| **Recherche** | 4 endpoints publics, éprouvés de bout en bout | 48 tests, 144 assertions |
| **Authentification** | inscription, OTP, session Sanctum, port SMS | idem |

**Ce qui n'existe pas encore** : réservation, paiement, billet, embarquement —
et tout le back-office agence.

---

## 2. Décisions qui ne dépendent pas du code

Ces points ne se règlent pas en écrivant du logiciel. Un seul reste entièrement
ouvert — l'hébergement — et il devra l'être avant la première mise en
production.

| Sujet | État | Ce qu'il bloque |
|---|---|---|
| **Agrégateur de paiement** | grille de sélection prête en [B4](BRIEF.md) | L'intégration réelle du paiement. *Pas* le développement — voir l'abstraction ci-dessous |
| **Cadre réglementaire CEMAC** | ouvert, à poser à un conseil local | Une réponse défavorable remettrait en cause l'encaissement centralisé, donc `agency_ledger_entries`, `payouts` et `payout_lines` |
| **Liste des villes** | seedée, **non validée sur le terrain** | La pertinence de la recherche au lancement |
| **Fournisseur SMS** | ✅ **TechSoft SMS** — documentation derrière authentification, à récupérer | L'adaptateur concret, pas le port ni le reste du développement |
| **Stockage objet** | ✅ **Cloudflare R2**, compatible S3 | Rien — l'API S3 est standard |
| **Push mobile** | ✅ **Firebase Cloud Messaging** | Rien à court terme |
| **Hébergement et déploiement** | ⚠️ jamais discuté | La mise en production, et le choix d'infrastructure qui en découle |

**Point ouvert sur TechSoft** : `app.techsoft-sms.com/developers/docs` répond
`401` sans session. Le schéma exact des requêtes — authentification, noms de
paramètres, forme des réponses, existence d'un rappel de statut de livraison —
reste à obtenir avant d'écrire l'adaptateur.

**Cela ne bloque pas.** Le port `SmsSender` est défini indépendamment, et un
pilote de journalisation permet de développer l'inscription par OTP sans
prestataire. Changer de fournisseur ou en ajouter un revient alors à écrire une
classe et à changer une ligne de configuration — c'est exactement ce
qu'exigeait [§29](BRIEF.md).

**L'abstraction déverrouille le reste.** [§29](BRIEF.md) exige que le code métier
ne dépende d'aucun fournisseur précis pour le paiement, le SMS, l'email et le
stockage. Cette règle, écrite pour la maintenabilité, sert aussi ici : on
développe contre l'abstraction avec un pilote factice, et le choix du
prestataire cesse d'être bloquant.

---

## 3. Chemin critique

L'ordre suit les dépendances réelles. [§35](BRIEF.md) dit que le MVP doit
valider le parcours **recherche → comparaison → réservation → paiement → billet
→ voyage** : c'est ce parcours qu'on construit, dans cet ordre.

### 3.1 Recherche — ✅ fait

`SearchTrips`, `SuggestAlternatives`, `AutocompletePlaces`, plus les quatre
endpoints publics du contrat.

Un enseignement à garder : `routes_served` **n'exclut pas** la destination
demandée. Le cas qui fait le plus mal n'est pas « cette destination n'existe
pas » mais « elle existe, mais pas à la date choisie » — et une recherche à
date lointaine ne remonte alors aucune date proche. Sans cette inclusion, le
passager repart les mains vides sur un axe desservi tous les jours.

### 3.2 Authentification — ✅ fait

Inscription, OTP, session Sanctum, et le port `SmsSender` avec son pilote de
journalisation — ce qui a permis de tout construire sans attendre la
documentation de TechSoft.

Deux enseignements à garder :

**Une exception levée depuis une transaction annule ce qu'elle voulait
enregistrer.** L'incrément du compteur de tentatives partait avec le
`rollback` : la limite de quatre tentatives de [§8](BRIEF.md) ne limitait rien,
et un attaquant disposait d'essais illimités sur un code à six chiffres. Toute
Action qui compte un échec doit lever **hors** de sa transaction.

**La limitation de débit protège le budget autant que le compte.** Chaque
demande de code envoie un SMS payant, et l'OTP est le seul canal sans
alternative ([I8](BRIEF.md)).

Reste à écrire : l'adaptateur TechSoft, dès que sa documentation est
accessible.

### 3.3 Réservation et tenue des places

*Dépend de* : recherche et authentification.

**Le chantier le plus délicat du projet.** Toute la mécanique de [B2](BRIEF.md)
s'y joue.

- `CreateBooking` — opération atomique de prise de places, la transaction est détenue par l'Action
- Conditions commerciales **figées** sur la réservation ([B4](BRIEF.md))
- `ReleaseExpiredHolds` — job à la minute, sans quoi l'inventaire se gèle
- La violation de contrainte unique est un **cas nominal**, pas une panne

Tests obligatoires : deux réservations concurrentes du même siège, dépassement
de capacité, expiration qui libère, échec de paiement qui **ne** libère pas.

### 3.4 Paiement

*Dépend de* : réservation. **Pas** du choix de l'agrégateur.

- Abstraction `PaymentGateway` + pilote factice pilotable en test
- `InitiatePayment`, `ConfirmPayment`
- Webhook idempotent, journal traçable ([I7](BRIEF.md))
- Cas limite : succès arrivant après expiration, place revendue → remboursement `LATE_PAYMENT` ([B5](BRIEF.md))

### 3.5 Billet et QR Code

*Dépend de* : paiement confirmé.

- Émission d'un billet **par passager**
- Signature du QR, vérifiable hors ligne contre la liste d'embarquement
- Consultable sans réseau côté client ([I5](BRIEF.md))

### 3.6 Embarquement

*Dépend de* : billets.

- `GET /v1/agency/trips/{reference}/boarding-list`
- `POST .../validations` — synchronisation groupée, **résultat par élément**, jamais du tout-ou-rien
- Détection des doublons hors ligne : signalés, pas bloqués ([B3](BRIEF.md))
- PWA : service worker, cache de la liste, file locale des validations

### 3.7 Annulation et remboursement

*Dépend de* : paiement.

- `CancelBooking`, `CancelTrip`, `RefundBooking`
- Répartition des frais, y compris le cas où ils sont **inférieurs** aux frais d'agrégateur
- Annulation agence → remboursement intégral automatique de tous les passagers
- Rejeu automatique d'un remboursement en échec, puis alerte

### 3.8 Reversements

*Dépend de* : commissions, donc paiement confirmé.

- Écritures au compte courant, sans solde stocké
- `BuildPayout` puis `ApprovePayout` — calcul automatique, **déclenchement manuel**
- Réconciliation quotidienne avec l'agrégateur
- Relevé téléchargeable

---

## 4. Sans quoi rien n'est cherchable

Le chemin critique ci-dessus est celui du passager. Mais **une agence doit
pouvoir alimenter l'inventaire**, sinon la recherche ne renvoie rien et le
produit n'existe pas.

À mener en parallèle du 3.1, pas après :

- Lot 2 du contrat d'API — back-office agence
- Gares, véhicules et plan de sièges, chauffeurs
- Itinéraires et **horaires récurrents** ([I1](BRIEF.md)) — sans génération automatique, l'agence ressaisit ses départs chaque matin et abandonne en une semaine
- `GenerateTrips` — job quotidien, horizon glissant de 30 jours
- **Vente au guichet** — moins de 30 secondes, sinon plus lente que le cahier et non utilisée ([I2](BRIEF.md))

---

## 5. Chantiers parallèles

Rien de tout cela ne bloque le chemin critique.

| Chantier | Note |
|---|---|
| Catalogues i18n des applications | i18next côté web et mobile ; `@motoboy/shared` porte déjà le vocabulaire métier |
| Écrans web | shadcn, routage par rôle — seul un écran de vérification existe |
| Navigation mobile | idem |
| Espace propriétaire | consultation seule, sans circuit financier ([I3](BRIEF.md)) |
| Administration | validation des agences, référentiel, reversements, statistiques |
| Observabilité | erreurs, files, journal des webhooks ([I7](BRIEF.md)) — décidé, pas installé |
| Job `no-show` | bascule automatique après le départ, referme la machine à états |
| Taux d'annulation par agence | ne compte que les départs portant des réservations ([I1](BRIEF.md)) |

---

## 6. Ce que « terminé » veut dire

Le MVP est prêt quand ces deux boucles tournent de bout en bout, sur des données
réelles :

**Passager** — il cherche Douala → Bafoussam, compare deux agences, choisit sa
place, paie en Mobile Money, reçoit son billet, et un agent le valide à
l'embarquement, **y compris sans réseau en gare**.

**Agence** — elle publie ses horaires récurrents, ses départs se génèrent seuls,
elle vend au guichet en moins de 30 secondes, elle voit son compte courant et
reçoit son reversement avec un relevé qui tient devant une contestation.

Tant qu'une de ces deux boucles a un trou, le MVP n'est pas lançable — même si
tous les écrans existent.

---

## 7. Hors MVP

La liste fait autorité et se trouve en [§31 du brief](BRIEF.md). Elle inclut
notamment le wallet, les applications chauffeur et agence, le suivi GPS, la
réservation par tronçon, le transfert de réservation et l'alerte de
disponibilité.

Elle est là pour être respectée quand c'est tentant.
