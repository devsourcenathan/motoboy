# Appel de service — suivi

*Où en est le chantier. Décisions en [Partie IV du brief](BRIEF.md),
fonctionnalités et écrans dans [Appel de service](APPEL-DE-SERVICE.md), ordre de
construction en [§9 de la roadmap](ROADMAP.md).*

**Dernière mise à jour : 17 août 2026.**

## État d'ensemble

| Étape | État |
|---|---|
| 0. Spécification | ✅ fait |
| 1. Bénéficiaire généralisé des reversements | ✅ fait — contraction à finir |
| 2. Compte chauffeur, dossier, modération | ✅ fait — côté API |
| 3. Module `Rides` — demandes, offres, courses | ✅ fait — côté API |
| 4. Paiement et reversement de la course | ✅ fait — côté API |
| 5. Écrans passager | ✅ fait |
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
- [x] Encaissement à l'acceptation — `PayForRide`, avec rejeu par clé
- [x] Écriture au grand livre du chauffeur — crédit et commission séparés
- [x] Grand livre ouvert aux écritures sans agence
- [x] Endpoints HTTP de paiement et de signalement d'absence
- [x] Remboursement : annulation avant départ, et chauffeur absent
- [x] Grand livre et remboursements ouverts aux courses
- [x] Contrat mis à jour, client typé régénéré
- [x] Comptes de versement ouverts aux personnes — table et modèle renommés
- [ ] **Une passe de reversement pour un chauffeur** — voir ci-dessous

### Ce qui reste avant qu'un chauffeur touche son argent

Toute la chaîne est généralisée : écritures, remboursements, et désormais la
destination du virement. `agency_payout_accounts` est devenue `payout_accounts`,
et le modèle a quitté le module Agences pour Reversements — le renommer plutôt
que le compléter, parce qu'un nom qui affirme le contraire de ce qu'il contient se
propage au prochain lecteur.

Reste à faire **fonctionner une passe de reversement pour un bénéficiaire
personne**. Je l'ai tentée le 17 août et je l'ai annulée : ce n'est pas de la
plomberie, contrairement à ce que j'avais annoncé.

`BuildPayout` et `BuildDuePayouts` lisent le **délai** et le **minimum** de
versement dans les `commercialTerms` de l'agence — conditions négociées, portées
par B4. Un chauffeur indépendant n'en a aucune, et il ne négocie pas.

Il faut donc trancher, avant d'écrire quoi que ce soit :

| Question | Enjeu |
|---|---|
| Quel **délai** avant qu'une course soit reversable ? | Zéro se défend — la course est finie, il n'y a aucun départ à attendre, contrairement à une réservation. Mais un délai court laisse le temps de traiter une réclamation avant que l'argent parte |
| Quel **minimum** de versement ? | Verser 500 F coûte plus de frais qu'il n'en rapporte. Trop haut, un chauffeur occasionnel n'est jamais payé |
| Ces valeurs sont-elles **réglables** comme la commission ? | Le même mécanisme de réglages existe déjà |

Tant que ce n'est pas décidé, les écritures s'accumulent correctement et le solde
se calcule — mais rien ne part.

### Deux préalables, tous deux hors du périmètre d'une passe rapide

**1. Généraliser `InitiatePayment`** — ✅ **écarté après examen.** Ses gardes sont
entièrement propres à la réservation : tenue de places expirée, vente en ligne
close, départ annulé. Aucune n'a de sens pour une course. Ne restait en commun que
l'appel à la passerelle, qui est déjà un port. Les fondre aurait produit une
action avec deux jeux de gardes exclusifs — deux actions dans un fichier. D'où
`PayForRide`, à part.

**2. Le taux de commission d'une course** — ✅ **tranché : 10 %, réglable.**
Stocké en base, modifiable depuis le dashboard par le super-administrateur, en
points de base et plafonné à 30 %. Un taux unique s'applique : une agence négocie
ses conditions parce qu'elle pèse dans la négociation, un chauffeur indépendant
ne négocie pas.

## 5 à 7. Écrans

**Décisions du 17 août 2026.**

| Point | Décision |
|---|---|
| Entrée passager | Un **bouton sur l'accueil**, « Besoin d'un véhicule ? ». Pas de cinquième onglet : un appel de service est rare face à une recherche |
| Mode chauffeur | **Bascule dans le profil.** Un chauffeur reste un passager quand il voyage : il garde ses onglets et bascule quand il travaille |
| Maquettes | **Aucune** pour ces écrans. J'extrapole la langue établie — orange pour agir, cartes, filets — en réutilisant les composants existants |
| Validation d'un dossier pour tester | **`motoboy:approve-driver`** — l'espace web n'existe pas, et sans dossier validé aucun écran de chauffeur ne prouve rien |

- [x] Commande de validation, pour débloquer le test de bout en bout
- [x] Passager : entrée sur l'accueil et formulaire de demande
- [x] Passager : suivre, comparer les offres, payer, signaler une absence
- [ ] Chauffeur : bascule, demandes ouvertes, offrir, conduire, revenus
- [ ] Administration web : la vraie file de modération

### Le contrat était insuffisant pour l'écran de suivi — corrigé

Écran tenté le 17 août puis retiré : il était bâti sur des champs que la ressource
ne renvoyait pas. Trois manques, tous côté API, tous corrigés avant de le
reprendre (`67a9bad`).

| Manque | Pourquoi c'était bloquant | Correction |
|---|---|---|
| `origin.city_id` sans **nom de ville** | L'écran affiche « Bafang », pas « 27 ». Résoudre la ville côté mobile ferait une requête de plus pour une donnée que le serveur a déjà en main | `ServiceRequestPlace.city`, chargé par `loadMissing` |
| Aucun indicateur de **paiement** sur la course | L'écran doit savoir s'il faut proposer de payer ou afficher les coordonnées du chauffeur. Le déduire d'une liste de paiements ferait porter au mobile une règle qui est métier | `Ride.paid`, calculé par `Ride::isPaid()` |
| `offer.driver` **facultatif** | Une offre sans chauffeur n'existe pas ; le rendre optionnel oblige chaque écran à gérer un cas impossible | Émis sans `whenLoaded`, et requis au contrat |

Racine commune : `whenLoaded` décrit une relation *réellement* facultative. Sur une
relation toujours présente, il rend le champ optionnel au contrat et le client se
défend contre un état impossible.

### L'écran de suivi

Un seul écran pour toute la vie de la demande, parce que c'est une seule attente :
le trajet en tête, puis ce que l'état permet — patienter, comparer, payer, signaler.

| Choix | Raison |
|---|---|
| **Sondage à 10 s**, arrêté dès que rien ne peut plus arriver | Aucun canal temps réel. Une demande conclue interrogerait sinon le serveur indéfiniment, batterie et forfait compris |
| **Offres masquées** dès qu'une est retenue | Les laisser à l'écran ferait croire qu'on peut encore changer |
| **Téléphone du chauffeur révélé au paiement seulement** | C'est ce que le passager achète. Le livrer avant laisserait s'arranger hors plateforme, donc sans commission ni recours |
| **Absence signalable** sur une course payée et pas encore partie | Avant paiement il n'y a rien à rembourser ; une fois partie, le chauffeur est venu |
| **Clé d'idempotence neuve à chaque tentative** de paiement | Comme pour une réservation. Rejouer la clé après un code erroné renverrait le refus précédent au passager qui vient de saisir le bon — la description du contrat disait l'inverse, elle a été corrigée |

### À corriger avant les écrans chauffeur

`GET /v1/driver/requests` déclare un `200` **sans schéma de réponse**. Le client
généré ne peut donc rien en typer, et la liste des demandes ouvertes est
précisément le premier écran du chauffeur. Même nature que les trois manques
ci-dessus : le contrat ne dit pas ce que l'écran doit lire.


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
| 17 août 2026 | Entrée passager par un **bouton sur l'accueil** |
| 17 août 2026 | Mode chauffeur par **bascule dans le profil** |
| 17 août 2026 | Pas de maquettes : extrapolation du système établi |
