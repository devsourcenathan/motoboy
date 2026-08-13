# MOTOBOY — Schéma de base de données

> **Statut** — Première version complète, dérivée des décisions du [brief](BRIEF.md).
> **SGBD** — PostgreSQL. **Convention** — `snake_case`, tables au pluriel (convention Laravel).
> **Dernière mise à jour** — 13 août 2026

---

## Conventions générales

| Règle | Choix retenu |
|---|---|
| Clés primaires | `bigserial` interne, plus une **référence publique** sur les entités exposées |
| Montants | `bigint` en unités entières de devise (le XAF n'a pas de subdivision en circulation) |
| Devise | Colonne `currency` (`char(3)`) à côté de chaque montant, alimentée par le pays |
| Horodatages | `timestamptz`, stockés en UTC, affichés dans le fuseau du pays |
| Suppression | `soft delete` sur le référentiel ; **jamais** sur les entités financières, qui portent un statut |
| Portée agence | Toute table métier scopée porte `agency_id`, support du filtrage RBAC |

**Références publiques.** Les entités exposées au passager portent une référence lisible et non devinable — `MTB-7F3K2A`. Elle figure sur le billet, sert de secours à la saisie manuelle à l'embarquement ([B3](BRIEF.md)) et se dicte au téléphone. Exposer un identifiant séquentiel révélerait le volume d'affaires.

---

## Vue d'ensemble

```text
countries ── cities ── stations
                │         │
                │         └──────────────┐
                │                        │
              routes ── schedules ──── trips ──── booking_passengers
                │                        │              │
            route_stops                  │           tickets
                                         │              │
              agencies ── vehicles       │     ticket_validations
                 │     └── vehicle_seats │
                 │     ── drivers        │
                 │                       │
                 │                    bookings
                 │                       │
                 │        ┌──────────────┼──────────────┐
                 │        │              │              │
                 │    payments      commissions      refunds
                 │        │              │              │
                 │        └──────────────┼──────────────┘
                 │                       │
                 └──────────── agency_ledger_entries
                                         │
                                      payouts ── payout_lines
```

---

# Identity

## `users`

Le passager s'inscrit par téléphone et email, le téléphone étant vérifié par OTP ([§8](BRIEF.md)). Un passager de **vente au guichet n'a pas de compte** ([I2](BRIEF.md)) : ses coordonnées vivent sur la réservation.

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `phone` | varchar(20) | **unique**, format E.164 |
| `email` | varchar(255) | unique, nullable |
| `password` | varchar(255) | nullable — un passager peut n'utiliser que l'OTP |
| `first_name` | varchar(100) | |
| `last_name` | varchar(100) | |
| `phone_verified_at` | timestamptz | nullable |
| `email_verified_at` | timestamptz | nullable |
| `locale` | varchar(2) | `fr` ou `en`, défaut `fr` — détermine la langue des SMS et notifications ([I10](BRIEF.md)) |
| `is_active` | boolean | défaut `true` |
| `last_login_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

## `otp_codes`

Règles de [§8](BRIEF.md) : validité 10 minutes, 4 tentatives maximum.

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `phone` | varchar(20) | index |
| `code_hash` | varchar(255) | le code n'est jamais stocké en clair |
| `purpose` | varchar(30) | `REGISTRATION`, `LOGIN`, `PHONE_CHANGE` |
| `expires_at` | timestamptz | création + 10 min |
| `attempts` | smallint | défaut 0, **maximum 4** |
| `consumed_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

**Index** — `(phone, purpose, expires_at)` pour retrouver le code actif.

## `roles`, `permissions`, `permission_role`, `role_user`

RBAC de [§9](BRIEF.md). Les permissions sont **indépendantes des rôles**, ce qui permet de faire évoluer un rôle sans toucher au code.

`roles` — `id`, `name` (unique), `label`, `is_system`
`permissions` — `id`, `name` (unique), `label`, `group`
`permission_role` — `permission_id`, `role_id`, PK composite

`role_user` — `user_id`, `role_id`, **`agency_id`** (nullable), PK composite sur les trois

> La portée `agency_id` est indispensable : un utilisateur porte le rôle `AGENT` **pour une agence donnée**. Sans elle, un agent d'embarquement validerait les billets de toutes les agences de la plateforme.

**Rôles amorcés** — `PASSENGER`, `AGENCY`, `AGENT`, `OWNER`, `ADMIN`, `SUPER_ADMIN`.

**Partage ADMIN / SUPER_ADMIN** ([I4](BRIEF.md)) : `ADMIN` couvre l'exploitation quotidienne, `SUPER_ADMIN` y ajoute la gestion des comptes administrateurs, la configuration de la plateforme et l'accès à l'AuditLog.

## `personal_access_tokens`

Table standard Laravel Sanctum ([§7](BRIEF.md)).

---

# Places

Référentiel géographique de [B1](BRIEF.md). **Les villes forment une liste fermée curée par MOTOBOY ; les gares sont créées par les agences.**

## `countries`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `code` | char(2) | **unique**, ISO 3166-1 — `CM` |
| `name` | varchar(100) | |
| `currency` | char(3) | `XAF` |
| `phone_prefix` | varchar(5) | `+237` |
| `timezone` | varchar(50) | `Africa/Douala` |
| `is_active` | boolean | défaut `true` |

## `cities`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `country_id` | bigint | FK |
| `name` | varchar(120) | |
| `slug` | varchar(120) | **unique par pays** |
| `is_active` | boolean | défaut `true` |
| `created_at` / `updated_at` | timestamptz | |

**Contrainte** — `unique (country_id, slug)`.

## `city_aliases`

Sans alias ni normalisation, l'autocomplétion échoue sur une grande part des saisies réelles : les accents ne sont pratiquement jamais saisis sur un clavier de téléphone ([B1](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `city_id` | bigint | FK |
| `alias` | varchar(120) | forme telle que saisie — `Yde` |
| `normalized` | varchar(120) | minuscules, accents retirés — clé de comparaison |

**Index** — `(normalized)`, utilisé par l'autocomplétion.

> Le `name` et le `slug` de `cities` sont eux aussi normalisés dans cet index de recherche, afin qu'une ville sans alias reste trouvable sans accent.

## `stations`

Une gare **appartient à une agence** ([B1](BRIEF.md)). Deux agences installées au même endroit produisent deux gares distinctes — conforme à la réalité perçue par le passager.

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `city_id` | bigint | FK |
| `name` | varchar(150) | |
| `address` | text | nullable |
| `latitude` | numeric(10,7) | nullable — stocké dès le MVP, exploité plus tard |
| `longitude` | numeric(10,7) | nullable |
| `is_active` | boolean | défaut `true` |
| `moderated_at` | timestamptz | nullable — modération **a posteriori**, jamais bloquante |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

## `city_requests`

Une agence desservant une ville absente doit pouvoir en demander l'ajout, sinon elle est bloquée sans recours et abandonne ([B1](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `country_id` | bigint | FK |
| `requested_name` | varchar(120) | |
| `status` | varchar(20) | `PENDING`, `APPROVED`, `REJECTED` |
| `resolved_city_id` | bigint | FK nullable — renseigné si approuvée |
| `reviewed_by` | bigint | FK `users`, nullable |
| `reviewed_at` | timestamptz | nullable |

---

# Agencies

## `agencies`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique**, référence publique |
| `name` | varchar(150) | nom commercial |
| `legal_name` | varchar(200) | nullable |
| `phone` | varchar(20) | |
| `email` | varchar(255) | nullable |
| `logo_path` | varchar(255) | nullable — stockage S3 |
| `default_locale` | varchar(2) | `fr` ou `en`, défaut `fr` — langue des messages envoyés à un passager **sans compte**, en vente au guichet ([I10](BRIEF.md)) |
| `status` | varchar(20) | `PENDING`, `APPROVED`, `SUSPENDED`, `REJECTED` |
| `approved_by` | bigint | FK `users`, nullable |
| `approved_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

## `agency_documents`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `type` | varchar(50) | registre de commerce, licence de transport, assurance… |
| `file_path` | varchar(255) | stockage S3 |
| `status` | varchar(20) | `PENDING`, `APPROVED`, `REJECTED` |
| `expires_at` | date | nullable |

## `agency_commercial_terms`

Contrat commercial de l'agence ([B4](BRIEF.md)). **Défini par l'administration, consultable par l'agence, jamais modifiable en libre-service** — ce sont des termes négociés.

| Colonne | Type | Défaut | Bornes |
|---|---|---|---|
| `agency_id` | bigint | FK **unique** | |
| `commission_type` | varchar(15) | `PERCENTAGE` | `PERCENTAGE`, `FIXED` |
| `commission_value` | bigint | à fixer | pourcentage en points de base, ou montant |
| `fee_bearer` | varchar(15) | `PLATFORM` | `PLATFORM`, `AGENCY` — **jamais le passager** |
| `payout_delay_hours` | smallint | `24` | 0 à 168 |
| `payout_frequency` | varchar(15) | `WEEKLY` | `WEEKLY`, `MONTHLY` |
| `payout_day` | smallint | `1` (lundi) | |
| `payout_minimum_amount` | bigint | à fixer | ≥ 10× le coût d'un décaissement |
| `counter_sale_commission_enabled` | boolean | `false` | |
| `counter_sale_sms_enabled` | boolean | `true` | |
| `cancellation_deadline_hours` | smallint | `2` | 0 à 48 |
| `cancellation_fee_type` | varchar(15) | `PERCENTAGE` | |
| `cancellation_fee_value` | bigint | à fixer | 0 à 50 % du montant payé |
| `hold_duration_minutes` | smallint | `10` | |
| `online_sales_cutoff_minutes` | smallint | `30` | |

**Une seule ligne par agence.** L'historique des modifications est porté par `audit_logs` — la correction des calculs passés est assurée par le figement sur la réservation, pas par un versionnement de cette table.

**Bornes fermées volontairement** : le reversement avant le départ est exclu (créance irrécupérable), le passager ne peut jamais porter les frais d'agrégateur (le prix affiché divergerait du prix guichet), et une cadence plus rapide que le défaut fait porter les frais de décaissement à l'agence qui la demande.

## `agency_payout_accounts`

Une erreur de saisie envoie l'argent à un inconnu, sans recours. **Le changement de coordonnées est un vecteur de fraude classique** — compromission du compte, modification du numéro, attente du jour de paie ([B4](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `type` | varchar(20) | `MOBILE_MONEY`, `BANK` |
| `operator` | varchar(20) | nullable — `MTN`, `ORANGE` |
| `account_number` | varchar(50) | |
| `account_name` | varchar(150) | |
| `verified_by` | bigint | FK `users`, nullable |
| `verified_at` | timestamptz | nullable — **obligatoire avant tout décaissement** |
| `is_active` | boolean | défaut `false` jusqu'à vérification |
| `created_at` / `updated_at` | timestamptz | |

**Règles applicatives** : toute création ou modification est validée par l'administration, journalisée dans `audit_logs` avec ancienne et nouvelle valeur, et notifiée aux contacts connus de l'agence.

---

# Fleet

## `vehicles`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `owner_user_id` | bigint | FK `users`, nullable — rattachement par téléphone ([I3](BRIEF.md)) |
| `owner_revenue_visible` | boolean | défaut `false` — le revenu est une donnée commerciale de l'agence |
| `registration` | varchar(20) | immatriculation, **unique par agence** |
| `brand` / `model` | varchar(80) | |
| `type` | varchar(20) | `BUS`, `CAR` — extensible ([§2](BRIEF.md)) |
| `seating_mode` | varchar(15) | **`SEATED`** ou **`CAPACITY`** ([§13](BRIEF.md)) |
| `capacity` | smallint | |
| `condition` | varchar(20) | `ACTIVE`, `MAINTENANCE`, `RETIRED` |
| `photo_path` | varchar(255) | nullable |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

## `vehicle_seats`

Uniquement pour `seating_mode = SEATED`.

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `vehicle_id` | bigint | FK |
| `label` | varchar(6) | `A1`, `A2`… |
| `row_index` / `column_index` | smallint | position dans le plan |
| `is_bookable` | boolean | défaut `true` — exclut le siège chauffeur ou un strapontin |

**Contrainte** — `unique (vehicle_id, label)`.

## `vehicle_documents`

`id`, `vehicle_id`, `type` (carte grise, assurance, visite technique), `file_path`, `expires_at`, horodatages.

## `drivers`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `first_name` / `last_name` | varchar(100) | |
| `phone` | varchar(20) | |
| `license_number` | varchar(50) | |
| `license_expires_at` | date | nullable |
| `assigned_vehicle_id` | bigint | FK nullable |
| `status` | varchar(20) | `ACTIVE`, `INACTIVE` |
| `deleted_at` | timestamptz | soft delete |

> Le chauffeur reste un acteur métier sans application dédiée ([§3](BRIEF.md)). Il peut en revanche porter le rôle `AGENT` pour l'embarquement — le rôle est fonctionnel, pas lié à un métier ([B3](BRIEF.md)).

---

# Routes

## `routes`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `origin_city_id` | bigint | FK `cities` |
| `destination_city_id` | bigint | FK `cities` |
| `origin_station_id` | bigint | FK `stations` |
| `destination_station_id` | bigint | FK `stations` |
| `reference_duration_minutes` | smallint | nullable |
| `is_active` | boolean | défaut `true` |
| `deleted_at` | timestamptz | soft delete |

**Vocabulaire** — une `route` n'est **jamais datée**, un `trip` l'est toujours ([annexe A du brief](BRIEF.md)).

Les gares sont portées par la route et surchargeables sur le départ : une agence part de sa gare habituelle, l'exception reste une exception, et ce rattachement évite de réinscrire la gare sur chaque départ généré.

## `route_stops`

Escales, **purement informatives** — la réservation est point-à-point uniquement ([B6](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `route_id` | bigint | FK |
| `city_id` | bigint | FK |
| `position` | smallint | ordre sur le parcours |

**Contrainte** — `unique (route_id, position)`.

> Aucune occupation par segment, aucun calcul de disponibilité par tronçon, aucune grille tarifaire par segment. Une ville d'escale **ne rend pas un trajet éligible** aux résultats de recherche.

## `schedules`

Le niveau qui porte les horaires ([I1](BRIEF.md)). Distinct de la route parce qu'une même liaison porte souvent plusieurs départs de nature différente — un VIP à 08:00 et un classique à 14:00 n'ont ni le même véhicule ni le même tarif.

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `route_id` | bigint | FK |
| `departure_time` | time | heure locale de départ |
| `days_of_week` | smallint[] | ou masque de bits — 1 = lundi |
| `default_vehicle_id` | bigint | FK nullable |
| `default_driver_id` | bigint | FK nullable |
| `price` | bigint | tarif par défaut |
| `currency` | char(3) | |
| `valid_from` / `valid_until` | date | période de validité, `valid_until` nullable |
| `is_active` | boolean | défaut `true` |
| `deleted_at` | timestamptz | soft delete |

---

# Trips

## `trips`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique**, référence publique |
| `agency_id` | bigint | FK |
| `route_id` | bigint | FK |
| `schedule_id` | bigint | FK nullable — `null` si créé manuellement |
| `origin_city_id` | bigint | **dénormalisé** depuis la route |
| `destination_city_id` | bigint | **dénormalisé** depuis la route |
| `origin_station_id` | bigint | FK — surcharge possible du défaut de la route |
| `destination_station_id` | bigint | FK |
| `departure_at` | timestamptz | |
| `arrival_estimate_at` | timestamptz | nullable |
| `online_sales_close_at` | timestamptz | `departure_at` − `online_sales_cutoff_minutes` |
| `vehicle_id` | bigint | FK |
| `driver_id` | bigint | FK nullable |
| `price` | bigint | figé à la génération |
| `currency` | char(3) | |
| `seating_mode` | varchar(15) | recopié du véhicule |
| `capacity` | smallint | recopiée du véhicule |
| `seats_taken` | smallint | défaut 0 — **compteur utilisé en mode `CAPACITY`** |
| `status` | varchar(20) | `SCHEDULED`, `DEPARTED`, `CANCELLED` |
| `cancelled_by` | bigint | FK `users`, nullable |
| `cancelled_at` | timestamptz | nullable |
| `cancellation_reason` | varchar(30) | `BREAKDOWN`, `INSUFFICIENT_PASSENGERS`, `ROAD_CLOSED`, `OTHER` |
| `had_confirmed_bookings_at_cancellation` | boolean | défaut `false` — voir plus bas |
| `created_at` / `updated_at` | timestamptz | |

**Contraintes et index**

| | |
|---|---|
| `check (seats_taken >= 0 and seats_taken <= capacity)` | Garde-fou du mode `CAPACITY` — la base refuse la surréservation même si la logique applicative se trompe |
| `unique (schedule_id, departure_at)` | Empêche la génération de produire deux fois le même départ |
| `index (origin_city_id, destination_city_id, departure_at, status)` | **Index de recherche** — la requête centrale du produit |
| `index (agency_id, departure_at)` | Tableau de bord agence |
| `index (status, departure_at)` | Job de passage en `DEPARTED` et en `NO_SHOW` |

**Dénormalisation des villes** — la recherche filtre sur le couple de villes et s'exécute à chaque appel ; copier les colonnes à la génération évite une jointure sur `routes` à chaque fois.

**`had_confirmed_bookings_at_cancellation`** — le taux d'annulation d'une agence ne compte que les annulations de départs **portant des réservations confirmées** ([I1](BRIEF.md)). Supprimer un départ généré non assuré — jour férié, basse saison — relève de la gestion de planning, pas de l'incident. Le drapeau est figé au moment de l'annulation, car les réservations sont ensuite annulées et l'information serait perdue.

**Règles de génération** ([I1](BRIEF.md)) : horizon glissant de 30 jours, job quotidien, la génération **ne modifie jamais un départ existant** et modifier un `schedule` n'affecte que les départs créés ensuite.

**Changement de véhicule sur un départ réservé** : vers une capacité supérieure ou égale, libre ; vers une capacité inférieure, bloqué tant que les réservations excédentaires n'ont pas été traitées.

---

# Bookings

## `bookings`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique**, référence publique — `MTB-7F3K2A` |
| `trip_id` | bigint | FK |
| `agency_id` | bigint | FK, dénormalisé pour le filtrage RBAC |
| `user_id` | bigint | FK nullable — **`null` pour une vente au guichet** |
| `channel` | varchar(15) | `ONLINE`, `COUNTER` |
| `created_by` | bigint | FK `users`, nullable — l'agent, en vente guichet |
| `status` | varchar(30) | voir machine à états ci-dessous |
| `expires_at` | timestamptz | nullable — échéance du hold |
| `seats_count` | smallint | |
| `total_amount` | bigint | |
| `currency` | char(3) | |
| `contact_name` | varchar(150) | réservation pour un tiers, ou vente guichet |
| `contact_phone` | varchar(20) | |
| `confirmed_at` | timestamptz | nullable |
| `cancelled_at` | timestamptz | nullable |
| `cancelled_by` | bigint | FK `users`, nullable |
| `cancellation_reason` | varchar(30) | nullable |
| `created_at` / `updated_at` | timestamptz | |

### Conditions figées à la création

Recopiées depuis `agency_commercial_terms` **au moment de la création de la réservation** ([B4](BRIEF.md), [B5](BRIEF.md)).

| Colonne | Type |
|---|---|
| `commission_type` | varchar(15) |
| `commission_value` | bigint |
| `fee_bearer` | varchar(15) |
| `cancellation_deadline_hours` | smallint |
| `cancellation_fee_type` | varchar(15) |
| `cancellation_fee_value` | bigint |

> **Règle impérative.** Aucun calcul financier ne doit lire les paramètres courants de l'agence. Sans ce figement, modifier un taux de commission réécrit rétroactivement l'historique de toutes les réservations passées, y compris celles déjà reversées et déjà justifiées à l'agence par un relevé.
>
> Colonnes explicites plutôt qu'un instantané JSON : les reversements et les statistiques agrègent et filtrent sur ces valeurs, ce qui est impraticable en JSON.

### Machine à états

```text
PENDING_PAYMENT   places tenues, expires_at = validation des places + 10 min
      ├── paiement confirmé ─────→ CONFIRMED
      ├── annulation explicite ──→ CANCELLED_BY_PASSENGER   (places libérées)
      └── expiration ────────────→ EXPIRED                  (places libérées)

CONFIRMED
      ├── annulation passager ───→ CANCELLED_BY_PASSENGER
      ├── annulation agence ─────→ CANCELLED_BY_AGENCY
      ├── embarquement ──────────→ USED
      └── départ sans embarquement ──→ NO_SHOW
```

**Il n'existe pas d'état `FAILED`.** L'échec appartient à la tentative de paiement, pas à la réservation : avec Mobile Money, l'échec est banal, et un passager qui recompose correctement son code doit retrouver son siège ([B2](BRIEF.md)).

**Vente au guichet** — la réservation est créée directement en `CONFIRMED`, sans hold ni tunnel de paiement : l'argent est déjà encaissé ([I2](BRIEF.md)).

**Index** — `(status, expires_at)` pour le job de libération, `(trip_id, status)` pour le calcul de disponibilité, `(user_id, created_at)` pour l'historique.

## `booking_passengers`

Un passager, un siège, un billet. Le grain du passager est nécessaire à l'**annulation partielle** — trois places réservées, une annulée ([B5](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `booking_id` | bigint | FK |
| `trip_id` | bigint | **dénormalisé** — nécessaire à l'index unique partiel |
| `seat_id` | bigint | FK `vehicle_seats`, nullable en mode `CAPACITY` |
| `holds_seat` | boolean | **maintenu dans la même transaction que le statut de la réservation** |
| `first_name` / `last_name` | varchar(100) | |
| `phone` | varchar(20) | nullable |
| `status` | varchar(20) | `ACTIVE`, `CANCELLED` |
| `created_at` / `updated_at` | timestamptz | |

### L'index qui empêche la double-vente

```sql
create unique index booking_passengers_seat_unique
    on booking_passengers (trip_id, seat_id)
    where holds_seat = true;
```

C'est la pièce maîtresse de [B2](BRIEF.md), et elle remplace le verrou explicite en mode `SEATED` : **l'index unique _est_ la sérialisation**. Deux réservations concurrentes du même siège entrent en conflit au niveau de l'index — l'une passe, l'autre échoue proprement et l'application traite la violation.

Ce choix évite aussi de matérialiser une ligne par siège et par départ : sur 30 jours d'horizon, un car de 70 places à 6 départs quotidiens produirait 12 600 lignes par liaison et par mois, dont la quasi-totalité ne serait jamais vendue.

**En mode `CAPACITY`**, `seat_id` est `null` et la protection repose sur le verrou de ligne du départ plus la contrainte `seats_taken <= capacity`. Le modèle est asymétrique selon le type de véhicule — c'est assumé, chaque cas utilise le mécanisme qui lui convient.

**Invariant** — `holds_seat = true` si et seulement si la réservation est en `PENDING_PAYMENT` ou `CONFIRMED` **et** le passager est `ACTIVE`. Toute transition de statut le met à jour dans la même transaction.

**Latence acceptée** — un hold expiré reste bloquant tant que le job ne l'a pas traité, PostgreSQL ne pouvant pas inclure `now()` dans le prédicat d'un index partiel. Job **toutes les minutes**, donc jusqu'à une minute d'indisponibilité fantôme. La contourner exigerait de transitionner les holds expirés à la volée lors d'un conflit — nettement plus complexe pour une minute.

---

# Tickets

## `tickets`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique**, figure sur le billet et sert à la saisie manuelle |
| `booking_id` | bigint | FK |
| `booking_passenger_id` | bigint | FK **unique** — un billet par passager |
| `trip_id` | bigint | dénormalisé, pour la liste d'embarquement |
| `qr_signature` | varchar(255) | signature du contenu, vérifiable côté serveur |
| `status` | varchar(20) | `VALID`, `USED`, `CANCELLED` |
| `issued_at` | timestamptz | |

Le QR Code est **regénéré localement à partir des données stockées**, jamais téléchargé comme image : un billet dont le QR ne s'affiche pas en gare ne vaut rien ([I5](BRIEF.md)).

## `ticket_validations`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `ticket_id` | bigint | FK |
| `trip_id` | bigint | dénormalisé |
| `validated_by` | bigint | FK `users` — porteur du rôle `AGENT` |
| `validated_at` | timestamptz | horodatage **local à l'appareil**, l'agent pouvant être hors ligne |
| `method` | varchar(10) | `SCAN`, `MANUAL` |
| `device_id` | varchar(100) | nullable — identifie l'appareil ayant validé |
| `synced_at` | timestamptz | nullable — `null` tant que la validation est en file locale |
| `is_duplicate` | boolean | défaut `false` — positionné à la synchronisation |

**La double validation hors ligne est un coût explicitement accepté** ([B3](BRIEF.md)). Deux agents disposant de la liste d'embarquement peuvent valider le même billet ; le serveur détecte le doublon à la synchronisation et le signale. C'est une anomalie à remonter, non une fraude à bloquer — les deux agents relèvent de la même agence.

> Aucune contrainte d'unicité sur `ticket_id` : elle rejetterait le doublon au lieu de le tracer, et l'on perdrait l'information qui permet de le diagnostiquer.

---

# Payments

## `payments`

**Une réservation porte plusieurs tentatives**, dont une seule aboutie ([B2](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique** |
| `booking_id` | bigint | FK |
| `amount` | bigint | |
| `currency` | char(3) | |
| `method` | varchar(20) | `MOBILE_MONEY`, `CARD`, **`CASH`** |
| `operator` | varchar(20) | nullable — `MTN`, `ORANGE` |
| `provider` | varchar(50) | nullable — `null` pour `CASH` |
| `provider_reference` | varchar(100) | nullable, identifiant unique de transaction |
| `idempotency_key` | varchar(100) | **unique** |
| `status` | varchar(20) | `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED` |
| `failure_reason` | varchar(100) | nullable |
| `aggregator_fee_amount` | bigint | défaut 0 — frais réels de collecte |
| `paid_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | |

**Contrainte anti-double-paiement**

```sql
create unique index payments_one_success_per_booking
    on payments (booking_id)
    where status = 'SUCCEEDED';
```

Les ventes au guichet sont enregistrées avec la méthode `CASH` : elles ne transitent pas par l'agrégateur mais alimentent statistiques et compte courant ([I2](BRIEF.md)).

## `payment_webhooks`

Journal traçable exigé par [I7](BRIEF.md). Sans lui, un paiement perdu est indébogable.

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `provider` | varchar(50) | |
| `event_id` | varchar(150) | **`unique (provider, event_id)`** — l'idempotence du rejeu |
| `payload` | jsonb | brut, tel que reçu |
| `signature_valid` | boolean | |
| `received_at` | timestamptz | |
| `processed_at` | timestamptz | nullable |
| `status` | varchar(20) | `RECEIVED`, `PROCESSED`, `REPLAYED`, `FAILED` |
| `error` | text | nullable |

> Ce journal complète la réconciliation quotidienne de [B4](BRIEF.md) : la réconciliation détecte l'écart, le journal explique son origine.

## `refunds`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique** |
| `booking_id` | bigint | FK |
| `payment_id` | bigint | FK — le paiement d'origine |
| `booking_passenger_id` | bigint | FK nullable — renseigné si **remboursement partiel** |
| `amount` | bigint | |
| `currency` | char(3) | |
| `reason` | varchar(30) | `PASSENGER_REQUEST`, `AGENCY_TRIP_CANCELLED`, `TRIP_MODIFIED`, `LATE_PAYMENT`, `DUPLICATE_PAYMENT`, `ADMIN_ADJUSTMENT` |
| `initiated_by` | bigint | FK `users`, nullable — `null` si automatique |
| `provider_reference` | varchar(100) | nullable |
| `idempotency_key` | varchar(100) | **unique** |
| `status` | varchar(20) | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `retry_count` | smallint | défaut 0 |
| `completed_at` | timestamptz | nullable |

**Le remboursement part toujours vers le compte source**, jamais vers un numéro déclaré après coup. Dans le cas contraire, le circuit « je réserve, j'annule, je me fais rembourser sur un autre numéro » devient un vecteur de fraude immédiat ([B5](BRIEF.md)).

**Un remboursement en `FAILED` place le passager dans le pire état possible** — sans argent et sans billet. Il est rejoué automatiquement, puis remonté en alerte à l'administration s'il échoue à nouveau. Jamais laissé silencieux.

**Index** — `(status, retry_count)` pour le job de rejeu.

---

# Commissions

## `commissions`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `booking_id` | bigint | FK **unique** |
| `agency_id` | bigint | FK |
| `base_amount` | bigint | assiette |
| `type` / `value` | varchar(15) / bigint | recopiés depuis la réservation |
| `amount` | bigint | commission calculée |
| `aggregator_fee_amount` | bigint | frais réels supportés |
| `status` | varchar(20) | `ACCRUED`, `REVERSED` |
| `reversed_at` | timestamptz | nullable |

**La commission n'est pas prélevée sur une réservation annulée** ([B5](BRIEF.md)). Sur une annulation passager, MOTOBOY récupère uniquement ses frais réels d'agrégateur sur les frais d'annulation retenus ; le solde revient à l'agence, qui subit la perte réelle du siège.

Si les frais d'annulation retenus sont **inférieurs** aux frais réels d'agrégateur, MOTOBOY absorbe la différence — sans quoi le calcul produirait un montant négatif à réclamer à l'agence pour quelques dizaines de francs.

---

# Payouts

## `agency_ledger_entries`

Le suivi financier repose sur un **compte courant** plutôt que sur un calcul par période : il absorbe naturellement les soldes négatifs, les régularisations tardives et les corrections manuelles ([B4](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `agency_id` | bigint | FK |
| `type` | varchar(30) | `BOOKING_CREDIT`, `COMMISSION_DEBIT`, `REFUND_DEBIT`, `COUNTER_COMMISSION_DEBIT`, `ADJUSTMENT`, `PAYOUT_DEBIT` |
| `amount` | bigint | **signé** — positif au crédit, négatif au débit |
| `currency` | char(3) | |
| `reference_type` | varchar(50) | polymorphe — `booking`, `refund`, `payout`… |
| `reference_id` | bigint | |
| `description` | varchar(255) | **obligatoire sur `ADJUSTMENT`** |
| `created_by` | bigint | FK `users`, nullable |
| `occurred_at` | timestamptz | date d'effet, distincte de la date d'écriture |
| `created_at` | timestamptz | |

**Aucun solde stocké.** Le solde se calcule par somme. Un solde dénormalisé finit toujours par diverger de ses écritures, et sur un compte qui détermine combien l'on verse à une agence, la divergence se découvre lors d'une réclamation.

**Écritures immuables** — une erreur se corrige par une écriture inverse, jamais par une modification.

**Index** — `(agency_id, occurred_at)`.

## `payouts`

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `reference` | varchar(20) | **unique** |
| `agency_id` | bigint | FK |
| `period_start` / `period_end` | date | |
| `gross_amount` | bigint | |
| `commission_amount` | bigint | |
| `refund_amount` | bigint | |
| `adjustment_amount` | bigint | |
| `net_amount` | bigint | montant effectivement versé |
| `currency` | char(3) | |
| `payout_account_id` | bigint | FK `agency_payout_accounts` |
| `status` | varchar(25) | voir cycle ci-dessous |
| `approved_by` | bigint | FK `users`, nullable |
| `approved_at` | timestamptz | nullable |
| `provider_reference` | varchar(100) | nullable |
| `paid_at` | timestamptz | nullable |
| `failure_reason` | varchar(255) | nullable |

```text
DRAFT               calcul automatique du solde éligible
   ↓
PENDING_VALIDATION  proposition soumise à l'administration
   ↓
APPROVED            validée par un administrateur (tracé dans audit_logs)
   ↓
PROCESSING          décaissement envoyé à l'agrégateur
   ↓
PAID | FAILED
```

**Le calcul est automatique, le déclenchement est manuel.** Les premiers mois produiront des cas non anticipés — remboursement arrivé en retard, réservation contestée, coordonnées erronées. Un décaissement Mobile Money du mauvais montant est quasi irréversible : la validation humaine reste le garde-fou tant que le volume ne la rend pas impraticable.

Une réservation devient éligible lorsque son trajet est **parti** et que le délai configuré est écoulé.

## `payout_lines`

`id`, `payout_id`, `booking_id`, `gross_amount`, `commission_amount`, `refund_amount`, `net_amount`.

C'est le détail du relevé téléchargeable par l'agence — le document qui évite les litiges répétés sur les montants.

---

# Notifications

## `notifications`

Répartition des canaux arbitrée par le coût du SMS ([I8](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `user_id` | bigint | FK nullable — `null` pour un passager de vente guichet |
| `phone` | varchar(20) | nullable — destinataire sans compte |
| `channel` | varchar(10) | `PUSH`, `SMS`, `EMAIL` |
| `locale` | varchar(2) | langue effectivement utilisée — tracée, car la résolution dépend du destinataire ([I10](BRIEF.md)) |
| `type` | varchar(50) | `BOOKING_CONFIRMED`, `PAYMENT_CONFIRMED`, `DEPARTURE_REMINDER`, `TRIP_CANCELLED`, `TRIP_MODIFIED`, `COUNTER_TICKET` |
| `payload` | jsonb | |
| `status` | varchar(20) | `QUEUED`, `SENT`, `FAILED` |
| `provider_reference` | varchar(100) | nullable |
| `sent_at` | timestamptz | nullable |
| `error` | text | nullable |

| Événement | Canal |
|---|---|
| OTP d'inscription | SMS — aucune alternative |
| Annulation par l'agence | SMS — systématique |
| Confirmation de réservation | Push si disponible, SMS en repli |
| Rappel de départ | Push uniquement |
| Billet de vente au guichet | SMS, désactivable par agence |

## `device_tokens`

`id`, `user_id`, `token` (unique), `platform` (`ANDROID`, `IOS`), `is_active`, horodatages.

---

# Administration

## `audit_logs`

Journalisation des opérations sensibles ([§28](BRIEF.md)).

| Colonne | Type | Contraintes et notes |
|---|---|---|
| `id` | bigserial | PK |
| `user_id` | bigint | FK nullable — `null` pour une action système |
| `action` | varchar(50) | `created`, `updated`, `cancelled`, `validated`, `refunded`, `approved` |
| `auditable_type` | varchar(100) | polymorphe |
| `auditable_id` | bigint | |
| `old_values` | jsonb | nullable |
| `new_values` | jsonb | nullable |
| `ip_address` | inet | nullable |
| `user_agent` | varchar(255) | nullable |
| `created_at` | timestamptz | |

**Index** — `(auditable_type, auditable_id, created_at)`, `(user_id, created_at)`.

**Opérations à journaliser impérativement** : création et modification d'un trajet, modification d'un prix, annulation d'une réservation, validation d'un billet, remboursement, approbation d'un reversement, **modification des coordonnées de reversement**, modification des conditions commerciales, validation d'une agence.

---

# Récapitulatif des garde-fous en base

Ces contraintes rattrapent une erreur applicative en refusant l'écriture, plutôt qu'en produisant une donnée fausse.

| Garde-fou | Table | Ce qu'il empêche |
|---|---|---|
| `unique (trip_id, seat_id) where holds_seat` | `booking_passengers` | Deux passagers sur le même siège |
| `check (seats_taken <= capacity)` | `trips` | La surréservation en mode `CAPACITY` |
| `unique (booking_id) where status = 'SUCCEEDED'` | `payments` | Le double paiement d'une même réservation |
| `unique (idempotency_key)` | `payments`, `refunds` | Le doublon lors d'un rejeu |
| `unique (provider, event_id)` | `payment_webhooks` | Le retraitement d'un webhook déjà reçu |
| `unique (schedule_id, departure_at)` | `trips` | La génération en double d'un même départ |
| `unique (vehicle_id, label)` | `vehicle_seats` | Deux sièges de même libellé |
| `unique (booking_passenger_id)` | `tickets` | Deux billets pour un même passager |

> Sur un produit où la double-vente se traduit par un passager debout devant un car complet, ces quelques lignes de DDL valent largement leur coût.

---

# Points ouverts

Deux sujets restent externes à ce document, signalés en [B4](BRIEF.md) :

1. **Le cadre réglementaire** de la détention de fonds de tiers en zone CEMAC. Une réponse défavorable remettrait en cause le modèle d'encaissement centralisé, donc les tables `agency_ledger_entries`, `payouts` et `payout_lines`.
2. **Le choix de l'agrégateur de paiement**, qui déterminera le contenu réel de `provider_reference` et la faisabilité des remboursements et décaissements par API.
