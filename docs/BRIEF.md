# MOTOBOY — Brief Projet MVP

> **Statut du document** — Partie I consolidée et validée. **Parties II et III closes : les 6 points bloquants et les 10 points importants sont tranchés.** Ne restent ouverts que deux sujets externes signalés en [B4](#b4--flux-financier-et-reversement-aux-agences) : le cadre réglementaire de la détention de fonds de tiers, et le choix de l'agrégateur de paiement.
> **Dernière mise à jour** — 13 août 2026

---

## Sommaire

**Partie I — Brief validé**

1. [Vision](#1-vision) · 2. [Marché cible](#2-marché-cible) · 3. [Utilisateurs](#3-utilisateurs) · 4. [Applications](#4-applications) · 5. [Backend](#5-backend) · 6. [Architecture générale](#6-architecture-générale) · 7. [Stack technique](#7-stack-technique) · 8. [Authentification](#8-authentification) · 9. [Rôles et permissions](#9-système-de-rôles-et-permissions) · 10. [Expérience Passager](#10-expérience-passager) · 11. [Recherche](#11-recherche) · 12. [Gestion des trajets](#12-gestion-des-trajets) · 13. [Gestion des véhicules](#13-gestion-des-véhicules) · 14. [Gestion des chauffeurs](#14-gestion-des-chauffeurs) · 15. [Réservation](#15-réservation) · 16. [Disponibilité des places](#16-disponibilité-des-places) · 17. [Paiement](#17-paiement) · 18. [Wallet](#18-wallet) · 19. [Billet électronique](#19-billet-électronique) · 20. [QR Code](#20-qr-code) · 21. [Recherche d'alternatives](#21-recherche-dalternatives) · 22. [Interface Agence](#22-interface-agence) · 23. [Interface Administration](#23-interface-administration) · 24. [Notifications](#24-notifications) · 25. [Historique](#25-historique) · 26. [Commission](#26-commission) · 27. [Sécurité](#27-sécurité) · 28. [Audit](#28-audit) · 29. [Principes techniques](#29-principes-techniques) · 30. [Structure logique des données](#30-structure-logique-des-données) · 31. [Hors MVP](#31-fonctionnalités-hors-mvp) · 32. [MVP final](#32-mvp-final) · 33. [Architecture MVP finale](#33-architecture-mvp-finale) · 34. [Stack finale](#34-stack-finale) · 35. [Principe directeur](#35-principe-directeur) · 36. [Résumé](#36-résumé)

**Partie II — [Points bloquants à trancher](#partie-ii--points-bloquants-à-trancher)**

B1. [Référentiel géographique](#b1--référentiel-géographique) ✅ · B2. [Réservation temporaire des places](#b2--réservation-temporaire-des-places-pendant-le-paiement) ✅ · B3. [Validation du billet à l'embarquement](#b3--validation-du-billet-à-lembarquement) ✅ · B4. [Flux financier et reversement](#b4--flux-financier-et-reversement-aux-agences) ✅ · B5. [Annulation et remboursement](#b5--annulation-et-remboursement) ✅ · B6. [Escales et réservation par tronçon](#b6--escales-et-réservation-par-tronçon) ✅

**Partie III — [Points importants](#partie-iii--points-importants)**

**Annexes** — [Vocabulaire](#annexe-a--vocabulaire) · [Incohérences relevées](#annexe-b--incohérences-internes-relevées)

---
---

# Partie I — Brief validé

## 1. Vision

**MOTOBOY** est une plateforme de mobilité destinée au marché camerounais.

Son objectif principal est de centraliser les offres de transport disponibles entre un point de départ et une destination, afin de permettre à l'utilisateur de :

- rechercher un trajet ;
- comparer les solutions disponibles ;
- choisir un trajet ;
- réserver ;
- payer ;
- obtenir un billet électronique.

La plateforme ne doit donc pas être pensée comme une simple application de vente de billets.

Sa valeur principale est :

> **Permettre à un passager de trouver facilement la meilleure solution de transport disponible pour son trajet.**

Lorsqu'une solution est complète, MOTOBOY doit pouvoir proposer des alternatives provenant d'autres départs, agences, transporteurs ou partenaires.

---

## 2. Marché cible

### Zone de lancement

**Cameroun uniquement.**

Le produit pourra être étendu à d'autres pays ultérieurement.

### Moyens de transport

Le MVP cible les moyens de transport courants au Cameroun.

Pour commencer :

- Bus
- Voitures / véhicules légers

Le système doit cependant rester suffisamment générique pour permettre l'ajout d'autres types de transport plus tard.

---

## 3. Utilisateurs

Le système distingue plusieurs catégories d'utilisateurs.

### Passager

Utilisateur principal de la plateforme.

Il recherche et réserve des trajets.

Il choisit sa langue — **français ou anglais** ([I10](#i10--internationalisation)) — dès l'inscription, puisqu'elle détermine celle de l'OTP.

### Agence

Entreprise ou opérateur proposant des trajets sur MOTOBOY.

Elle gère notamment :

- véhicules ;
- chauffeurs ;
- trajets ;
- disponibilités ;
- réservations ;
- passagers.

### Propriétaire

Utilisateur pouvant être associé à des véhicules et à leur activité.

Il dispose d'un espace **en consultation seule** — ses véhicules, les départs qu'ils ont assurés, le taux de remplissage. Aucun circuit financier ne le relie à la plateforme : une éventuelle rémunération se règle directement avec l'agence. Voir [I3](#i3--rôle-propriétaire).

### Administrateur

Gère la plateforme dans son ensemble.

### Super administrateur

Dispose des droits de configuration et d'administration avancés.

> Voir [I4](#i4--administrateur-vs-super-administrateur) — la distinction entre les deux rôles reste à définir.

### Important pour le MVP

Le chauffeur n'a **pas d'application mobile dédiée** pour le moment.

---

## 4. Applications

### Application mobile

Une seule application **Expo React Native**, en TypeScript.

Elle est destinée **uniquement au passager** dans le MVP.

```text
Expo React Native
      |
      └── Passager
```

Le choix de React Native plutôt que Flutter est motivé par le **langage unique** avec l'application Web : il rend possible le partage des types du domaine, des schémas de validation et du client API ([§6](#6-architecture-générale)). Aucune décision des parties II et III n'en dépend — l'application passager ne fait qu'afficher un QR Code, le scan étant porté par la PWA web côté agent ([B3](#b3--validation-du-billet-à-lembarquement)).

Elle permettra notamment de :

- rechercher ;
- réserver ;
- payer ;
- consulter les billets ;
- afficher les QR Codes ;
- consulter l'historique ;
- recevoir les notifications.

### Application Web

Une seule application React + TypeScript.

Elle regroupe les différents espaces :

```text
React Web
    |
    ├── Public
    |
    ├── Passager
    |
    ├── Agence
    |
    ├── Propriétaire
    |
    └── Administration
```

Les interfaces sont différenciées par :

- rôles ;
- permissions ;
- routes ;
- layouts.

Nous ne créons donc pas trois projets React différents pour le MVP.

Si le produit grandit, les interfaces pourront être séparées ultérieurement.

---

## 5. Backend

Le backend sera une API Laravel.

```text
Expo RN ───────┐
               |
React Web ─────┼──→ Laravel API
               |
               └──→ PostgreSQL
                     |
                     └── Redis
```

L'API constitue la source de vérité pour :

- utilisateurs ;
- disponibilités ;
- réservations ;
- paiements ;
- billets ;
- statuts ;
- permissions ;
- données métier.

---

## 6. Architecture générale

### Organisation du dépôt

Le projet est un **monorepo**, géré par pnpm workspaces.

```text
motoboy/
├── apps/
│   ├── api/                 Laravel — hors du workspace JS
│   ├── web/                 React + Vite + TS
│   │                        public · passager · agence · propriétaire · admin
│   └── mobile/              Expo React Native — passager
├── packages/
│   ├── api-client/          types générés + client typé — jamais édité à la main
│   ├── shared/              domaine sans UI : formatage, libellés, jetons de design
│   └── tsconfig/            configurations communes
├── docs/
└── pnpm-workspace.yaml
```

**Ce que le monorepo apporte réellement.** Le gain n'est pas le dépôt unique mais le **langage unique** entre web et mobile, qui rend possible le partage des types du domaine, des schémas de validation et du client API. L'application passager étant la plus simple des deux surfaces, le bénéfice ne se mesure pas en volume de code économisé mais en **impossibilité de dérive** : lorsqu'un statut de réservation change, les deux clients cassent à la compilation au lieu de diverger silencieusement.

**Laravel est dans le dépôt mais hors du workspace JS.** Composer le gère, pnpm l'ignore. Une seule PR peut ainsi modifier un endpoint, le type généré et les deux clients.

**Deux packages, séparés par la frontière du généré.** `api-client` est régénéré intégralement depuis la spécification OpenAPI et n'est jamais édité à la main ; `shared` est écrit à la main. Les mélanger rendrait toute régénération risquée.

**La spécification OpenAPI est normative, pas générée depuis le code.** Elle est la source de vérité du contrat entre les trois applications, et l'implémentation Laravel est vérifiée contre elle par un test de conformité — requêtes et réponses validées contre le schéma. L'approche inverse, générer la spec depuis des annotations, la rendrait descriptive : elle suivrait le code au lieu de le contraindre, et ne permettrait plus de concevoir en avance. Contrat détaillé dans [`openapi.yaml`](openapi.yaml).

**Trois règles à tenir dès le départ :**

1. **`shared` ne porte jamais de règle métier.** Le backend est la source de vérité pour la disponibilité, le prix final, le statut de réservation et la validité d'un billet ([§29](#29-principes-techniques)). `shared` porte des types et de l'affichage — le jour où l'on y recalcule des frais d'annulation, la règle existe en deux exemplaires et elles divergeront.
2. **`shared` n'a aucune dépendance DOM ni React Native** — TypeScript et Zod, rien d'autre. Une dépendance web qui s'y glisse casse le build mobile. À vérifier en intégration continue, pas à la relecture.
3. **Pas de package d'interface partagé.** shadcn repose sur Radix et le DOM ; les composants mobiles sont écrits séparément. Seuls les **jetons de design** — couleurs, espacements, échelle typographique — se partagent.

**Turborepo n'est pas retenu au départ.** Avec deux applications et deux packages, pnpm workspaces suffit. Il s'ajoutera si les temps d'intégration continue le justifient.

**Point d'attention connu** : Metro exige une configuration explicite en monorepo — dossiers surveillés et résolution des modules. Les versions récentes d'Expo le gèrent nettement mieux qu'avant, mais c'est l'accroc classique de la mise en place.

### Backend — monolithe modulaire

Le MVP sera construit comme un monolithe modulaire.

```text
Laravel
   |
   ├── Identity
   ├── Users
   ├── Agencies
   ├── Places
   ├── Fleet
   ├── Routes
   ├── Trips
   ├── Bookings
   ├── Tickets
   ├── Payments
   ├── Commissions
   ├── Payouts
   ├── Notifications
   └── Administration
```

> Le module `Places` porte le référentiel géographique — voir [B1](#b1--référentiel-géographique).
> Le module `Payouts` couvre le compte courant des agences et les reversements — voir [B4](#b4--flux-financier-et-reversement-aux-agences).

Nous n'utiliserons pas de microservices au lancement.

L'objectif est d'avoir une architecture :

- simple ;
- maintenable ;
- testable ;
- évolutive ;
- rapide à développer.

La séparation des domaines permettra d'extraire certains services plus tard si cela devient nécessaire.

---

## 7. Stack technique

### Mobile

- Expo
- React Native
- TypeScript

### Web

- React
- TypeScript
- Vite

### Backend

- Laravel
- PHP
- REST API

### Base de données

- PostgreSQL

### Cache et files d'attente

- Redis
- Laravel Queue

### Authentification

- Laravel Sanctum
- OTP SMS

### Monorepo

- pnpm workspaces
- spécification OpenAPI normative, types TypeScript générés, conformité de l'API vérifiée par test

Voir [§6](#6-architecture-générale).

### Frontend

- React Router
- TanStack Query
- TanStack Table
- react-hook-form
- react-day-picker
- Zod
- dayjs
- Tailwind + shadcn — **design system unique pour toute l'application Web**

> Voir [I6](#i6--un-seul-design-system) — Ant Design est écarté ; les briques de tableaux, formulaires et dates qu'il aurait fournies sont explicitement ajoutées ci-dessus.

### Paiement

Agrégateur de paiement permettant idéalement :

- Mobile Money ;
- carte bancaire.

Le prestataire exact sera choisi ultérieurement.

> Voir [B4](#b4--flux-financier-et-reversement-aux-agences) — les capacités de reversement et de remboursement doivent être validées **avant** le choix du prestataire.

### Stockage

**Cloudflare R2**, compatible S3, pour :

- documents des agences ;
- documents des véhicules ;
- photos ;
- fichiers générés.

### SMS

**TechSoft SMS**, derrière le port `SmsSender`.

### Push

**Firebase Cloud Messaging**, derrière le port `PushSender`.

### Fournisseurs — ce que l'abstraction signifie concrètement

[§29](#29-principes-techniques) exige que le code métier ne dépende d'aucun
fournisseur précis. En pratique, pour chacun des quatre — paiement, SMS, email,
stockage :

- une **interface** dans le module concerné, exprimée en vocabulaire métier et
  non en vocabulaire du prestataire ;
- une **implémentation par fournisseur**, plus un pilote de journalisation
  utilisable en développement et en test ;
- le choix se fait **en configuration**, jamais par un `if` dans le code métier.

Ajouter ou changer de prestataire revient alors à écrire une classe et à changer
une ligne. C'est aussi ce qui permet de développer l'inscription par OTP avant
d'avoir la documentation d'accès de TechSoft.

---

## 8. Authentification

Le passager s'inscrit avec :

- numéro de téléphone ;
- email.

Le numéro de téléphone est vérifié par OTP SMS.

Règles retenues :

- OTP valide pendant 10 minutes ;
- maximum 4 tentatives.

Pas de :

- Google Login ;
- Apple Login.

La biométrie pourra être utilisée lorsqu'elle est disponible sur le téléphone, mais reste facultative.

---

## 9. Système de rôles et permissions

Le système sera conçu autour d'un système RBAC.

Exemple :

```text
Roles
  ├── PASSENGER
  ├── AGENCY
  ├── AGENT
  ├── OWNER
  ├── ADMIN
  └── SUPER_ADMIN
```

Le rôle `AGENT` couvre l'embarquement. Il est créé par l'agence pour son personnel et ne dispose que des permissions strictement nécessaires — voir [B3](#b3--validation-du-billet-à-lembarquement).

Le rôle `OWNER` est strictement en lecture — voir [I3](#i3--rôle-propriétaire).

Partage entre `ADMIN` et `SUPER_ADMIN` :

| Rôle | Périmètre |
|---|---|
| `ADMIN` | Exploitation quotidienne : validation des agences, modération des gares, remboursements, reversements, support. |
| `SUPER_ADMIN` | Tout ce qui précède, plus la gestion des comptes administrateurs, la configuration de la plateforme et l'accès à l'AuditLog. |

Voir [I4](#i4--administrateur-vs-super-administrateur).

Les permissions seront indépendantes des rôles :

```text
trips.view
trips.create
trips.update

vehicles.view
vehicles.manage

bookings.view
bookings.manage

tickets.validate

payments.view

agencies.manage
...
```

Cela permettra de faire évoluer les rôles sans modifier toute l'application.

---

## 10. Expérience Passager

Le parcours principal sera :

```text
Accueil
   ↓
Recherche
   ↓
Résultats
   ↓
Choix du trajet
   ↓
Sélection des places
   ↓
Informations passagers
   ↓
Paiement
   ↓
Confirmation
   ↓
Billet électronique
```

Les places sont **tenues dès la validation de la sélection**, donc avant la saisie des informations passagers, et un **compte à rebours** est affiché jusqu'au terme du paiement. Détail en [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement).

---

## 11. Recherche

Le passager pourra rechercher un trajet à partir de :

- départ ;
- destination ;
- date ;
- nombre de passagers.

### Saisie du départ et de la destination

La recherche s'exécute **toujours au niveau ville**, sur le couple ville de départ / ville d'arrivée.

L'autocomplétion propose **villes et gares** ; une gare sélectionnée résout vers sa ville. La comparaison est **insensible aux accents et à la casse** et s'appuie sur une liste d'alias par ville — condition indispensable, les accents n'étant pratiquement jamais saisis sur un clavier de téléphone.

Les résultats affichent en revanche la **gare précise** de départ, seule information exploitable pour se présenter au voyage. Détail en [B1](#b1--référentiel-géographique).

Les résultats présenteront notamment :

- agence ;
- heure ;
- véhicule ;
- type de transport ;
- places disponibles ;
- prix ;
- escales ;
- durée lorsque disponible.

### Filtres

Le MVP prévoit notamment :

- prix ;
- horaire ;
- agence ;
- type de véhicule ;
- disponibilité.

### Classement

Le système devra mettre en avant le meilleur trajet.

Pour le MVP, le prix sera un critère important du classement.

L'algorithme exact pourra être amélioré pendant le développement.

### Aucun résultat

Une recherche sans résultat affiche les **dates proches disponibles** sur le même axe, ainsi que les **axes desservis** au départ de la même ville. Détail en [I9](#i9--cas-aucun-résultat).

---

## 12. Gestion des trajets

Un trajet représente un voyage planifié.

Il comporte notamment :

- départ ;
- destination ;
- date ;
- heure ;
- véhicule ;
- chauffeur ;
- tarif ;
- capacité ;
- itinéraire ;
- escales.

L'agence est responsable de la publication et de la gestion de ses trajets.

### Trajets récurrents

Les horaires sont portés par un niveau `Schedule` rattaché à la `Route` — jours de la semaine, heure de départ, véhicule et tarif par défaut, période de validité. Un job quotidien génère les départs manquants sur un **horizon glissant de 30 jours**.

La génération ne modifie jamais un départ existant, et modifier un `Schedule` n'affecte que les départs générés ensuite. Détail en [I1](#i1--trajets-récurrents).

### Lieux de départ et d'arrivée

Les gares de départ et d'arrivée sont portées par la **`Route`**, et surchargeables ponctuellement sur un `Trip`. Une agence part de sa gare habituelle ; l'exception reste une exception, et ce rattachement évite de réinscrire la gare sur chaque départ généré ([I1](#i1--trajets-récurrents)).

Détail du référentiel en [B1](#b1--référentiel-géographique).

### Escales — décision arrêtée

La réservation se fait **exclusivement de point à point**, du départ à la destination finale du trajet.

Les escales sont **purement informatives** : elles apparaissent dans les résultats de recherche ([§11](#11-recherche)) et sur le billet ([§19](#19-billet-électronique)), mais **ne sont pas réservables**. Un passager ne peut pas réserver un tronçon intermédiaire.

Conséquence sur le modèle : la disponibilité d'un trajet reste un compteur unique — ou un plan de sièges unique — valable sur l'intégralité du parcours, sans gestion d'occupation par segment.

La réservation par tronçon est reportée hors MVP ([§31](#31-fonctionnalités-hors-mvp)). Détail de l'arbitrage en [B6](#b6--escales-et-réservation-par-tronçon).

> Voir [I1](#i1--trajets-récurrents) — la création de trajets récurrents est indispensable à l'usage réel.

---

## 13. Gestion des véhicules

Les véhicules doivent pouvoir être enregistrés par l'agence.

Informations principales :

- immatriculation ;
- marque ;
- modèle ;
- type ;
- capacité ;
- places ;
- état ;
- documents ;
- photo ;
- propriétaire.

Le système doit supporter :

**Véhicules avec sièges**

```text
A1
A2
A3
A4
...
```

**Véhicules sans gestion individuelle des sièges**

```text
Capacité   : 30
Disponibles : 17
```

### Changement de véhicule sur un départ réservé

Vers une capacité supérieure ou égale, le changement est libre. Vers une capacité inférieure, il est bloqué tant que les réservations excédentaires n'ont pas été traitées. Un changement de plan de sièges constitue une modification importante au sens de [B5](#b5--annulation-et-remboursement).

### Propriétaire

Le véhicule est rattaché à un propriétaire par son numéro de téléphone. Celui-ci accède alors à un espace **en consultation seule**, sans aucun flux financier porté par la plateforme ([I3](#i3--rôle-propriétaire)).

---

## 14. Gestion des chauffeurs

L'agence pourra gérer :

- identité ;
- téléphone ;
- permis ;
- véhicule affecté ;
- statut ;
- historique des voyages.

Le chauffeur reste cependant un acteur métier et ne dispose pas d'une application mobile dans le MVP.

---

## 15. Réservation

Le MVP supporte la réservation d'un ou plusieurs passagers.

Un utilisateur peut :

- réserver pour lui-même ;
- réserver pour quelqu'un d'autre ;
- réserver plusieurs places ;
- choisir une place lorsque le véhicule le permet.

Le principe standard est :

```text
Réservation
      ↓
Paiement
      ↓
Confirmation
      ↓
Billet
```

Une réservation payée devient confirmée.

Certaines règles pourront être configurables par l'agence et seront précisées pendant le développement.

### Cycle de vie

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

Il n'existe pas d'état `FAILED` sur la réservation : un échec de paiement n'affecte que la tentative concernée et ne libère pas les places. Détail en [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement).

### Conditions d'annulation

Les conditions d'annulation applicables — délai limite et frais — sont **affichées avant le paiement** et **figées sur la réservation** à sa création. Un durcissement ultérieur des conditions de l'agence est sans effet sur les réservations déjà confirmées.

Détail en [B5](#b5--annulation-et-remboursement).

> Voir [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement) — le cycle de vie complet et la tenue des places pendant le paiement restent à définir.

---

## 16. Disponibilité des places

La disponibilité est calculée côté backend.

Le système doit empêcher deux utilisateurs de réserver simultanément la même place.

Principe :

```text
Capacité totale
      -
Places réservées/occupées
      =
Places disponibles
```

Les places **tenues** par un paiement en cours sont comptées comme occupées, sur tous les canaux — y compris la vente au guichet.

### Concurrence et verrous

| Type de véhicule | Verrou transactionnel | Garde-fou en base |
|---|---|---|
| Avec sièges individuels | verrou sur les lignes de sièges concernées | index unique partiel sur `(trip_id, seat_id)`, restreint aux statuts actifs |
| Sans gestion des sièges | verrou sur la ligne d'inventaire du trajet | contrainte de vérification `places_prises <= capacité` |

Les garde-fous en base ne font pas double emploi avec les verrous : ils rattrapent une erreur applicative en refusant l'écriture plutôt qu'en double-vendant.

Une réservation de plusieurs places est prise atomiquement. Détail en [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement).

---

## 17. Paiement

Le MVP utilise un agrégateur.

Moyens recherchés :

- Mobile Money ;
- carte bancaire si disponible.

Flux :

```text
Passager
   ↓
Réservation
   ↓
Agrégateur
   ↓
Mobile Money / Carte
   ↓
Confirmation
   ↓
Billet
```

Le système doit prévoir :

- paiement en attente ;
- paiement réussi ;
- paiement échoué ;
- remboursement ;
- protection contre les doubles paiements ;
- identifiant unique de transaction.

Les ventes au guichet sont enregistrées avec la méthode `CASH` : elles ne transitent pas par l'agrégateur mais alimentent statistiques et compte courant ([I2](#i2--vente-au-guichet)).

Une réservation porte **plusieurs tentatives de paiement**, dont une seule aboutie : un échec ne clôt pas la réservation et ne libère pas les places tant que le hold court. Détail en [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement).

---

## 18. Wallet

Le wallet MOTOBOY est hors MVP.

Il pourra être ajouté plus tard.

Cela réduit la complexité financière du lancement.

---

## 19. Billet électronique

Après confirmation du paiement, MOTOBOY génère un billet.

Il contient notamment :

- nom du passager ;
- numéro de réservation ;
- départ ;
- destination ;
- date ;
- heure ;
- agence ;
- véhicule ;
- place si applicable ;
- QR Code ;
- statut.

Le billet sera accessible :

- dans l'application mobile, **y compris sans réseau** — il est mis en cache localement et son QR Code est regénéré à partir des données stockées, jamais téléchargé comme image ([I5](#i5--réseau-faible-et-mode-hors-ligne)) ;
- sur le web ;
- et pourra être téléchargé/imprimé selon l'implémentation.

Un billet vendu au guichet est imprimé au comptoir et envoyé par SMS ([I2](#i2--vente-au-guichet)).

---

## 20. QR Code

Le QR Code constitue le mécanisme principal de validation du billet.

Pour le MVP :

```text
Billet
  ↓
QR Code
  ↓
Scan
  ↓
Vérification backend
  ↓
Billet valide ?
  ↓
Validation
```

Les mécanismes plus avancés de QR chauffeur pourront être ajoutés progressivement.

Un billet correspond à **un passager et un QR Code**.

La validation est assurée par le rôle `AGENT` depuis une **PWA fonctionnant hors ligne** : la liste d'embarquement est téléchargée avant le départ, les scans sont vérifiés localement, et les validations sont synchronisées au retour du réseau. Trois niveaux de secours sont prévus — scan, saisie manuelle du numéro de réservation, liste d'embarquement imprimable.

Détail en [B3](#b3--validation-du-billet-à-lembarquement).

---

## 21. Recherche d'alternatives

C'est une fonctionnalité importante du MVP.

Si un trajet est complet :

```text
Douala → Bafoussam

Agence A
08:00
COMPLET
       ↓
       MOTOBOY
       ↓
Agence B — 09:00
Agence C — 10:00
Agence D — 11:30
```

MOTOBOY doit rechercher :

- autre départ ;
- autre agence ;
- autre transporteur ;
- partenaire ;
- autre horaire ;
- autre véhicule.

Cette fonctionnalité constitue un élément différenciant majeur de MOTOBOY.

### Cas d'usage inverse : le départ est annulé

La recherche d'alternatives est également mobilisée lorsqu'une **agence annule un départ** ([B5](#b5--annulation-et-remboursement)). Les passagers sont remboursés automatiquement, et la notification d'annulation embarque les alternatives disponibles sur le même axe et à des horaires proches.

C'est le cas où cette fonctionnalité crée le plus de valeur : elle transforme un incident subi en solution proposée.

---

## 22. Interface Agence

L'agence dispose de son espace Web.

### Dashboard

- voyages du jour ;
- prochains voyages ;
- réservations ;
- places disponibles ;
- revenus ;
- statistiques principales.

### Véhicules

- création ;
- modification ;
- disponibilité ;
- capacité ;
- documents.

### Personnel

- création de comptes pour son personnel ;
- attribution du rôle `AGENT` pour l'embarquement ;
- désactivation d'un compte.

Voir [B3](#b3--validation-du-billet-à-lembarquement).

### Embarquement

Écran dédié, utilisable sur téléphone, fonctionnant **hors ligne** :

- téléchargement de la liste d'embarquement avant le départ ;
- scan du QR Code par la caméra du navigateur ;
- saisie manuelle du numéro de réservation en secours ;
- liste d'embarquement imprimable en dernier recours ;
- affichage distinct des cinq cas — valide, déjà validé, autre départ, annulé, référence inconnue ;
- compteur de groupe sur les réservations multiples ;
- synchronisation différée des validations au retour du réseau.

### Gares

- création et modification de ses propres gares — nom, adresse, coordonnées GPS, ville ;
- publication immédiate, sans validation bloquante ;
- **demande d'ajout d'une ville** absente du référentiel.

Voir [B1](#b1--référentiel-géographique).

### Chauffeurs

- création ;
- modification ;
- affectation ;
- statut.

### Trajets

- création ;
- modification ;
- **horaires récurrents (`Schedule`)** — jours, heure, véhicule et tarif par défaut, période de validité ([I1](#i1--trajets-récurrents)) ;
- planification ;
- itinéraire ;
- escales ;
- prix ;
- véhicule ;
- chauffeur ;
- capacité ;
- **annulation d'un départ**, avec motif obligatoire — déclenche le remboursement automatique de tous les passagers confirmés ([B5](#b5--annulation-et-remboursement)).

**Fermeture des ventes en ligne** : par défaut 30 minutes avant le départ, délai paramétrable par agence. La vente au guichet reste ouverte jusqu'au départ. Un trajet dont la fenêtre est fermée disparaît des résultats de recherche. Détail en [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement).

Le prix d'un trajet ne peut pas être modifié pour les réservations déjà confirmées. Toute modification importante — horaire décalé de plus de 30 minutes, changement de date ou de gare de départ — ouvre aux passagers concernés un droit d'annulation gratuite.

### Réservations

- liste ;
- détails ;
- passagers ;
- places ;
- paiement ;
- statut.

### Vente au guichet

L'agence peut enregistrer manuellement un passager et générer son billet.

Le parcours doit tenir en **moins de 30 secondes** — départ, place, nom et téléphone. Au-delà, il est plus lent que le cahier et ne sera pas utilisé, ce qui ruine la fiabilité de la disponibilité affichée ([I2](#i2--vente-au-guichet)) :

- **aucun compte passager** — nom et numéro de téléphone suffisent, sans inscription ni OTP ;
- **réservation créée directement en `CONFIRMED`**, sans hold ni tunnel de paiement ;
- **paiement de méthode `CASH`** enregistré, sans transiter par l'agrégateur ;
- **billet imprimé au comptoir et envoyé par SMS**, l'envoi SMS étant désactivable par agence.

Les places **tenues** par un paiement en ligne en cours apparaissent comme indisponibles, au même titre que les places vendues — mais avec leur **échéance affichée**, afin que l'agent sache s'il peut attendre quelques minutes ou s'il doit orienter son client vers un autre siège ([B2](#b2--réservation-temporaire-des-places-pendant-le-paiement)).

Cette vente est encaissée en espèces par l'agence : elle ne passe donc pas par le flux de reversement. Par défaut, **aucune commission n'y est appliquée** — la saisie guichet doit rester gratuite et sans friction, puisque c'est elle qui garantit la fiabilité de la disponibilité affichée. La commission peut néanmoins être activée par agence ([B4](#b4--flux-financier-et-reversement-aux-agences)) ; elle est alors portée au débit du compte courant de l'agence.

> Voir [I2](#i2--vente-au-guichet) — ce point porte l'intégrité des données de disponibilité.

### Reversements

- solde du compte courant ;
- prochain reversement prévu et son montant estimé ;
- historique des reversements ;
- relevé téléchargeable par période — brut, commission, remboursements, ajustements, net ;
- consultation des conditions commerciales et des coordonnées de reversement, en lecture seule.

Voir [B4](#b4--flux-financier-et-reversement-aux-agences).

---

## 23. Interface Administration

L'administration permet de superviser la plateforme.

### Gestion

- utilisateurs ;
- agences ;
- véhicules ;
- chauffeurs ;
- propriétaires ;
- trajets ;
- réservations ;
- billets ;
- transactions ;
- commissions.

### Validation des agences

Une agence peut :

- s'inscrire elle-même ;
- être ajoutée manuellement par l'administration.

Elle doit fournir les documents nécessaires à sa validation.

La validation inclut la saisie et la **vérification des coordonnées de reversement** — numéro Mobile Money ou compte bancaire. Toute modification ultérieure de ces coordonnées passe obligatoirement par l'administration, est journalisée et notifiée à l'agence ([B4](#b4--flux-financier-et-reversement-aux-agences)).

### Référentiel géographique

- gestion des pays et des **villes** — liste fermée, curée par MOTOBOY ;
- gestion des alias de villes, utilisés par l'autocomplétion ;
- traitement des **demandes d'ajout de ville** émises par les agences ;
- modération **a posteriori** des gares créées par les agences.

Voir [B1](#b1--référentiel-géographique).

### Paramètres commerciaux par agence

Définis à la validation de l'agence, modifiables uniquement par l'administration :

- type et valeur de la commission ;
- délai d'éligibilité après le départ ;
- fréquence de reversement ;
- seuil minimum de reversement ;
- porteur des frais d'agrégateur ;
- activation de la commission sur vente guichet.

Détail et bornes autorisées en [B4](#b4--flux-financier-et-reversement-aux-agences).

### Reversements

- propositions de reversement calculées automatiquement ;
- validation manuelle avant décaissement ;
- suivi des statuts et des échecs ;
- ajustements manuels avec motif obligatoire ;
- rapport de réconciliation quotidien avec l'agrégateur.

### Statistiques

Le dashboard peut notamment afficher :

- utilisateurs ;
- voyages ;
- réservations ;
- chiffre d'affaires ;
- commissions ;
- billets validés ;
- véhicules actifs ;
- agences actives ;
- transactions ;
- **taux d'annulation par agence**, avec seuil déclenchant une revue ([B5](#b5--annulation-et-remboursement)) — seules comptent les annulations de départs portant des réservations confirmées ([I1](#i1--trajets-récurrents)) ;
- remboursements en échec, remontés en alerte ;
- doublons de validation détectés à la synchronisation ([B3](#b3--validation-du-billet-à-lembarquement)).

---

## 24. Notifications

Le MVP prévoit les notifications essentielles :

- confirmation de réservation ;
- confirmation de paiement ;
- rappel du départ ;
- annulation ;
- modification importante du voyage.

Est considérée comme **modification importante** : un décalage d'horaire supérieur à 30 minutes, un changement de date, ou un changement de gare de départ. Elle ouvre un droit d'annulation gratuite avec remboursement intégral ([B5](#b5--annulation-et-remboursement)).

L'annulation d'un départ par une agence est notifiée **immédiatement sur tous les canaux, SMS compris** — c'est le cas où le coût du SMS est pleinement justifié.

Canaux, arbitrés selon le coût du SMS ([I8](#i8--coût-des-sms)) :

| Événement | Canal |
|---|---|
| OTP d'inscription | SMS — aucune alternative |
| Annulation par l'agence | SMS — systématique |
| Confirmation de réservation | Push si disponible, SMS en repli |
| Rappel de départ | Push uniquement |
| Billet de vente au guichet | SMS, désactivable par agence |

Le repli SMS sur la confirmation est indispensable : un passager réservant depuis le web n'a pas l'application, donc pas de push.

Toutes ces notifications sont **localisées côté serveur** — `users.locale` pour un compte, langue par défaut de l'agence pour un passager de vente au guichet ([I10](#i10--internationalisation)). L'email est utilisé selon les cas, en complément.

Les notifications non critiques seront traitées de manière asynchrone.

---

## 25. Historique

Le passager pourra consulter :

- réservations ;
- voyages effectués ;
- voyages annulés ;
- paiements ;
- billets.

---

## 26. Commission

MOTOBOY doit prévoir un système de commission.

La commission pourra être :

- fixe ;
- ou basée sur un pourcentage.

Les règles commerciales précises seront définies ultérieurement.

### Règle impérative de figement

Le taux ou montant de commission, le porteur des frais d'agrégateur et le délai d'éligibilité applicables sont **recopiés sur la réservation au moment de sa création**. Aucun calcul financier ne doit lire les paramètres courants de l'agence.

Sans cette règle, modifier un taux réécrit rétroactivement l'historique de toutes les réservations passées, y compris celles déjà reversées et déjà justifiées à l'agence.

### Frais d'agrégateur

Portés par MOTOBOY par défaut, afin que le prix affiché reste celui de l'agence. Ils peuvent être basculés sur l'agence par paramétrage, mais **jamais sur le passager**. Le taux de commission doit être fixé en connaissance de ces frais.

Détail en [B4](#b4--flux-financier-et-reversement-aux-agences).

### Commission et annulation

La commission n'est **pas prélevée** sur une réservation annulée. MOTOBOY récupère uniquement ses frais réels d'agrégateur sur les frais d'annulation retenus ; le solde revient à l'agence. Détail en [B5](#b5--annulation-et-remboursement).

---

## 27. Sécurité

Le MVP doit intégrer dès le départ :

- HTTPS ;
- authentification sécurisée ;
- OTP ;
- rôles et permissions ;
- protection des données ;
- protection contre les doubles réservations ;
- protection contre les doubles paiements ;
- audit des opérations sensibles ;
- contrôle des accès administratifs ;
- sauvegardes.

---

## 28. Audit

Les opérations sensibles doivent être journalisées.

Exemples :

- Qui a créé ce trajet ?
- Qui a modifié le prix ?
- Qui a annulé cette réservation ?
- Qui a validé ce billet ?
- Qui a effectué ce remboursement ?

Un AuditLog permettra notamment de conserver :

- utilisateur ;
- action ;
- entité ;
- identifiant de l'entité ;
- anciennes valeurs si nécessaire ;
- nouvelles valeurs si nécessaire ;
- adresse IP ;
- date et heure.

---

## 29. Principes techniques

### Backend comme source de vérité

Le frontend ne décide jamais :

- disponibilité ;
- prix final ;
- paiement ;
- statut de réservation ;
- validité d'un billet.

### Transactions

Les opérations critiques sont atomiques.

### Idempotence

Les paiements, webhooks, validations QR et opérations sensibles doivent pouvoir être rejoués sans créer de doublons.

### Abstraction des fournisseurs

Le code métier ne doit pas dépendre directement d'un fournisseur précis pour :

- paiement ;
- SMS ;
- email ;
- stockage.

### Asynchrone

Les tâches non critiques peuvent passer par une queue :

```text
Booking confirmed
      ↓
    Queue
      ├── SMS
      ├── Email
      ├── Push
      └── génération document
```

### API versionnée

```text
/api/v1/...
```

dès le départ.

### Observabilité

Trois briques dès le MVP, la plateforme encaissant de l'argent et dépendant de webhooks tiers ([I7](#i7--observabilité)) :

- suivi des erreurs, backend et frontend ;
- supervision des files Laravel — un job de libération de places bloqué gèle l'inventaire sans alerte ;
- journal traçable des webhooks de paiement : reçus, rejoués, échoués.

Ce journal complète la réconciliation quotidienne de [B4](#b4--flux-financier-et-reversement-aux-agences) : la réconciliation détecte l'écart, le journal explique son origine.

---

## 30. Structure logique des données

Le modèle principal tournera autour de :

```text
User
 │
 ├── Agency
 │
 └── Passenger
```

et :

Le référentiel géographique ([B1](#b1--référentiel-géographique)) :

```text
Country
   └── City   (alias[], utilisés par l'autocomplétion)
         └── Station   (rattachée à une agence)
```

et :

```text
Agency
 ├── Vehicles   (rattachés à un Owner, en lecture seule)
 ├── Drivers
 ├── Stations
 ├── Routes   (villes + gares départ/arrivée, escales[])
 │      └── Schedules   (jours, heure, véhicule et tarif par défaut)
 └── Trips
        │
        ├── Seats
        └── Bookings
                │
                ├── Passengers
                ├── Payments   (plusieurs tentatives, une seule aboutie)
                └── Ticket
```

Le `Booking` porte son cycle de vie et la date d'expiration du hold ([B2](#b2--réservation-temporaire-des-places-pendant-le-paiement)) :

```text
PENDING_PAYMENT → CONFIRMED | EXPIRED | CANCELLED_BY_PASSENGER
CONFIRMED       → USED | NO_SHOW | CANCELLED_BY_PASSENGER | CANCELLED_BY_AGENCY
```

Puis :

```text
Payment
   ↓
Commission
   ↓
AgencyLedger ── LedgerEntry
   ↑
Refund  (total ou partiel, au niveau du passager/siège)
   ↓
Payout ── PayoutLine

Agency
   ↓
AgencyCommercialTerms
(conditions figées sur chaque Booking à sa création)

Ticket   (un par passager, un QR Code)
   ↓
TicketValidation
   (agent, horodatage, méthode SCAN | MANUAL,
    date de synchronisation, doublon signalé)

User
   ↓
Notifications

Toutes les opérations sensibles
   ↓
AuditLog
```

> Le modèle est complet au regard des six points bloquants tranchés. Seul [B3](#b3--validation-du-billet-à-lembarquement) peut encore l'enrichir, autour de `TicketValidation`.

---

## 31. Fonctionnalités hors MVP

Pour garder un produit réellement lançable, les fonctionnalités suivantes sont reportées :

- Wallet MOTOBOY ;
- application mobile chauffeur ;
- application mobile agence ;
- suivi GPS ;
- géolocalisation temps réel ;
- ETA avancé ;
- taxi ;
- réservation de trains ;
- réservation de vols ;
- hôtels ;
- location de véhicules ;
- système colis complet ;
- fonctionnalités avancées de partenaires ;
- fonctionnalités avancées de fidélité ;
- marketplace de services de mobilité ;
- **réservation par tronçon** — escales réservables (voir [B6](#b6--escales-et-réservation-par-tronçon)) ;
- **transfert d'une réservation vers un autre départ** — en cas d'annulation, le passager est remboursé puis réserve à nouveau (voir [B5](#b5--annulation-et-remboursement)) ;
- **rôles personnalisés définis par chaque agence** — le MVP se limite aux rôles par défaut de la plateforme (voir [B3](#b3--validation-du-billet-à-lembarquement)) ;
- **alerte de disponibilité** — prévenir un passager lorsqu'une offre apparaît sur le trajet recherché ; à traiter juste après le MVP (voir [I9](#i9--cas-aucun-résultat)).

---

## 32. MVP final

### Passager — Mobile + Web

```text
Inscription
     ↓
Recherche
     ↓
Comparaison
     ↓
Choix
     ↓
Réservation
     ↓
Paiement
     ↓
Billet QR
     ↓
Validation
     ↓
Historique
```

### Agence — Web

```text
Agence
 ↓
Véhicules
 ↓
Chauffeurs
 ↓
Trajets
 ↓
Places
 ↓
Réservations
 ↓
Passagers
 ↓
Paiements
```

### Propriétaire — Web

Consultation seule, sans aucun flux financier ([I3](#i3--rôle-propriétaire)) :

```text
Propriétaire
 ↓
Véhicules
 ↓
Départs assurés
 ↓
Taux de remplissage
```

### Administration — Web

```text
Administration
 ↓
Utilisateurs
Agences
Propriétaires
Véhicules
Chauffeurs
Trajets
Réservations
Paiements
Commissions
Statistiques
Audit
```

---

## 33. Architecture MVP finale

```text
                         MOTOBOY
                            │
             ┌──────────────┴──────────────┐
             │                             │
     Expo React Native                  React Web
             │                             │
         PASSAGER        ┌───────────┬─────┴─────┬───────────┐
                         │           │           │           │
                     PASSAGER     AGENCE   PROPRIÉTAIRE    ADMIN
                         │           │           │           │
                         └───────────┴─────┬─────┴───────────┘
                                           │
                                      REST API
                                           │
                                   Laravel / PHP
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                         PostgreSQL                  Redis
                              │                         │
                              │                   Queue / Cache
                              │
                    ┌─────────┴──────────┐
                    │                    │
                Paiement                SMS
               Agrégateur             / Email
```

---

## 34. Stack finale

### Frontend Web

- React
- TypeScript
- Vite
- Tailwind + shadcn
- React Router
- TanStack Query
- TanStack Table
- react-hook-form
- react-day-picker
- Zod
- dayjs

### Mobile

- Expo
- React Native
- TypeScript

### Backend

- Laravel
- PHP
- REST API
- Laravel Sanctum

### Infrastructure

- PostgreSQL
- Redis
- Laravel Queue
- Docker
- stockage S3-compatible

### Observabilité

- suivi des erreurs, backend et frontend
- supervision des files Laravel
- journal traçable des webhooks de paiement

Voir [I7](#i7--observabilité).

---

## 35. Principe directeur

Construire le minimum nécessaire pour mettre MOTOBOY entre les mains de vrais passagers et de vraies agences, tout en gardant une architecture suffisamment propre pour évoluer.

Le MVP doit prioritairement valider le parcours :

```text
Recherche
    ↓
Comparaison
    ↓
Réservation
    ↓
Paiement
    ↓
Billet
    ↓
Voyage
```

L'architecture doit donc privilégier :

- simplicité ;
- rapidité de développement ;
- fiabilité des transactions ;
- sécurité ;
- maintenabilité ;
- capacité d'évolution.

Nous ne cherchons pas à résoudre dès maintenant tous les cas métier possibles. Les règles détaillées seront précisées module par module pendant la conception et le développement.

---

## 36. Résumé

MOTOBOY MVP repose sur :

```text
1 application mobile
    → Expo React Native
    → Passager uniquement

1 application Web
    → React + TypeScript
    → Passager + Agence + Propriétaire + Administration

1 API
    → Laravel

1 base de données
    → PostgreSQL

1 système de cache/queue
    → Redis
```

Le tout dans un **monorepo pnpm**, l'API Laravel vivant dans le dépôt mais hors du workspace JS ([§6](#6-architecture-générale)).

Le choix architectural central est :

> Un monolithe modulaire pour le backend, une application Web unique basée sur les rôles et permissions, et un langage unique entre web et mobile permettant de partager types, schémas et client API.

---
---

# Partie II — Points bloquants à trancher

> Ces six points conditionnaient le modèle de données ou le parcours principal. **Tous sont désormais tranchés.** Chaque section conserve le raisonnement ayant conduit à la décision, ainsi que les coûts explicitement acceptés.

| | Point | Statut |
|---|---|---|
| B1 | Référentiel géographique | ✅ **tranché** — Country / City / Station, villes curées par MOTOBOY |
| B2 | Tenue des places pendant le paiement | ✅ **tranché** — hold de 10 min dès la sélection, verrous + garde-fous en base |
| B3 | Validation du billet à l'embarquement | ✅ **tranché** — rôle `AGENT`, PWA hors ligne, triple secours |
| B4 | Flux financier et reversement aux agences | ✅ **tranché** — encaissement centralisé, conditions paramétrables par agence |
| B5 | Annulation et remboursement | ✅ **tranché** — seuil unique côté passager, remboursement automatique côté agence |
| B6 | Escales et réservation par tronçon | ✅ **tranché** — point-à-point uniquement |

---

## B1 — Référentiel géographique

**Décision arrêtée — 13 août 2026.**

### Hiérarchie retenue

```text
Country    code, nom, devise, indicatif téléphonique, actif
   └── City        nom, alias[], actif
         └── Station    nom, adresse, latitude/longitude, agence, ville
```

**`BoardingPoint` est écarté.** Pour des agences de bus au Cameroun, la gare *est* le point d'embarquement : ce niveau supplémentaire serait vide dans la quasi-totalité des cas. Un besoin ponctuel (« quai 3 ») se couvre par un champ texte sur le trajet, sans table dédiée.

**`Country` est conservé** malgré le MVP mono-pays. Le coût est d'une table et d'une clé étrangère, il porte la devise et l'indicatif téléphonique déjà nécessaires, et [§2](#2-marché-cible) annonce explicitement l'extension à d'autres pays. La migration a posteriori serait nettement plus coûteuse.

**Les coordonnées GPS de la gare sont stockées dès le MVP**, même sans carte à l'écran : le stockage est gratuit et la donnée devient exploitable dès le premier affichage cartographique.

### Propriété des gares

**Une gare appartient à une agence.** Elle n'est pas un lieu physique partagé auquel les agences se rattacheraient.

Au Cameroun, les compagnies interurbaines exploitent très majoritairement leur propre gare — c'est d'ailleurs ainsi qu'on les désigne. Le modèle de lieu partagé imposerait à MOTOBOY de curer une liste canonique de lieux physiques et d'arbitrer les revendications concurrentes, pour un bénéfice quasi nul.

Conséquence assumée : deux agences installées au même endroit produisent deux gares distinctes. C'est conforme à la réalité perçue par le passager.

### Administration du référentiel

> **Les villes forment une liste fermée, curée par MOTOBOY. Les gares sont créées par les agences.**

Les villes constituent l'axe de recherche. Si chaque agence pouvait créer la sienne, « Douala », « douala » et « Dla » coexisteraient et la recherche cesserait de regrouper les offres — c'est-à-dire que le comparateur perdrait son objet.

Les gares, à l'inverse, sont des actifs propres à chaque agence. Les faire créer par l'administration constituerait un goulot d'étranglement à l'onboarding.

**Modération a posteriori, jamais bloquante** : l'agence crée sa gare et publie immédiatement ; l'administration peut renommer ou corriger ensuite. Une validation préalable bloquerait une agence motivée pour plusieurs jours.

**Circuit de demande de ville** : une agence desservant une ville absente de la liste doit pouvoir en demander l'ajout depuis son espace. Sans ce circuit, elle se retrouve bloquée sans recours et abandonne.

### Rattachement des gares

Les gares sont portées par la **`Route`**, avec possibilité de surcharge sur le `Trip`.

```text
Route    agence, ville départ, ville arrivée,
         gare départ, gare arrivée, escales[], durée de référence

Trip     route, date, heure, véhicule, chauffeur, tarif, capacité
         + surcharge optionnelle des gares
```

Une agence part toujours de sa gare habituelle ; l'exception existe mais reste une exception. Ce choix allège également la génération des trajets récurrents ([I1](#i1--trajets-récurrents)), qui n'a pas à réinscrire la gare sur chaque départ produit.

Les escales sont une liste ordonnée de **villes** portée par la `Route`, sans impact sur l'inventaire ([B6](#b6--escales-et-réservation-par-tronçon)).

### Sémantique de recherche

- La recherche s'exécute **toujours au niveau ville**, sur le couple ville de départ / ville d'arrivée.
- L'**autocomplétion propose villes et gares** ; une gare sélectionnée résout vers sa ville. Un passager qui saisit « Bonabéri » voit la suggestion et atterrit sur Douala.
- La comparaison est **insensible aux accents et à la casse**, et s'appuie sur une liste d'**alias par ville** (`Yaounde`, `Yde`, `Ngaoundere`…).

Ce dernier point n'est pas cosmétique : sur un clavier de téléphone, les accents ne sont pratiquement jamais saisis. Sans alias ni normalisation, l'autocomplétion échoue sur une grande part des saisies réelles — et un passager dont la première recherche ne renvoie rien ne recommence pas.

Les résultats ([§11](#11-recherche)) et le billet ([§19](#19-billet-électronique)) affichent en revanche la **gare précise**, seule information exploitable pour se présenter au départ.

### Écarté du MVP

Une table de **quartiers/zones** curée par ville. Elle serait utile pour filtrer par point de départ — à Douala, la différence entre Akwa et Bonabéri représente le pont sur le Wouri et environ trois quarts d'heure. Mais [§11](#11-recherche) ne prévoit pas ce filtre au MVP, et l'adresse libre de la gare associée à ses coordonnées GPS suffit à informer le passager.

À reprendre dès que le filtre par point de départ sera introduit.

### Impacts sur le reste du document

- module `Places` ajouté dans [§6](#6-architecture-générale) ;
- entités `Country`, `City`, `Station` ajoutées dans [§30](#30-structure-logique-des-données) ;
- sémantique de recherche et autocomplétion précisées dans [§11](#11-recherche) ;
- rattachement des gares précisé dans [§12](#12-gestion-des-trajets) ;
- gestion des gares et demande de ville ajoutées à [§22](#22-interface-agence) ;
- administration du référentiel ajoutée à [§23](#23-interface-administration).

---

## B2 — Réservation temporaire des places pendant le paiement

**Décision arrêtée — 13 août 2026.**

Un paiement Mobile Money n'est pas instantané : le passager reçoit une sollicitation sur son téléphone et doit saisir son code. L'opération prend une à deux minutes et échoue fréquemment — code erroné, solde insuffisant, délai dépassé, abandon. Sans tenue temporaire explicite des places, soit elles restent disponibles pendant le paiement et l'on double-vend, soit elles sont bloquées définitivement et l'inventaire se gèle sur des paiements abandonnés.

### Cycle de vie de la réservation

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

**Il n'existe pas d'état `FAILED` sur la réservation.** L'échec appartient à la tentative de paiement, pas à la réservation — conséquence directe de la règle de nouvelle tentative ci-dessous.

La libération des places expirées est portée par un **job en queue**, jamais par un calcul effectué à la lecture.

### Démarrage et durée du hold

Les places sont tenues **dès la validation de la sélection**, donc avant la saisie des informations passagers ([§10](#10-expérience-passager)).

Tenir la place seulement au moment du paiement laisserait deux passagers saisir en parallèle les informations de plusieurs voyageurs, l'un des deux perdant sa place au dernier écran — le pire moment possible pour échouer dans le tunnel.

**Durée : 10 minutes par défaut, paramétrable par agence.** La valeur juste est empirique : environ 3 minutes de saisie, 2 minutes par tentative de paiement, deux tentatives possibles. Elle sera ajustée une fois les temps réels de tunnel observés.

Un **compte à rebours est affiché au passager** : il doit savoir qu'il est chronométré.

### Échecs de paiement et nouvelles tentatives

**La fenêtre court en entier quelles que soient les tentatives échouées. Seule une annulation explicite du passager libère les places avant terme.**

Libérer la place au premier échec paraîtrait plus efficace, mais avec Mobile Money l'échec est banal. Un passager qui recompose correctement son code découvrirait que son siège est parti — comportement inacceptable sur ce marché.

Le coût est assumé : un abandon silencieux gèle les places pendant toute la fenêtre.

**Conséquence de modélisation : une réservation porte plusieurs tentatives de paiement**, dont une seule aboutie. La relation `Booking → Payment` est donc de un à plusieurs.

### Vente au guichet face à un hold

**Une place tenue est indisponible au guichet, exactement comme une place vendue.** Le hold l'emporte, pour tous les canaux.

Donner la priorité au guichet obligerait à rembourser un passager venant de payer avec succès — nettement pire que de faire choisir un autre siège à l'agent. Le conflit ne mord réellement que si toutes les places restantes sont tenues, cas rare et borné par la durée du hold.

**L'agent doit toutefois distinguer « vendue » de « tenue »** : l'échéance du hold est affichée dans le back-office, ce qui lui permet de décider s'il attend ou s'il oriente son client autrement.

### Fermeture des ventes en ligne

**Les ventes en ligne se ferment 30 minutes avant le départ, délai paramétrable par agence.** La vente au guichet reste ouverte jusqu'au départ : l'agence voit le véhicule et maîtrise sa situation.

Sans cette règle, une réservation reste possible quelques secondes avant le départ — le passager ne peut matériellement pas s'y présenter, et la liste d'embarquement est déjà établie.

Les trajets dont la fenêtre de vente est fermée n'apparaissent plus dans les résultats de recherche ([§11](#11-recherche)).

### Verrouillage

Deux mécanismes selon le type de véhicule ([§13](#13-gestion-des-véhicules)) :

| Type de véhicule | Verrou transactionnel | Garde-fou en base |
|---|---|---|
| Avec sièges individuels | verrou sur les lignes de sièges concernées | index unique partiel sur `(trip_id, seat_id)`, restreint aux statuts actifs |
| Sans gestion des sièges | verrou sur la ligne d'inventaire du trajet | contrainte de vérification `places_prises <= capacité` |

L'index unique et la contrainte ne font pas double emploi avec les verrous : ce sont les garde-fous qui rattrapent une erreur applicative. Si la logique métier se trompe, la base refuse l'écriture au lieu de double-vendre. Sur un produit où la double-vente se traduit par un passager debout devant un car complet, ces deux lignes de DDL valent leur coût.

Une réservation de plusieurs places est prise **atomiquement** — tout ou rien.

### Cas limite : paiement abouti après expiration

Le webhook de succès arrive après l'expiration du hold, et la place a été revendue. Tranché en [B5](#b5--annulation-et-remboursement) : remboursement intégral automatique, motif `LATE_PAYMENT`, alternatives proposées dans la notification.

### Impacts sur le reste du document

- tenue des places et compte à rebours précisés dans [§10](#10-expérience-passager) ;
- machine à états ajoutée à [§15](#15-réservation) ;
- stratégie de verrouillage détaillée dans [§16](#16-disponibilité-des-places) ;
- tentatives multiples précisées dans [§17](#17-paiement) ;
- fermeture des ventes en ligne ajoutée à [§12](#12-gestion-des-trajets) ;
- visibilité des holds au guichet ajoutée à [§22](#22-interface-agence) ;
- états et cardinalité `Booking → Payment` corrigés dans [§30](#30-structure-logique-des-données).

---

## B3 — Validation du billet à l'embarquement

**Décision arrêtée — 13 août 2026.**

En l'état initial du brief, le parcours passager s'arrêtait à la porte du véhicule : [§20](#20-qr-code) faisait du QR Code le mécanisme principal de validation, [§23](#23-interface-administration) affichait une statistique « billets validés » et [§30](#30-structure-logique-des-données) prévoyait une entité `TicketValidation` — mais aucune interface ne permettait de scanner quoi que ce soit.

### Qui valide

La validation est portée par un **rôle par défaut `AGENT`** du système RBAC ([§9](#9-système-de-rôles-et-permissions)), doté d'un jeu de permissions minimal :

```text
tickets.validate     valider un billet à l'embarquement
trips.view           consulter les trajets de son agence
```

Aucun mécanisme spécifique n'est nécessaire : `AGENT` est un rôle par défaut de plus, ses permissions restent de la donnée et non du code.

**Les comptes du personnel sont créés par l'agence** depuis son back-office, comme elle gère déjà ses chauffeurs.

**Pourquoi un rôle distinct plutôt que le compte agence.** La personne à la porte du car est un agent de gare, un convoyeur, parfois le chauffeur. Avec le compte agence, elle accéderait au chiffre d'affaires, à la modification des prix, à l'annulation des départs et **aux coordonnées de reversement**. Le vecteur de fraude identifié en [B4](#b4--flux-financier-et-reversement-aux-agences) deviendrait trivial dès lors que le login de l'agence circule entre plusieurs employés.

Le rôle est **fonctionnel et non lié à un métier** : l'agence décide qui le porte. Un chauffeur peut l'assumer sans que cela contredise l'absence d'application chauffeur ([§3](#3-utilisateurs)) — il s'agit de la même page web que pour un agent de gare, pas d'une application dédiée.

Les rôles personnalisés définis par chaque agence sont hors MVP ([§31](#31-fonctionnalités-hors-mvp)).

### Tolérance au réseau

Une validation exigeant une requête serveur ne fonctionne pas dans une gare sans couverture — c'est-à-dire précisément là où elle est nécessaire. La validation strictement en ligne est donc écartée.

**Mécanisme retenu** : l'agent ouvre le départ, l'écran télécharge la **liste d'embarquement**, les scans sont vérifiés **localement**, et les validations sont mises en file puis synchronisées au retour du réseau.

L'écran d'embarquement est donc une **PWA** — service worker, cache local, icône sur l'écran d'accueil. C'est la seule partie du produit qui justifie réellement ce surcoût sur l'application React.

**Coût explicitement accepté : la double validation devient possible hors ligne.** Deux agents disposant de la liste peuvent valider le même billet. Le serveur détecte le doublon à la synchronisation et le signale — c'est une anomalie à remonter, non une fraude à bloquer, les deux agents relevant de la même agence.

**Convergence des décisions** : la fermeture des ventes en ligne à H-30 ([B2](#b2--réservation-temporaire-des-places-pendant-le-paiement)) et le délai limite d'annulation passager à H-2 ([B5](#b5--annulation-et-remboursement)) font qu'aucun passager ne peut annuler entre le téléchargement de la liste et l'embarquement. Le risque de liste périmée se limite aux seules actions de l'agence.

### Trois niveaux de secours

1. **Scan** par la caméra du navigateur.
2. **Saisie manuelle** du numéro de réservation — caméra défaillante, QR abîmé sur un billet imprimé, écran fissuré.
3. **Liste d'embarquement imprimable**, avec noms et places.

Le troisième niveau n'est pas un confort. Une agence bloquée à la porte de son car un vendredi soir n'utilisera plus jamais le système ; le retour au papier doit rester possible à tout instant.

Note technique : sur les Android d'entrée de gamme équipés d'un navigateur ancien, l'API de détection de codes-barres peut être absente. Une bibliothèque JS de repli est à prévoir.

### Ce que l'agent voit

Un résultat doit être lisible en plein soleil, à une main, en deux secondes. Un simple « invalide » est inexploitable : l'agent doit savoir **pourquoi**.

| Cas | Message attendu |
|---|---|
| Billet valide | validation enregistrée, nom et place affichés |
| Déjà validé | avec l'heure et l'agent ayant validé |
| Billet pour un autre départ | cas le plus fréquent — passager s'étant trompé d'heure ou de car |
| Réservation annulée | motif affiché |
| Référence inconnue | aucune correspondance dans la liste |

Sur une réservation de groupe, l'écran affiche un compteur — « 2/3 validés » — pour que l'agent sache qui manque encore.

### Un billet par passager

Un billet correspond à **un passager et un QR Code**, conformément à [§19](#19-billet-électronique) qui porte un nom et une place, et au remboursement partiel au niveau du siège acté en [B5](#b5--annulation-et-remboursement).

### Effet financier : aucun

La validation ne conditionne aucun flux financier, et le `NO_SHOW` reste purement informatif ([B5](#b5--annulation-et-remboursement)). Une agence n'est donc pas payée en fonction de ses scans.

**Conséquence sur l'adoption** : l'incitation à scanner ne peut pas être contractuelle, elle doit être **utile**. La liste d'embarquement remplace le cahier, le scan détecte les billets présentés deux fois, et les validations alimentent le tableau de bord de l'agence. Si l'écran n'est qu'une contrainte imposée par MOTOBOY, il ne sera pas utilisé — même logique que pour la vente au guichet ([I2](#i2--vente-au-guichet)).

### Fermeture de la machine à états

Après le départ, les réservations restées `CONFIRMED` et non embarquées basculent automatiquement en `NO_SHOW` par un job en queue, ce qui referme le cycle de vie défini en [B2](#b2--réservation-temporaire-des-places-pendant-le-paiement).

### Impacts sur le reste du document

- rôle `AGENT` ajouté aux rôles par défaut de [§9](#9-système-de-rôles-et-permissions) ;
- mécanisme de validation précisé dans [§20](#20-qr-code) ;
- sections « Personnel » et « Embarquement » ajoutées à [§22](#22-interface-agence) ;
- doublons de validation signalés dans [§23](#23-interface-administration) ;
- entité `TicketValidation` détaillée dans [§30](#30-structure-logique-des-données) ;
- rôles personnalisés par agence ajoutés au hors MVP [§31](#31-fonctionnalités-hors-mvp).

---

## B4 — Flux financier et reversement aux agences

**Décision arrêtée — 13 août 2026 : encaissement centralisé, avec des conditions de reversement paramétrables par agence.**

### Modèle retenu

MOTOBOY encaisse la totalité du paiement passager, déduit sa commission, et reverse la part de l'agence à échéance.

```text
Passager
   ↓ paie
Agrégateur ──→ Compte MOTOBOY
                    ↓
              Payment  (montant brut)
                    ↓
             Commission  (part MOTOBOY)
                    ↓
             AgencyLedger  (compte courant de l'agence)
                    ↓
              Payout  (solde de la période)
                    ↓
             Reversement à l'agence
```

Le **paiement partagé** — éclatement des fonds dès l'encaissement par l'agrégateur — est écarté pour le MVP : il rendrait les remboursements ([B5](#b5--annulation-et-remboursement)) ingérables, puisqu'il faudrait récupérer l'argent déjà versé à l'agence, et il imposerait à chaque agence d'ouvrir un compte marchand chez l'agrégateur avant de pouvoir publier un seul trajet.

### Compte courant par agence

Le suivi financier repose sur un **compte courant** plutôt que sur un calcul par période. Ce choix absorbe naturellement les soldes négatifs, les régularisations tardives et les corrections manuelles.

```text
AgencyLedger  (solde courant)
   ├── + crédit : réservation confirmée         (montant brut)
   ├── − débit  : commission MOTOBOY
   ├── − débit  : remboursement passager
   ├── − débit  : commission sur vente guichet   (si activée)
   ├── − débit  : ajustement manuel              (motif obligatoire + audit)
   └── − débit  : reversement effectué
```

Un reversement n'est alors qu'une opération de solde du compte jusqu'à une date donnée.

### Paramètres commerciaux par agence

Ces paramètres forment le **contrat commercial** de l'agence. Ils sont définis par l'administration à la validation de l'agence, consultables par l'agence, et modifiables uniquement par l'administration — ce sont des termes négociés, pas un réglage en libre-service.

| Paramètre | Valeur par défaut | Bornes autorisées |
|---|---|---|
| Délai d'éligibilité après le départ | 24 h | 0 h à 168 h (7 jours) |
| Fréquence de reversement | Hebdomadaire, lundi | Hebdomadaire ou mensuelle |
| Seuil minimum de reversement | à fixer | au moins 10× le coût unitaire d'un décaissement |
| Porteur des frais d'agrégateur | MOTOBOY | MOTOBOY ou Agence |
| Commission sur vente guichet | Désactivée | Activée ou désactivée |
| Type de commission | à fixer | Pourcentage ou montant fixe |

**Trois bornes sont volontairement fermées :**

1. **Le reversement avant le départ est exclu.** C'est la seule configuration qui crée une créance irrécupérable : un remboursement survenant après un versement Mobile Money ne se récupère pas par une procédure, seulement par la bonne volonté de l'agence.
2. **Le passager ne peut pas porter les frais d'agrégateur.** Le prix affiché divergerait du prix guichet de l'agence — un comparateur qui n'affiche pas le vrai prix perd sa raison d'être.
3. **Une cadence de reversement plus rapide que la valeur par défaut multiplie les frais de décaissement.** Si elle est accordée, ces frais sont portés par l'agence qui la demande.

### Règle impérative : les conditions sont figées à la réservation

Les valeurs de commission, de porteur de frais et de délai applicables sont **recopiées sur la réservation au moment où elle est créée**. Le calcul d'un reversement ne doit jamais lire les paramètres courants de l'agence.

Sans cette règle, modifier un taux de commission réécrit rétroactivement l'historique financier de toutes les réservations passées — y compris celles déjà reversées et déjà justifiées à l'agence.

### Cycle de vie d'un reversement

Le calcul est automatique, le déclenchement est manuel.

```text
DRAFT               calcul automatique du solde éligible
   ↓
PENDING_VALIDATION  proposition soumise à l'administration
   ↓
APPROVED            validée par un administrateur (tracé dans l'AuditLog)
   ↓
PROCESSING          décaissement envoyé à l'agrégateur
   ↓
PAID | FAILED
```

Les premiers mois produiront des cas non anticipés — remboursement arrivé en retard, réservation contestée, coordonnées erronées. Un décaissement Mobile Money du mauvais montant est quasi irréversible : la validation humaine reste le garde-fou tant que le volume ne la rend pas impraticable.

Une réservation devient éligible lorsque son trajet est parti **et** que le délai configuré est écoulé.

### Coordonnées de reversement

Chaque agence déclare un numéro Mobile Money ou un compte bancaire, capturé et **vérifié** lors de la validation de l'agence ([§23](#23-interface-administration)). Une erreur de saisie envoie l'argent à un inconnu, sans recours.

**Le changement de coordonnées de reversement est un vecteur de fraude classique** — compromission du compte agence, modification du numéro, attente du jour de paie. Cette opération doit donc :

- être validée par l'administration, jamais appliquée en libre-service ;
- être journalisée dans l'AuditLog ([§28](#28-audit)) avec ancienne et nouvelle valeur ;
- déclencher une notification vers les contacts connus de l'agence.

### Justificatif

L'agence dispose d'un relevé téléchargeable par période : réservations incluses, montant brut, commission, remboursements déduits, ajustements, net versé, référence du transfert. C'est ce document qui évite les litiges répétés sur les montants.

### Réconciliation quotidienne

Un job quotidien confronte la liste des transactions de l'agrégateur aux `Payment` enregistrés, et signale tout écart. Sans ce contrôle, le cas « le passager a payé mais n'a pas de billet » — webhook perdu — n'est jamais détecté autrement que par une réclamation. À relier à [I7](#i7--observabilité).

### Impacts sur le reste du document

- module `Payouts` ajouté dans [§6](#6-architecture-générale) ;
- entités `AgencyLedger`, `LedgerEntry`, `Payout`, `PayoutLine`, `AgencyCommercialTerms` ajoutées dans [§30](#30-structure-logique-des-données) ;
- section « Reversements » ajoutée à l'espace agence [§22](#22-interface-agence) ;
- sections « Reversements » et « Paramètres commerciaux » ajoutées à l'administration [§23](#23-interface-administration) ;
- règle de figement des conditions ajoutée à [§26](#26-commission).

### Deux points restent ouverts

**1. Le point réglementaire — à faire vérifier, pas à trancher en interne.**
Détenir des fonds pour le compte de tiers est une activité encadrée dans la plupart des juridictions, et la zone CEMAC dispose de son propre cadre pour les services de paiement. Savoir si MOTOBOY doit disposer d'un statut propre ou peut opérer en tant que marchand sous la licence de son agrégateur **doit être posé tôt à un conseil local** : une réponse défavorable remettrait en cause le modèle d'encaissement centralisé retenu ici.

**2. Le choix de l'agrégateur**, à instruire sur les capacités suivantes — chacune est éliminatoire :

| Capacité | Pourquoi |
|---|---|
| Collecte MTN **et** Orange Money | Un seul opérateur ampute le marché |
| Remboursement par API, total et partiel | Sans cela, [B5](#b5--annulation-et-remboursement) devient un processus manuel |
| Décaissement par API vers Mobile Money | C'est ce qui automatise les reversements |
| Webhooks fiables + consultation des transactions | Indispensable à la réconciliation |
| Frais de collecte, remboursement et décaissement | Détermine le taux de commission viable |
| Délai de mise à disposition des fonds | Impacte la trésorerie et la cadence de reversement |
| Environnement de test | Sans sandbox, le développement se fait sur de l'argent réel |

---

## B5 — Annulation et remboursement

**Décision arrêtée — 13 août 2026.** Deux scénarios distincts, traités séparément, plus quatre cas de remboursement forcé partageant la même machinerie.

### A. Annulation à l'initiative du passager

**Un seul seuil**, pas de grille dégressive : jusqu'au délai limite, remboursement moins les frais d'annulation ; au-delà, non remboursable. Une grille à paliers serait plus juste mais indéfendable à expliquer sur un écran de téléphone.

La logique économique du seuil : une annulation précoce laisse à l'agence le temps de revendre la place, une annulation tardive lui fait perdre le siège.

**Calcul et répartition :**

```text
Remboursement passager = Montant payé − Frais d'annulation

Répartition des frais d'annulation retenus :
   1. Frais réels d'agrégateur (collecte + remboursement) → MOTOBOY
   2. Solde                                              → Agence

Commission MOTOBOY : annulée, non prélevée
```

**MOTOBOY renonce à sa commission mais récupère ses frais réels.** La commission rémunère un transport qui a eu lieu ; la prélever sur un voyage qui n'a pas eu lieu serait indéfendable face à une agence, pour des montants dérisoires. En revanche les frais de transaction ont bien été engagés et ne doivent pas être supportés par la plateforme. Le solde revient à l'agence, qui subit la perte réelle du siège.

Si les frais d'annulation retenus sont **inférieurs** aux frais réels d'agrégateur, MOTOBOY absorbe la différence.

**Paramètres, dans la logique de [B4](#b4--flux-financier-et-reversement-aux-agences) :**

| Paramètre | Valeur par défaut | Bornes autorisées |
|---|---|---|
| Délai limite d'annulation | H-2 | H-0 à H-48 |
| Frais d'annulation | à fixer (% ou montant fixe) | 0 % à 50 % du montant payé |

Une agence ne peut donc pas rendre une réservation intégralement non remboursable à l'intérieur de sa propre fenêtre. Elle peut en revanche réduire cette fenêtre jusqu'à 48 h.

**Effet secondaire assumé** : les conditions d'annulation varient d'une agence à l'autre et deviennent donc un **critère de comparaison affiché dans les résultats** ([§11](#11-recherche)). C'est un argument commercial pour les agences souples, pas une complication.

### B. Annulation à l'initiative de l'agence

Le cas le plus fréquent sur le terrain — panne, effectif insuffisant, route coupée — et le plus lourd : plusieurs dizaines de passagers déjà payés, souvent prévenus la veille au soir ou le matin même.

**Règle : remboursement intégral automatique, sans frais, déclenché par l'annulation du trajet.** Pas de validation manuelle, pas d'attente. Motif obligatoire à la saisie — panne, effectif insuffisant, route coupée, autre.

**Rembourser d'abord, proposer ensuite.** Le transfert des passagers vers un autre départ n'est **pas** retenu pour le MVP : il impliquerait de gérer les différences de prix, la disponibilité, la resélection de sièges et les groupes transférables seulement en partie — un chantier à part entière. Le passager est remboursé automatiquement et reçoit des alternatives dans sa notification ([§21](#21-recherche-dalternatives)) ; s'il le souhaite, il réserve normalement.

Le **transfert de réservation vers un autre départ** est reporté hors MVP ([§31](#31-fonctionnalités-hors-mvp)).

**Notification immédiate sur tous les canaux, SMS compris.** C'est précisément le cas où le coût du SMS ([I8](#i8--coût-des-sms)) est justifié : un passager qui se déplace vers une gare pour un car annulé est un passager perdu définitivement.

**Garde-fou — taux d'annulation par agence.** Suivi en administration, avec un seuil déclenchant une revue. Seules les annulations de départs **portant des réservations confirmées** entrent dans la statistique : supprimer un départ généré non assuré relève de la gestion de planning ([I1](#i1--trajets-récurrents)), pas de l'incident. Une agence qui annule un départ sur cinq détruit la confiance dans la plateforme entière, pas seulement dans sa propre offre.

**Interaction avec le reversement** : le délai d'éligibilité de 24 h après départ ([B4](#b4--flux-financier-et-reversement-aux-agences)) garantit qu'une annulation agence intervient toujours **avant** que les fonds ne soient sortis. Le compte courant absorbe l'opération sans créance à récupérer.

### C. Modification importante du voyage

[§24](#24-notifications) prévoit la notification sans définir le seuil. Est considérée comme importante :

- un décalage d'horaire supérieur à **30 minutes** ;
- un changement de date ;
- un changement de gare de départ.

**Conséquence : notification, et droit à annulation gratuite avec remboursement intégral**, quel que soit le délai restant avant le départ.

**Règle associée** : le prix d'un trajet ne peut **jamais** être modifié pour les réservations déjà confirmées. Une modification tarifaire ne s'applique qu'aux réservations futures — même principe de figement qu'en [B4](#b4--flux-financier-et-reversement-aux-agences).

### D. Cas connexes

**Annulation partielle.** Trois places réservées, une annulée : supportée dès le MVP. Le remboursement s'applique au niveau du passager/siège, pas de la réservation entière. Impose le remboursement partiel côté agrégateur — déjà présent dans la grille de sélection de [B4](#b4--flux-financier-et-reversement-aux-agences).

**No-show.** Le passager ne se présente pas : aucun remboursement, l'agence est payée normalement. Le statut reste **purement informatif et ne déclenche aucun flux financier** — condition indispensable, car une agence qui scanne mal marquerait des passagers réels comme absents.

**Deux remboursements forcés** réutilisant la même machinerie, avec remboursement intégral automatique et proposition d'alternatives :

- paiement aboutissant après expiration du hold, place déjà revendue ([B2](#b2--réservation-temporaire-des-places-pendant-le-paiement)) ;
- double paiement détecté ([§17](#17-paiement)).

### Règles non négociables

**1. Le remboursement part toujours vers le compte source.** Jamais vers un numéro déclaré après coup par le passager. Dans le cas contraire, le circuit « je réserve, j'annule, je me fais rembourser sur un autre numéro » devient un vecteur de fraude immédiat.

Conséquence à assumer et à afficher explicitement au passager : un paiement effectué depuis le Mobile Money d'un proche — cas courant — sera remboursé sur ce téléphone.

**2. La politique d'annulation est affichée avant le paiement et figée sur la réservation.** Si une agence durcit ses conditions, les réservations existantes conservent celles en vigueur au moment de l'achat.

### Modèle

L'entité `Refund` est portée par le module `Payments` ([§6](#6-architecture-générale)) :

```text
Refund
   ├── booking_id, payment_id
   ├── montant (total ou partiel, au niveau du passager/siège)
   ├── motif : PASSENGER_REQUEST | AGENCY_TRIP_CANCELLED | TRIP_MODIFIED
   │           | LATE_PAYMENT | DUPLICATE_PAYMENT | ADMIN_ADJUSTMENT
   ├── initié_par, provider_ref, idempotency_key
   └── statut : PENDING → PROCESSING → COMPLETED | FAILED
```

Un remboursement en statut `FAILED` place le passager dans le pire état possible — sans argent et sans billet. Il doit donc être **rejoué automatiquement puis remonté en alerte à l'administration** s'il échoue à nouveau, jamais laissé silencieux.

Chaque remboursement génère une ligne de débit au compte courant de l'agence ([B4](#b4--flux-financier-et-reversement-aux-agences)).

---

## B6 — Escales et réservation par tronçon

**Problème.** [§12](#12-gestion-des-trajets) et [§22](#22-interface-agence) prévoient la saisie d'escales, et [§11](#11-recherche) les affiche dans les résultats. Mais le brief ne dit pas si un passager peut **réserver sur un tronçon**.

**Enjeu.** C'est une décision structurante pour tout le modèle d'inventaire. Si un passager peut réserver Douala → Nkongsamba sur un véhicule qui continue vers Bafoussam, la disponibilité cesse d'être un simple compteur par trajet et devient un problème d'occupation par segment : un siège peut être libre sur la première moitié du parcours et occupé sur la seconde. Le calcul de disponibilité, la sélection des sièges, la tarification et la recherche sont tous impactés.

**Décision arrêtée — 13 août 2026 : point-à-point uniquement pour le MVP.** Les escales restent **purement informatives** : elles s'affichent dans les résultats et sur le billet, mais ne sont pas réservables. La réservation par tronçon est reportée hors MVP.

Reportée dans [§12](#12-gestion-des-trajets) et ajoutée à la liste [§31](#31-fonctionnalités-hors-mvp).

Conséquences retenues pour la conception :

- la disponibilité d'un `Trip` est un **compteur unique**, ou un **plan de sièges unique**, valable sur tout le parcours ;
- aucune occupation par segment, donc aucun calcul de disponibilité par tronçon ;
- le tarif est **unique par `Trip`** — pas de grille tarifaire par segment ;
- les escales sont un attribut d'affichage porté par la `Route`, sans impact sur l'inventaire ;
- la recherche ne fait correspondre une requête qu'aux couples **départ / destination finale** d'un `Trip` — une ville d'escale ne rend pas un trajet éligible aux résultats.

---
---

# Partie III — Points importants

> Ces points ne bloquaient pas la conception du modèle de données, mais chacun pouvait compromettre l'adoption, la marge ou l'exploitabilité du produit. **Tous sont désormais tranchés.**

| | Point | Statut |
|---|---|---|
| I1 | Trajets récurrents | ✅ **tranché** — niveau `Schedule`, horizon glissant de 30 jours |
| I2 | Vente au guichet | ✅ **tranché** — parcours en moins de 30 s, sans compte, paiement `CASH` |
| I3 | Rôle Propriétaire | ✅ **tranché** — espace en lecture seule, sans circuit financier |
| I4 | Administrateur vs Super administrateur | ✅ **tranché** — exploitation vs configuration |
| I5 | Réseau faible et mode hors ligne | ✅ **tranché** — billet en cache, QR regénéré localement |
| I6 | Un seul design system | ✅ **tranché** — Tailwind / shadcn |
| I7 | Observabilité | ✅ **tranché** — erreurs, files, journal des webhooks |
| I8 | Coût des SMS | ✅ **tranché** — SMS réservé au critique et au sans-alternative |
| I9 | Cas « aucun résultat » | ✅ **tranché** — dates proches et axes desservis |
| I10 | Internationalisation | ✅ **tranché** — français et anglais dès le lancement |

## I1 — Trajets récurrents

**Décision arrêtée — 13 août 2026.**

[§12](#12-gestion-des-trajets) définit un trajet comme un voyage daté. Si une agence doit ressaisir manuellement ses six départs quotidiens chaque matin, elle arrêtera au bout d'une semaine, et l'application affichera des données mortes — ce qui tue un comparateur plus sûrement qu'une absence d'offre.

### Niveau `Schedule`

La `Route` porte l'itinéraire et les gares ([B1](#b1--référentiel-géographique)) ; un niveau intermédiaire porte les horaires.

```text
Route      itinéraire, gares, escales, durée de référence
   └── Schedule    jours de la semaine, heure de départ,
                   véhicule et tarif par défaut, période de validité
          └── Trips   générés sur un horizon glissant
```

Le `Schedule` est distinct de la `Route` parce qu'une même liaison porte souvent plusieurs départs de nature différente : un VIP à 08:00 et un classique à 14:00 n'ont ni le même véhicule ni le même tarif.

### Règles de génération

- **Horizon glissant de 30 jours**, alimenté par un job quotidien. Un horizon plus court empêcherait de réserver à l'avance pour les périodes de fête, précisément lorsque la demande culmine.
- **La génération ne modifie jamais un trajet existant.** Elle crée uniquement les départs manquants ; sans cette règle, une régénération écraserait un trajet portant déjà des réservations.
- **Modifier un `Schedule` n'affecte pas les départs déjà générés.** Le changement s'applique aux trajets créés ensuite ; les départs existants se modifient individuellement. Même principe de figement qu'en [B4](#b4--flux-financier-et-reversement-aux-agences) et [B5](#b5--annulation-et-remboursement).

### Exceptions de planning

Supprimer un départ généré que l'agence n'assurera pas — jour férié, basse saison — passe par le mécanisme d'annulation de [B5](#b5--annulation-et-remboursement).

**Ces annulations n'entrent pas dans le taux d'annulation de l'agence.** Seules comptent les annulations de départs **portant des réservations confirmées** ; pénaliser une agence pour une gestion de planning normale rendrait la statistique inexploitable.

### Changement de véhicule sur un départ réservé

- vers un véhicule de capacité **supérieure ou égale** : libre ;
- vers un véhicule de capacité **inférieure** : bloqué tant que les réservations excédentaires n'ont pas été traitées.

Un changement de plan de sièges constitue une « modification importante » au sens de [B5](#b5--annulation-et-remboursement) et ouvre donc un droit d'annulation gratuite.

## I2 — Vente au guichet

**Décision arrêtée — 13 août 2026.**

Ce point porte toute l'intégrité des données de disponibilité : si une agence vend vingt places au comptoir sans les saisir, MOTOBOY affiche des places qui n'existent pas, et le passager se déplace pour rien.

### Le critère est la vitesse

Si saisir une vente au comptoir prend plus de temps que d'écrire une ligne dans le cahier, l'agence ne le fera pas. Le parcours doit tenir en **moins de 30 secondes** : choisir le départ, choisir la place, saisir nom et téléphone, terminer.

Trois conséquences directes :

- **Le passager n'a pas de compte.** Nom et numéro de téléphone suffisent — aucune inscription, aucun OTP. C'est une vente au comptoir, pas un tunnel de conversion.
- **La réservation est créée directement en `CONFIRMED`**, sans hold ni tunnel de paiement ([B2](#b2--réservation-temporaire-des-places-pendant-le-paiement)) : l'argent est déjà encaissé.
- **Un paiement de méthode `CASH` est enregistré** pour que statistiques et compte courant restent cohérents. Il ne transite jamais par l'agrégateur.

### Remise du billet

Le billet est **imprimé au comptoir et envoyé par SMS**.

L'envoi SMS est toutefois **désactivable par agence**. C'est le seul cas où la plateforme paie un SMS sur une vente ne portant aucune commission ([B4](#b4--flux-financier-et-reversement-aux-agences)) : à volume élevé, la fuite devient nette, et le levier doit exister avant d'en avoir besoin.

### Rappels des décisions liées

- Aucune commission sur la vente guichet par défaut, activable par agence ([B4](#b4--flux-financier-et-reversement-aux-agences)).
- Les places tenues par un paiement en ligne sont indisponibles au guichet, avec leur échéance affichée ([B2](#b2--réservation-temporaire-des-places-pendant-le-paiement)).
- La vente au guichet reste ouverte jusqu'au départ, alors que la vente en ligne ferme 30 minutes avant.

## I3 — Rôle Propriétaire

**Décision arrêtée — 13 août 2026 : le propriétaire dispose d'un espace de consultation, sans aucune relation financière portée par la plateforme.**

Le document se contredisait : [§4](#4-applications) lui attribuait un espace React, mais [§32](#32-mvp-final) et [§33](#33-architecture-mvp-finale) ne le mentionnaient plus. La contradiction est levée en faveur du maintien — l'espace est confirmé et rattaché aux deux sections qui l'omettaient.

### Ce que l'espace contient

Consultation seule, aucune action :

- ses véhicules, leur état et leur affectation ;
- les départs assurés par ces véhicules ;
- le taux de remplissage.

### Ce que l'espace ne contient pas

**Aucun circuit financier.** Le propriétaire ne dispose ni de compte courant, ni de calcul de part, ni de reversement. Si une rémunération le lie à l'agence, elle se règle entre eux, hors plateforme.

C'est la frontière qui préserve le périmètre du MVP : ouvrir un reversement propriétaire reviendrait à reconstruire intégralement [B4](#b4--flux-financier-et-reversement-aux-agences) une seconde fois.

### Visibilité du chiffre d'affaires

Le revenu généré par un véhicule est une donnée commerciale de l'agence. Il est donc **masqué par défaut**, et son affichage est activable par l'agence, véhicule par propriétaire.

Ce point relève du jugement plutôt que d'une contrainte technique : à ajuster si le rapport de force avec les propriétaires de véhicules l'impose sur le terrain.

### Comptes et rattachement

Le rôle `OWNER` existe déjà dans le RBAC ([§9](#9-système-de-rôles-et-permissions)), avec des permissions strictement en lecture.

L'agence rattache un véhicule à un propriétaire par son numéro de téléphone, depuis [§22](#22-interface-agence) ; le compte est créé s'il n'existe pas. Un propriétaire dont les véhicules sont confiés à plusieurs agences les retrouve tous dans le même espace.

## I4 — Administrateur vs Super administrateur

**Décision arrêtée — 13 août 2026.** Le partage se fait entre exploitation quotidienne et configuration de la plateforme.

| Rôle | Périmètre |
|---|---|
| `ADMIN` | Exploitation quotidienne : validation des agences, modération des gares, traitement des remboursements et des reversements, support. |
| `SUPER_ADMIN` | Tout ce qui précède, plus la gestion des comptes administrateurs, la configuration de la plateforme (bornes des paramètres commerciaux, pays, référentiel géographique) et l'accès à l'AuditLog. |

Le RBAC de [§9](#9-système-de-rôles-et-permissions) permet de déplacer une permission d'un rôle à l'autre sans refonte, si le partage s'avère mal calibré à l'usage.

## I5 — Réseau faible et mode hors ligne

**Décision arrêtée — 13 août 2026.**

Le produit s'utilise en gare routière, où la couverture n'est pas garantie. Deux exigences, dont une déjà satisfaite.

**Côté agent** — réglé par [B3](#b3--validation-du-billet-à-lembarquement) : PWA, liste d'embarquement pré-téléchargée, validations mises en file et synchronisées au retour du réseau.

**Côté passager** — le billet doit rester consultable **sans réseau** dans l'application mobile. Cela suppose de le mettre en cache localement et de **regénérer le QR Code à partir des données stockées**, plutôt que de le télécharger comme une image : un billet dont le QR ne s'affiche pas en gare ne vaut rien.

## I6 — Un seul design system

**Décision arrêtée — 13 août 2026 : Tailwind / shadcn pour l'ensemble de l'application web.**

[§7](#7-stack-technique) et [§34](#34-stack-finale) laissaient le choix entre « Tailwind / shadcn ou Ant Design selon les interfaces ». Dans une application React unique ([§4](#4-applications)), embarquer deux design systems doublerait le bundle, produirait une expérience incohérente entre les espaces et doublerait la maintenance.

### Conséquence à assumer

Ant Design aurait fourni tableaux, formulaires et sélecteurs de dates prêts à l'emploi — ce qui pèse lourd sur un back-office aussi dense que celui-ci. En partant sur shadcn, cette machinerie est à construire, et les briques correspondantes doivent figurer dans la stack dès le départ :

| Besoin | Brique |
|---|---|
| Tableaux — tri, filtres, pagination | TanStack Table |
| Formulaires | react-hook-form, validé par Zod (déjà présent) |
| Sélecteurs de dates | react-day-picker (socle du composant shadcn) |

Sans ces ajouts explicites, la difficulté se découvre en pleine construction du back-office.

En contrepartie, les pages publiques et l'espace passager conservent une identité propre plutôt qu'une apparence d'outil d'administration.

## I7 — Observabilité

**Décision arrêtée — 13 août 2026.** Trois briques, non négociables sur un produit qui encaisse de l'argent et dépend de webhooks tiers.

| Brique | Ce qu'elle évite |
|---|---|
| Suivi des erreurs, backend et frontend | Des échecs silencieux découverts par les réclamations |
| Supervision des files Laravel | Un job de libération de places bloqué gèle l'inventaire sans alerte |
| Journal traçable des webhooks de paiement — reçus, rejoués, échoués | Un paiement perdu devient indébogable |

Le journal des webhooks complète la réconciliation quotidienne définie en [B4](#b4--flux-financier-et-reversement-aux-agences) : la réconciliation détecte l'écart, le journal explique pourquoi il s'est produit.

## I8 — Coût des SMS

**Décision arrêtée — 13 août 2026.** Trois SMS par réservation ruineraient la marge face à la commission unitaire ([§26](#26-commission)). Le push étant gratuit, le SMS est réservé à ce qui est réellement critique ou sans alternative.

| Événement | Canal |
|---|---|
| OTP d'inscription ([§8](#8-authentification)) | SMS — aucune alternative |
| Annulation par l'agence ([B5](#b5--annulation-et-remboursement)) | SMS — systématique |
| Confirmation de réservation | Push si disponible, SMS en repli |
| Rappel de départ | Push uniquement |
| Billet de vente au guichet ([I2](#i2--vente-au-guichet)) | SMS, désactivable par agence |

Le repli SMS sur la confirmation est indispensable : un passager réservant depuis le web n'a pas l'application, donc pas de push.

Toutes ces notifications sont **localisées côté serveur** — `users.locale` pour un compte, langue par défaut de l'agence pour un passager de vente au guichet ([I10](#i10--internationalisation)).

## I9 — Cas « aucun résultat »

**Décision arrêtée — 13 août 2026.**

Au lancement, avec une couverture encore faible, la recherche vide sera fréquente — et un passager déçu deux fois ne revient pas.

**Repli retenu pour le MVP** : afficher les **dates proches disponibles** sur le même axe, et les **axes desservis** au départ de la même ville.

**L'alerte de disponibilité** — prévenir le passager lorsqu'une offre apparaît sur le trajet recherché — est plus utile encore, mais suppose une recherche sauvegardée et un job de correspondance. Elle est reportée juste après le MVP ([§31](#31-fonctionnalités-hors-mvp)).

---
---

# Partie IV — Extensions post-MVP

*Ce qui a été demandé après la validation du brief. Chaque extension y figure
avec ce qu'elle change au produit, et surtout avec ce qu'elle ne fait pas — une
fonctionnalité dont on n'a pas écrit les limites finit par se les voir prêter.*

## E1 — Appel de service

**Décision arrêtée — 17 août 2026 : un passager peut demander un véhicule à la
demande, et des chauffeurs indépendants répondent par des offres.**

Le détail des fonctionnalités et des écrans est dans un document à part :
[Appel de service](APPEL-DE-SERVICE.md). Ce qui suit fixe les décisions ; ce
document-là décrit ce qu'on en fait.

« Je suis à Bafang et j'ai besoin d'un véhicule. » Le MVP ne sait pas répondre à
cette phrase : il compare des **départs programmés**, avec un stock de places, un
horaire et un prix connus d'avance. L'appel de service n'a rien de tout cela — pas
de stock, pas d'horaire, pas de prix affiché. Le problème central passe de
*comparer* à *apparier*.

### Ce qui reste du produit

**MOTOBOY compare, et continue de comparer.** Pour un départ programmé, il
compare des agences ; pour un appel de service, il compare des **offres de
chauffeurs**. C'est la même promesse faite au passager, appliquée à un autre
inventaire.

Ce n'est pas qu'une formule : c'est ce qui résout le prix sans barème
kilométrique. Il n'existe aucune table de distances entre localités, et en
construire une pour couvrir le Cameroun est un projet en soi. Le chauffeur
propose son prix, le passager choisit — le marché fixe le tarif, comme il le fait
déjà en gare routière.

## E2 — Chauffeurs indépendants

**Décision arrêtée — 17 août 2026 : les chauffeurs de l'appel de service sont des
indépendants, sans agence.**

C'est le choix le plus lourd de l'extension, et il faut en mesurer la portée.

### Ce qui n'est pas réutilisable

| Existant | Pourquoi il ne convient pas |
|---|---|
| `drivers` | Lié à `agency_id` : c'est du personnel, créé par un gestionnaire d'agence |
| `vehicles` | Possédé par une agence, avec sa modération de documents |
| `agency_ledger_entries` | Le grand livre ne connaît que des agences comme bénéficiaires ([B4](#b4--flux-financier-et-reversement-aux-agences)) |

Fusionner les deux populations dans `drivers` imposerait un `agency_id` nullable
et un « de quel genre est ce chauffeur ? » dans chaque requête d'agence. La
première requête qui l'oublie fait apparaître un indépendant dans le planning
d'une agence.

### Ce qu'il faut créer

Le chauffeur **n'est pas une nouvelle identité** : c'est un `User` portant le rôle
`DRIVER`, qui se connecte par OTP comme tout le monde ([§8](#8-authentification)).
S'y ajoute un profil chauffeur portant le permis, le véhicule, les documents et
le compte de reversement.

**Aucune course avant validation du dossier.** Permis, carte grise, pièce
d'identité et assurance passent par la file de modération de l'espace
administration, comme les gares le font déjà.

### Le risque à porter au client

Sans agence, **il n'y a plus de tiers responsable**. Aujourd'hui, un incident se
règle avec le transporteur ; demain, le passager n'aura que MOTOBOY en face de
lui. Transporter des personnes contre rémunération suppose par ailleurs des
autorisations : mettre en relation des chauffeurs qui n'en disposent pas expose
la plateforme.

Ce point n'est pas technique et ne se tranche pas dans ce document. Il est écrit
ici pour qu'il ne soit pas découvert après la mise en service.

## E3 — Position déclarée, pas GPS

**Décision arrêtée — 17 août 2026 : le passager déclare sa position ; aucune
géolocalisation n'est captée.**

Une ville prise dans le référentiel ([B1](#b1--référentiel-géographique)), plus un
point de repère en texte libre — « Bafang, carrefour Total ». Le chauffeur
répond sur cette base.

Aucune coordonnée n'existe aujourd'hui : les villes n'en ont pas, et les huit
gares ont leurs colonnes `latitude`/`longitude` vides. Passer au GPS ouvrirait la
cartographie, les permissions de localisation, le calcul de distance et le suivi
en arrière-plan — un chantier sans commune mesure, pour un gain qui reste à
démontrer sur un trajet interurbain qui se compte en heures.

## E4 — Flux financier

**Décision arrêtée — 17 août 2026 : le passager paie la plateforme, qui reverse au
chauffeur sur son compte Mobile Money.**

C'est le même circuit que [B4](#b4--flux-financier-et-reversement-aux-agences),
avec une personne comme bénéficiaire au lieu d'une agence. La commission reste
prélevable, et le chauffeur reçoit bien son argent sur son compte.

**L'alternative a été écartée.** Un paiement de la main à la main placerait la
course entièrement hors de la plateforme : aucune commission ne serait
prélevable, et les deux parties auraient intérêt à contourner l'application — le
chauffeur garde tout, le passager obtient un rabais. La fonctionnalité
deviendrait un tableau d'annonces qui coûte des SMS.

### Conséquence sur le grand livre

Le seul point de sortie d'argent est indexé sur `agency_id`. Il faut le
**généraliser à un bénéficiaire**, agence ou personne, plutôt que dupliquer un
second grand livre : du code d'argent recopié diverge, et c'est celui dont la
divergence coûte le plus cher.

## E5 — Ce que l'extension ne fait pas

À dire avant de montrer un écran, pas après :

- **Ce n'est pas du VTC temps réel.** Pas de carte, pas de véhicule « à trois
  minutes », pas de suivi de la course. Le délai se compte en dizaines de
  minutes.
- **Pas de négociation.** Le chauffeur propose un prix ferme, le passager accepte
  ou non. Un échange de messages demanderait une messagerie, sa modération et son
  historique.
- **Pas de notation.** Elle suppose un volume qui n'existera pas au lancement, et
  une note bâtie sur trois avis nuit plus qu'elle n'informe.
- **Pas de course immédiate garantie.** Une demande sans offre expire ; le
  passager n'a alors rien, et l'écran doit le dire.

## E6 — Conséquences sur l'existant

| Chantier | Nature |
|---|---|
| Bénéficiaire généralisé dans les reversements | Refactor de code d'argent, couvert par les tests existants |
| Rôle `DRIVER`, profil, dossier et modération | Ajouts, sans reprise de l'existant |
| Module `Rides` | Contexte nouveau : demandes, offres, courses |
| Mode chauffeur dans l'application mobile | Les onglets dépendent du rôle — pas de seconde application |
| Notification des chauffeurs | Aucun push n'existe. En v1, le chauffeur consulte les demandes ouvertes de sa ville ; diffuser chaque demande par SMS coûterait trop cher |

### Garde-fous de concurrence

Deux index uniques partiels, sur le modèle de la double-vente de sièges
([B2](#b2--réservation-et-tenue-des-places)) : **un chauffeur n'a qu'une course
active**, et **une demande n'accepte qu'une offre**. Deux passagers qui acceptent
le même chauffeur à la seconde près : c'est la base qui refuse le second, pas la
logique applicative.

# Annexe A — Vocabulaire

Le mot « trajet » désigne deux choses différentes dans le document. À fixer pour éviter toute ambiguïté dans le code :

| Terme métier | Entité | Définition |
|---|---|---|
| Itinéraire | `Route` | Liaison entre deux lieux, indépendante d'une date. Ex. : Douala → Bafoussam par l'axe X. Porte l'itinéraire, les escales, la durée de référence. |
| Trajet / Départ | `Trip` | Instance datée d'un itinéraire. Ex. : Douala → Bafoussam, 14/08 à 08:00, véhicule Y. Porte la capacité, le tarif appliqué et les places. |
| Réservation | `Booking` | Engagement d'un passager sur un `Trip`, pour une ou plusieurs places. |
| Billet | `Ticket` | Document émis après confirmation du paiement d'un `Booking`. |
| Validation | `TicketValidation` | Enregistrement du contrôle d'un `Ticket` à l'embarquement. |

Convention retenue : **un `Trip` est toujours daté, une `Route` ne l'est jamais.**

---

# Annexe B — Incohérences internes relevées

Les trois incohérences identifiées lors de la consolidation sont désormais résolues :

1. ~~**Espace Propriétaire** — présent dans l'arborescence React de [§4](#4-applications), absent de [§32](#32-mvp-final) et [§33](#33-architecture-mvp-finale).~~ **Résolu** : l'espace est maintenu en consultation seule suite à [I3](#i3--rôle-propriétaire), et ajouté aux deux sections qui l'omettaient.
2. ~~**Validation des billets** — [§20](#20-qr-code) et [§23](#23-interface-administration) supposent une validation opérationnelle, mais aucune interface ne l'implémente dans [§22](#22-interface-agence).~~ **Résolu** : écran d'embarquement et rôle `AGENT` ajoutés suite à [B3](#b3--validation-du-billet-à-lembarquement).
3. ~~**Modules manquants** — `Places` et `Payouts` absents de [§6](#6-architecture-générale).~~ **Résolu** : `Places` ajouté suite à [B1](#b1--référentiel-géographique), `Payouts` suite à [B4](#b4--flux-financier-et-reversement-aux-agences).

---

## I10 — Internationalisation

**Décision arrêtée — 13 août 2026 : français et anglais dès le lancement.**

Ce point avait été manqué. Le brief ne mentionnait la langue nulle part, et la
stack s'orientait vers un produit francophone par défaut — sans que personne
l'ait décidé.

### Pourquoi ce n'est pas un sujet d'expansion

L'i18n paraissait relever de l'extension à d'autres pays annoncée en
[§2](#2-marché-cible). C'est une erreur de raisonnement.

**Le Cameroun a deux langues officielles.** Les régions du Nord-Ouest et du
Sud-Ouest sont anglophones — Bamenda, Buea et Limbe sont des destinations
interurbaines réelles, et Douala–Bamenda un axe fréquenté.

Un comparateur uniquement francophone n'exclut donc pas « les autres pays plus
tard » : il ampute une partie du marché de lancement, et l'ampute **par
défaut**.

### Surfaces servies

| Surface | Langues |
|---|---|
| Application mobile passager | français, anglais |
| Web public et espace passager | français, anglais |
| Espace agence et PWA d'embarquement | français, anglais — le personnel d'agence des régions anglophones l'est aussi |
| Administration | français seul — usage interne |

### Résolution de la langue

- **Passager avec un compte** : `users.locale`.
- **Passager de vente au guichet**, qui n'a pas de compte ([I2](#i2--vente-au-guichet)) : langue par défaut de l'agence.
- **Première inscription** : la langue est transmise à `POST /v1/auth/register`, car elle détermine celle de l'OTP — le tout premier message reçu, avant même que le compte existe.

### Erreurs — localisées côté client

Le champ `message` des réponses d'erreur devient un **diagnostic** : journaux,
exploitation, débogage. Il n'est jamais affiché et sa langue n'est pas garantie.

Les clients composent le texte visible à partir du `code` typé et de `details`.
La localisation des erreurs reste ainsi entièrement côté client, sans
négociation `Accept-Language` sur chaque endpoint.

Cette décision corrige aussi une contradiction : la spécification annonçait
`message` comme destiné à l'affichage, alors que le code client rendait déjà
depuis le `code`.

### Contenu généré par le serveur

Il n'y a pas d'échappatoire : SMS d'OTP, confirmations, annulation de départ,
billet de vente au guichet, notifications push et relevés téléchargeables des
agences sont localisés **côté serveur**, à partir de la langue résolue
ci-dessus.

Aucun de ces textes n'existe encore. Les écrire en français en dur serait se
garantir une extraction pénible plus tard.

### Ce qui n'a pas à être traduit

Les noms de villes, de gares et d'agences sont des noms propres — Douala reste
Douala. Les alias de villes ([B1](#b1--référentiel-géographique)) couvrent déjà
les variantes de saisie. La surface à traduire se limite aux textes
d'interface, aux libellés d'énumération et aux gabarits de notification.
