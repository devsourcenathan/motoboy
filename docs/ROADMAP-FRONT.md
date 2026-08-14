# Feuille de route — interfaces

> Les écrans. L'API est complète et déployée ; ce document couvre ce qui la
> consomme.
>
> **Dernière mise à jour** — 14 août 2026

Le reste du projet est dans [ROADMAP.md](ROADMAP.md). Les décisions produit sont
dans [BRIEF.md](BRIEF.md), et le contrat dans [openapi.yaml](openapi.yaml) —
lisible sur `/docs` de l'instance déployée.

---

## 1. Ce qui existe

| Élément | État |
|---|---|
| `@motoboy/api-client` | client typé **généré** depuis le contrat, plus une entrée sans DOM |
| `@motoboy/shared` | locale, montants, dates, libellés d'erreur, jetons de design |
| `apps/mobile` | Expo Router, i18n, session, cache persisté, primitives, **onboarding** |
| `apps/web` | Vite nu — un écran de vérification |

**Ce qui n'existe pas** : les écrans du parcours — recherche, résultats,
réservation, paiement, billet — et tout le web.

---

## 2. Trois règles qui ne se négocient pas

**Le backend décide.** Disponibilité, prix final, statut d'une réservation,
validité d'un billet : le client affiche, il ne recalcule pas ([§29](BRIEF.md)).
Le jour où `@motoboy/shared` recalcule des frais d'annulation, la règle existe en
deux exemplaires et elles divergeront — c'est déjà écrit en tête du package, et
ça reste vrai des écrans.

**Le client branche sur `code`, jamais sur `message`.** Le message d'erreur de
l'API est un diagnostic destiné aux journaux ; le texte affiché se compose
côté client à partir du code typé, dans la langue de l'utilisateur
([I10](BRIEF.md)). Les libellés sont déjà dans `shared/labels.ts`.

**Deux langues dès le lancement.** Le Cameroun est bilingue : `fr` et `en` en
même temps, pas l'un puis l'autre. Une interface conçue en une seule langue se
réécrit pour en accueillir une seconde.

---

## 3. Socle partagé

*Rien ne peut être écrit avant.*

### 3.1 Catalogues de traduction — ✅ fait

`fr` et `en`, **tous dans `@motoboy/shared`** : un traducteur ne doit pas les
chercher à deux endroits, et le ton du produit se tient d'un seul.

Un catalogue **par espace produit** — commun, passager, puis agence et
administration — et non un par application : c'est le découpage qui a un sens
pour qui traduit, et il survit au jour où le parcours passager existera aussi
sur le web.

Chacun s'importe par **point d'entrée dédié** — `@motoboy/shared/i18n/passenger`
— et n'est pas réexporté par l'index du package : Metro ne secoue pas l'arbre, et
passer par l'index ferait embarquer au mobile les textes du back-office. Chaque
application branche ensuite son propre moteur.

### 3.2 Session et jeton — ✅ fait

Le jeton Sanctum se stocke différemment selon la plateforme — coffre du système
sur mobile, mémoire plus stockage sur web. D'où un **port** dans `shared`, et une
implémentation par application : le client d'API ne doit connaître ni l'un ni
l'autre.

### 3.3 Client d'API prêt à l'emploi — ✅ fait

Le client généré ne sait rien de l'authentification ni des erreurs. Il lui
manque : l'en-tête `Authorization`, la traduction d'une réponse d'erreur en
objet typé, et la clé d'idempotence sur les opérations qui en exigent une.

### 3.4 Primitives d'interface — ✅ amorcé

**Les composants ne se partagent pas, seuls les jetons.** shadcn repose sur Radix
et le DOM ; le mobile a ses propres primitives. C'est déjà écrit dans
`tokens.ts`, et c'est ce qui évite d'inventer une couche d'abstraction qui
servirait deux fois mal.

---

## 4. Mobile — le parcours passager

*Dans l'ordre du voyage, parce que chaque écran se nourrit du précédent.*

### 4.0 Onboarding — ✅ fait

Trois écrans, pas davantage : ce qu'il y a à dire tient en trois phrases —
comparer, réserver, embarquer. Un onboarding plus long se saute entièrement.

**« Passer » est visible dès le premier écran.** Un passager qui veut son billet
ne doit pas traverser une introduction, et cacher la sortie ne la fait pas lire,
elle fait désinstaller.

Le marqueur « déjà vu » vit dans le stockage de l'application, pas dans le
compte : l'onboarding s'affiche **avant toute inscription** — c'est son objet.
Le lier au compte le ferait réapparaître à chaque changement de téléphone.

L'aiguillage d'entrée n'affiche **ni** l'onboarding **ni** la recherche tant
qu'il ne sait pas : montrer l'un puis basculer sur l'autre produirait un
clignotement à chaque démarrage.

### 4.1 Navigation et coquille — ✅ fait

Expo Router, avec le schéma `motoboy://` : les liens profonds comptent — un SMS
de confirmation doit pouvoir ouvrir le billet. Les onglets — rechercher, mes
billets, compte — arrivent avec les écrans qu'ils desservent.

Le cache des requêtes est **persisté sur le disque**, et c'est ce qui rendra le
billet consultable sans réseau. Seules les données sans caractère secret y
entrent : le cache est écrit en clair, et y laisser le profil d'un compte
déconnecté le rendrait lisible après coup.

**Un accroc trouvé en construisant le bundle** : aucun package du workspace ne
traversait Metro. Les imports relatifs y portent l'extension `.js` — la
convention que `moduleResolution: nodenext` impose pour désigner un `.ts` — et
Metro cherchait un vrai fichier `.js`. La compilation TypeScript passait ; le
bundle, lui, échouait. L'écran dit « de vérification de la chaîne » ne vérifiait
donc rien. Corrigé dans `metro.config.js`, et vérifié par un export réel.

### 4.1 bis Architecture — ✅ posée

Découpage **par fonctionnalité**, décrit dans
[apps/mobile/ARCHITECTURE.md](../apps/mobile/ARCHITECTURE.md). Les routes
n'implémentent rien : un fichier de `app/` réexporte l'écran de sa
fonctionnalité, pour qu'un changement de routeur n'oblige pas à réécrire les
écrans — et qu'un écran se monte dans un test sans routeur du tout.

Les **clés de cache** sont produites par une fabrique typée plutôt qu'écrites à
la main dans les écrans. Une clé recopiée est une clé qu'on invalide mal : le
singulier ici, un identifiant oublié là, et la liste des billets cesse
silencieusement de se rafraîchir après une réservation. Le bogue n'apparaît pas
à la compilation, il apparaît quand un passager ne voit pas son billet.

### 4.2 Recherche

Deux villes et une date. L'autocomplétion tape le référentiel fermé — c'est ce
qui fait que « Douala », « douala » et « Dla » retournent la même chose.

### 4.3 Résultats

Prix, horaire, places restantes, **et les conditions d'annulation** : elles
varient d'une agence à l'autre et deviennent un critère de comparaison affiché,
pas une ligne de conditions générales ([B5](BRIEF.md)).

### 4.4 Détail du départ et plan de sièges

Le plan distingue libre, tenue et vendue. Une place tenue par un paiement en
cours est indisponible **au même titre** qu'une place vendue ; l'échéance n'est
pas montrée au passager, elle ne lui sert à rien.

### 4.5 Réservation

Passagers, contact. La réservation **tient les places avant le paiement** : le
compte à rebours est visible, sinon le passager ne comprend pas pourquoi son
siège lui échappe ([B2](BRIEF.md)).

### 4.6 Paiement

Mobile Money, **asynchrone par nature** : le passager reçoit une sollicitation
sur son téléphone et saisit son code. L'écran attend un verdict qui vient par
webhook — il ne doit ni promettre un succès, ni abandonner au premier délai.
L'échec est banal et réessayer est le cas nominal.

### 4.7 Billet et QR Code

**Consultable sans réseau.** Le billet se met en cache localement et le QR se
**regénère à partir des données stockées**, jamais téléchargé comme image : un
billet dont le QR ne s'affiche pas en gare ne vaut rien ([I5](BRIEF.md)).

### 4.8 Compte et historique

Inscription et connexion par OTP. Historique trié par date de départ
décroissante — le voyage qui vient est celui qu'on cherche.

### 4.9 Annulation

Le **devis d'abord** : le passager doit voir ce qu'il récupérera avant de
confirmer, sinon une règle acceptée devient un litige. Annulation partielle
comprise — trois places réservées, une annulée.

---

## 5. Web

*Après le mobile : le passager passe par le téléphone, l'agence par un écran.*

### 5.1 Espace agence

Inventaire — gares, véhicules et plan de sièges, chauffeurs, itinéraires,
horaires, génération des départs. Puis vente au guichet, embarquement,
réservations, compte courant et reversements, personnel.

**La vente au guichet est le seul écran dont la vitesse est une exigence
fonctionnelle** : plus lente que le cahier, elle ne sera pas utilisée, et toute
la fiabilité de la disponibilité affichée s'effondre avec elle
([I2](BRIEF.md)).

### 5.2 Espace administration

Validation des agences, vérification des coordonnées de reversement, conditions
commerciales, référentiel géographique, reversements, audit, tableau de bord.

### 5.3 Espace propriétaire

Consultation seule, aucun circuit financier ([I3](BRIEF.md)).

### 5.4 Pages publiques

Recherche et résultats. Identité propre, pas une apparence d'outil
d'administration.

---

## 6. PWA d'embarquement

Service worker, liste d'embarquement pré-téléchargée, file locale des
validations synchronisée au retour du réseau. L'API est en place, y compris la
distinction entre un **renvoi** et un **doublon** — sans elle, chaque coupure
réseau fabriquerait un faux doublon et la statistique censée révéler un vrai
problème d'exploitation deviendrait du bruit.

À traiter avec l'espace agence : c'est le même utilisateur, sur le même terrain.

---

## 7. Ce qui reste ouvert

| Sujet | Pourquoi ça n'est pas tranché |
|---|---|
| **Agrégateur de paiement** | L'écran de paiement se construit contre le pilote factice ; le vrai flux ne changera pas sa forme, mais rien ne s'encaisse tant que le choix n'est pas fait |
| **Fournisseur SMS** | Les codes partent dans les journaux — suffisant pour développer, pas pour lancer |
| **Suivi d'erreurs et supervision** | [I7](BRIEF.md) les dit non négociables sur un produit qui encaisse de l'argent |
| **Liste des villes** | Seedée, jamais validée sur le terrain. La recherche ne vaudra que ce qu'elle vaut |
