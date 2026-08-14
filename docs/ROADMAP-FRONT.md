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
| `apps/mobile` | **parcours passager complet** · 72 tests |
| `apps/web` | Vite nu — un écran de vérification |

**Ce qui n'existe pas** : tout le web, et la PWA d'embarquement.

Le parcours passager de [§35](BRIEF.md) est complet de bout en bout : chercher,
comparer, choisir sa place, réserver, payer, embarquer avec son billet hors
ligne, annuler.

**Le harnais de test est en place** — jest-expo et Testing Library, fuseau et
langue épinglés, branché dans `pnpm verify`. 38 tests.

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

### 4.2 Recherche — ✅ fait

Deux villes et une date, et rien d'autre. Les filtres — prix, horaire, agence —
vivent sur les résultats : les demander avant d'avoir montré une offre ferait
renoncer quelqu'un qui veut simplement savoir s'il y a un car ce soir.

L'autocomplétion tape le référentiel fermé — c'est ce qui fait que « Douala »,
« douala » et « Dla » retournent la même chose. Elle propose villes **et**
gares, mais une gare **résout vers sa ville** : sans cela, deux agences
desservant Douala depuis deux gares différentes ne seraient jamais comparées, ce
qui est précisément l'objet du produit.

Le sélecteur de ville est en plein écran, pas en liste déroulante : le clavier
occupe la moitié d'un téléphone, et une liste coincée dans ce qui reste
n'afficherait que deux résultats.

La date du jour est calculée dans le **fuseau d'affichage**, pas celui de
l'appareil : construire la date depuis l'horloge du téléphone ferait chercher la
veille pour quelqu'un qui ouvre l'application à une heure du matin.

### 4.3 Résultats — ✅ fait

Prix, horaire, agence, places restantes, **et les conditions d'annulation** :
elles varient d'une agence à l'autre et deviennent un critère de comparaison
affiché, pas une ligne de conditions générales ([B5](BRIEF.md)). Les frais nuls
se disent « annulation gratuite » — c'est un argument commercial.

Les critères passent par l'URL et non par un état partagé : un résultat doit
être partageable et rouvrable par un lien profond, et un état en mémoire
disparaîtrait au premier retour arrière.

**Jamais de page vide.** Quand rien ne sort, l'écran affiche les dates proches
disponibles et les axes desservis depuis la même ville — que le serveur renvoie
déjà dans le même appel. La couverture sera faible au lancement, ce cas sera
fréquent, et un passager déçu deux fois ne revient pas.

Les erreurs se distinguent : « pas de réseau » et « le serveur a refusé »
appellent deux réactions opposées, et le texte affiché vient du **code** de
l'erreur, jamais de son message.

### 4.4 Détail du départ et plan de sièges — ✅ fait

Le plan distingue libre, choisie, tenue et vendue. Une place **tenue** par un
paiement en cours est indisponible **au même titre** qu'une place vendue : la
laisser cliquable ferait échouer la réservation au dernier écran, après la
saisie des noms. Les deux se distinguent néanmoins à l'affichage — l'une peut
se libérer, ce qui explique au passager pourquoi le plan a changé quand il y
revient. L'échéance, elle, ne lui est pas montrée : elle ne lui sert à rien et
exposerait le rythme des ventes d'une agence.

**L'état est dit, pas seulement coloré.** Chaque place annonce son numéro et son
état au lecteur d'écran : une place prise et une place libre ne doivent pas se
distinguer par la seule couleur.

En mode `CAPACITY`, **aucun plan n'est affiché** — la protection repose sur un
compteur, et inventer des sièges reviendrait à en montrer qui n'existent pas
dans le car.

Le plan vieillit vite : il se rafraîchit au tirer, et sa fraîcheur est bornée à
trente secondes. Mais **l'écran affiche, il ne décide pas** — c'est l'index
unique partiel qui arbitre au moment de réserver, et deux passagers peuvent
viser le même siège à la seconde près.

### 4.5 Réservation — ✅ fait

Un formulaire par passager, plus **un contact** : c'est lui qui reçoit le billet
et les alertes de départ, pas le premier voyageur. Une réservation se fait
couramment pour quelqu'un d'autre, et envoyer le billet au passager plutôt qu'à
l'acheteur le laisserait sans rien.

La réservation **tient les places à l'envoi**, avant tout paiement. Le compte à
rebours est donc visible en permanence, pas caché derrière un avertissement
qu'on ferme : un passager qui cherche son téléphone pour saisir son code Mobile
Money doit voir ce qu'il lui reste, sinon la perte de sa place ressemble à une
panne ([B2](BRIEF.md)).

**La clé d'idempotence survit aux tentatives.** C'est tout son objet : en
régénérer une à chaque essai reviendrait à ne pas en avoir, et une requête qui
expire côté téléphone mais aboutit côté serveur — banal sur une connexion de
gare — ferait tenir deux fois les places et payer deux fois.

Un conflit d'inventaire **se dit et se répare** : « une place vient d'être
prise » appelle un geste précis, choisir une autre place, que l'écran propose.
Un message générique laisserait le passager réessayer indéfiniment le même
siège. « Complet » et « ventes closes », eux, n'offrent pas ce geste — parce
qu'il n'existe pas.

### 4.6 Paiement — ✅ fait

Mobile Money, **asynchrone par nature** : le passager reçoit une sollicitation
sur son téléphone et saisit son code. L'écran ne promet donc **aucun succès** et
n'abandonne pas au premier délai — il attend, en le disant, et interroge le
serveur toutes les deux secondes jusqu'au verdict. L'interrogation s'arrête
d'elle-même une fois le sort connu : la poursuivre viderait la batterie pour
redemander une réponse qui ne changera plus.

**`PENDING` et `PROCESSING` se disent pareil** au passager : la différence est
interne au prestataire et ne lui offre aucun geste différent.

⚠️ **La clé d'idempotence se renouvelle ici, contrairement à la réservation.**
Une réservation rejouée doit rendre la même réservation ; une tentative de
paiement est *une autre tentative* — le contrat prévoit explicitement plusieurs
paiements par réservation, dont un seul aboutit. Réutiliser la clé renverrait
l'échec précédent, et le passager qui recompose correctement son code verrait le
même refus.

L'échec est banal et réessayer est le cas nominal : l'écran le dit, et rappelle
que **les places restent tenues**. La tenue expirée, en revanche, coupe court —
proposer de payer promettrait un siège qui n'existe plus.

### 4.7 Billet et QR Code — ✅ fait

**Consultable sans réseau.** Le billet est en cache sur le disque, et le QR se
**dessine sur l'appareil** à partir de `qr_payload` — jamais téléchargé comme
image. Un billet dont le code dépend du réseau ne s'affiche pas au moment précis
où il n'y en a pas : en gare, devant l'agent ([I5](BRIEF.md)).

Le détail est en `offlineFirst` : le billet en cache s'affiche immédiatement,
sans attendre une réponse qui ne viendra peut-être pas. Un billet ne changeant
qu'à l'annulation ou à l'embarquement, sa fraîcheur est bornée à une heure —
le rafraîchir sans cesse coûterait du réseau là où il y en a le moins.

**Un test protège la contrainte hors ligne** : il vérifie qu'aucune source
distante n'entre dans l'arbre rendu. Le jour où quelqu'un remplacerait le rendu
local par une image téléchargée, le billet cesserait de s'afficher en gare — et
rien d'autre ne le signalerait.

Après paiement, on arrive sur la **liste** et non sur un billet : une
réservation de trois places produit trois billets, un par passager, et la
référence de réservation n'en désigne aucun.

### 4.8 Compte et historique — ✅ fait

Inscription et connexion **sur le même écran**, qui ne diffèrent que par deux
champs de nom : en faire deux obligerait le passager à décider, avant de
commencer, s'il a déjà un compte — question à laquelle il ne sait pas toujours
répondre.

**La connexion arrive au dernier moment.** Recherche, résultats et plan de
sièges fonctionnent sans compte ; c'est en appuyant sur « Continuer », au moment
de réserver, qu'elle est demandée — et l'écran dit pourquoi. La destination
voyage avec : renvoyer sur l'accueil après connexion obligerait à refaire toute
la recherche.

**Le renvoi de code attend trente secondes.** Chaque envoi coûte un SMS et l'OTP
est le seul canal sans alternative : un bouton toujours actif invite à insister,
et la facture suit ([I8](BRIEF.md)). Le délai laisse aussi au message le temps
d'arriver sur un réseau lent, avant que le passager ne conclue qu'il s'est perdu.

Les tentatives restantes sont affichées : découvrir le blocage au dernier essai
n'aide personne. La déconnexion **vide le cache** — y laisser les réservations
d'un compte les rendrait visibles au suivant, sur un téléphone qui change de
mains — et se ferme localement même hors ligne.

### 4.9 Annulation — ✅ fait

Le **devis d'abord**, et le bouton reste inactif tant qu'il n'a pas répondu :
valider sur un montant inconnu est exactement ce que cet écran existe pour
éviter. Sans lui, le passager découvre les frais retenus après coup, et une
règle qu'il avait acceptée devient un litige ([B5](BRIEF.md)).

**Annulation partielle comprise** — trois places réservées, une annulée. Le
choix des passagers n'apparaît qu'au-delà d'un seul : le proposer sinon
reviendrait à demander une décision qui n'existe pas. Le devis se recalcule à
chaque changement, et la clé de cache porte la sélection — partager un cache
entre « une place » et « tout le monde » annoncerait le mauvais montant.

L'écran dit **où repart l'argent** : vers le compte qui a payé, jamais vers un
numéro déclaré après coup. Et quand rien ne transite par la plateforme — vente
au comptoir encaissée en espèces — il le dit aussi, plutôt que de laisser
attendre un virement qui ne viendra pas.

La clé d'idempotence est **conservée** entre les tentatives, comme à la
réservation et contrairement au paiement : une annulation rejouée doit rendre la
même annulation, sans quoi la seconde porterait sur des passagers déjà annulés.

L'entrée est le billet : c'est là qu'un passager pense à annuler, et là qu'il a
sous les yeux ce qu'il s'apprête à perdre.

### 4.10 Essayer le parcours en local — ✅ vérifié de bout en bout

**Expo Go doit correspondre au SDK.** Le projet est sur le SDK 57, qui réclame
Expo Go **57.0.3 ou plus** ; en dessous, l'application refuse de charger avec
« Project is incompatible with this version of Expo Go ». Le Play Store est
souvent en retard : la version exacte se lit sur
`https://api.expo.dev/v2/versions/latest`, et l'APK officiel correspondant est
publié sur le dépôt `expo/expo-go-releases`.

L'adresse de l'API n'a pas à être réglée : elle se déduit de l'hôte du serveur
Metro, la seule que le téléphone sait déjà joindre puisqu'il vient d'y charger le
paquet.

Deux points bloquent un essai manuel, par construction et non par oubli :

- **L'OTP n'est envoyé nulle part** tant qu'aucun fournisseur SMS n'est branché.
  Le pilote de journalisation l'écrit dans `storage/logs/laravel.log`.
- **Rien n'est encaissé de façon synchrone**, le vrai Mobile Money non plus. Le
  parcours s'arrête sur l'écran d'attente jusqu'à l'arrivée d'un webhook qui,
  sans agrégateur, n'arrive jamais. `php artisan motoboy:confirm-payment` le joue
  — en passant par le **vrai contrôleur**, donc en exerçant le journal des
  webhooks, l'idempotence et l'émission des billets. La commande refuse de
  s'exécuter en production et hors pilote factice : marquer un paiement comme
  encaissé est un distributeur de billets gratuits.

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
