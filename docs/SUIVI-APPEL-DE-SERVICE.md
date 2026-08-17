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
| 2. Compte chauffeur, dossier, modération | ✅ fait — côté API |
| 3. Module `Rides` — demandes, offres, courses | ✅ fait — côté API |
| 4. Paiement et reversement de la course | 🔨 schéma fait, deux préalables |
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
- [x] Endpoints : dépôt du dossier, lecture de son statut
- [x] Dépôt et remplacement de pièces via `FileStorage`
- [x] File de modération, validation et refus **motivé**
- [x] Suspension sans perte d'historique ni de reversements dus
- [x] Contrat mis à jour, client typé régénéré

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

- [x] Schéma : un paiement peut porter sur une course
- [x] Contrainte : un paiement sans objet, ou rattaché aux deux, est refusé
- [x] Compteur de non-présentations au dossier chauffeur
- [ ] Encaissement à l'acceptation — **bloqué, voir ci-dessous**
- [ ] Remboursement : annulation avant départ, et chauffeur absent
- [ ] Écriture au grand livre du chauffeur
- [ ] Reversement sur son compte Mobile Money

### Deux préalables, tous deux hors du périmètre d'une passe rapide

**1. Généraliser `InitiatePayment`.** L'action est façonnée pour une
réservation de bout en bout : garde sur la réservation, détection de rejeu par
réservation, commission lue sur la réservation. C'est un refactor de code
d'argent du même ordre que le bénéficiaire de l'étape 1, et il mérite sa passe
dédiée plutôt que la fin d'une longue session.

**2. Le taux de commission d'une course** — ✅ **tranché : 10 %, réglable.**
Stocké en base, modifiable depuis le dashboard par le super-administrateur, en
points de base et plafonné à 30 %. Un taux unique s'applique : une agence négocie
ses conditions parce qu'elle pèse dans la négociation, un chauffeur indépendant
ne négocie pas.

## 5 à 7. Écrans

Détail dans [Appel de service](APPEL-DE-SERVICE.md). Rien avant que 1 et 2 ne
tiennent : un écran de chauffeur sans chauffeur validé ne prouve rien.

---

## Questions tranchées

Toutes datées du 17 août 2026, détaillées en [E4 bis du brief](BRIEF.md).

| # | Question | Décision |
|---|---|---|
| 1 | Quand encaisse-t-on ? | **Tout à l'acceptation, remboursable** |
| 2 | Coût d'une annulation après acceptation | **Gratuite avant le départ, rien rendu après** |
| 3 | Chauffeur absent | **Remboursement intégral et marque au dossier** |
| 4 | Attente avant de choisir une offre | **Aucune : retenable dès l'arrivée** |

### Encore ouverte

| # | Question | Défaut en place |
|---|---|---|
| 5 | Portée de « sa ville » | Égalité stricte avec la ville de départ |

Ce défaut suffit au lancement. L'élargir demande une table de villes voisines,
donc une décision produit et une migration — pas un réglage.

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
| 17 août 2026 | Encaissement **intégral à l'acceptation**, remboursable |
| 17 août 2026 | Annulation **gratuite avant le départ**, rien rendu après |
| 17 août 2026 | Chauffeur absent : remboursement intégral **et marque au dossier** |
| 17 août 2026 | Aucune fenêtre d'attente avant de retenir une offre |
