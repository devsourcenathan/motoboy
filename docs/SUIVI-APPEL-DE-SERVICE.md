# Appel de service — suivi

*Où en est le chantier. Décisions en [Partie IV du brief](BRIEF.md),
fonctionnalités et écrans dans [Appel de service](APPEL-DE-SERVICE.md), ordre de
construction en [§9 de la roadmap](ROADMAP.md).*

**Dernière mise à jour : 17 août 2026.**

## État d'ensemble

| Étape | État |
|---|---|
| 0. Spécification | ✅ fait |
| 1. Bénéficiaire généralisé des reversements | 🔨 en cours |
| 2. Compte chauffeur, dossier, modération | 🔨 en cours |
| 3. Module `Rides` — demandes, offres, courses | ⬜ |
| 4. Paiement et reversement de la course | ⬜ |
| 5. Écrans passager | ⬜ |
| 6. Écrans chauffeur | ⬜ |
| 7. Écrans administration (web) | ⬜ |

---

## 1. Bénéficiaire généralisé des reversements

**Pourquoi en premier.** C'est le seul point de sortie d'argent de la plateforme,
et il est indexé sur `agency_id`. Le généraliser maintenant, pendant que les
tests existants servent de filet, plutôt que d'écrire « en attendant » un second
grand livre qui ne se fusionnera jamais.

- [x] Recenser ce qui suppose une agence dans `Payouts`
- [x] Introduire le bénéficiaire (agence **ou** personne) — table `payees`
- [x] Migrer le grand livre sans perdre d'historique — reprise des agences
- [x] Les tests existants passent sans modification de leurs attentes — 177/177
- [ ] **Phase de contraction** : les appelants passent le bénéficiaire eux-mêmes,
      puis retrait du pont dans les modèles et de `agency_id` des deux tables

**Où on en est.** `payees` existe, avec une contrainte de base qui accorde le
genre et la cible : un `DRIVER` porte un utilisateur et pas d'agence, un `AGENCY`
l'inverse. Grand livre et reversements portent un `payee_id` obligatoire,
renseigné pour tout l'historique.

Le remplissage passe encore par un **pont dans les modèles**, qui dérive le
bénéficiaire de l'agence à la création. C'est délibérément transitoire : dériver
une colonne en silence se tient le temps d'une migration, pas durablement. Il
fallait éviter de toucher au schéma et aux six actions qui comptent l'argent dans
le même mouvement.

**Règle du chantier :** aucun test existant ne doit changer d'attente. S'il en
faut un, c'est que le comportement a bougé, et ce n'est pas ce qu'on veut.

## 2. Compte chauffeur

- [x] Rôle `DRIVER` — sans permission, comme le passager
- [x] Schéma : `driver_profiles` et `driver_documents`
- [x] Modèles, énumérations, garde-fous en base
- [ ] Endpoints : dépôt du dossier, lecture de son statut
- [ ] Dépôt et remplacement de pièces via `FileStorage`
- [ ] File de modération, validation et refus **motivé**
- [ ] Suspension sans perte d'historique ni de reversements dus

**Où on en est.** Le dossier existe et porte ses invariants en base : un dossier
par personne, une pièce par type, et **un refus sans motif est refusé par la
base** — un chauffeur qui ne sait pas quoi corriger est un chauffeur perdu.

`canDrive()` exige un dossier validé **et** un permis non périmé : la date est
saisie au dépôt et personne ne repasse derrière, donc sans ce contrôle une
validation d'il y a deux ans laisserait rouler indéfiniment.

Le véhicule vit sur le dossier, pas dans `vehicles` : celui-là appartient à une
agence, se voit affecter des départs et porte un plan de sièges.

## 3. Module `Rides`

- [ ] `service_requests` — demande, expiration
- [ ] `ride_offers` — prix ferme, délai annoncé, validité
- [ ] `rides` — course acceptée
- [ ] Index unique partiel : une course active par chauffeur
- [ ] Index unique partiel : une offre acceptée par demande
- [ ] Expiration des demandes sans offre

## 4. Paiement et reversement

- [ ] Encaissement (dépend de la question ouverte n° 1)
- [ ] Écriture au grand livre du chauffeur
- [ ] Reversement sur son compte Mobile Money

## 5 à 7. Écrans

Détail dans [Appel de service](APPEL-DE-SERVICE.md). Rien avant que 1 et 2 ne
tiennent : un écran de chauffeur sans chauffeur validé ne prouve rien.

---

## Questions ouvertes

Bloquantes pour les étapes indiquées. Aucune n'est technique.

| # | Question | Bloque | État |
|---|---|---|---|
| 1 | Quand encaisse-t-on ? Acompte, solde, ou tout d'un coup | étape 4 | ⬜ à trancher |
| 2 | Coût d'une annulation après acceptation | étapes 3, 5 | ⬜ à trancher |
| 3 | Que faire si le chauffeur ne vient pas | étapes 3, 4 | ⬜ à trancher |
| 4 | Combien d'offres attendre avant de laisser choisir | étape 5 | ⬜ à trancher |
| 5 | Portée de « sa ville » pour un chauffeur | étape 3 | ⬜ à trancher |

Les étapes 1 et 2 n'en dépendent pas : c'est pourquoi elles passent d'abord.

## Risques portés

| Risque | Nature | État |
|---|---|---|
| Plus de tiers responsable en cas d'incident | Juridique et commercial | ⬜ à porter au client |
| Autorisations de transport des chauffeurs | Réglementaire | ⬜ à porter au client |
| Refonte du code d'argent | Technique | 🔨 couvert par les tests existants |

## Journal des décisions

| Date | Décision |
|---|---|
| 17 août 2026 | Chauffeurs **indépendants**, pas personnel d'agence |
| 17 août 2026 | Position **déclarée** — ville et point de repère, jamais de GPS |
| 17 août 2026 | L'argent **passe par la plateforme**, puis est reversé au chauffeur |
| 17 août 2026 | Le prix vient d'une **offre du chauffeur**, pas d'un barème |
| 17 août 2026 | Une seule application mobile, onglets selon le rôle |
