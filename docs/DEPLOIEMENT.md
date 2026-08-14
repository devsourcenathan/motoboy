# Déploiement — Render + Neon

> **Ce qui est déployé** : l'API seule. Les applications web et mobile n'existent
> pas encore.
>
> **Dernière mise à jour** — 14 août 2026

---

## 1. Ce qui tourne où

| Élément | Où | Note |
|---|---|---|
| API | Render, service web Docker | `apps/api/Dockerfile`, blueprint `render.yaml` |
| Base de données | Neon | PostgreSQL 17, hors de Render |
| File d'attente | dans le conteneur web | table `jobs`, pas de Redis |
| Planificateur | dans le conteneur web | `schedule:work` sous `supervisord` |
| Documents d'agence | Cloudflare R2 | **obligatoire** — voir §4 |

**Un seul conteneur sert les trois rôles.** Ce n'est pas de l'économie : le
travail de fond n'est pas accessoire ici. Sans planificateur,
[`ReleaseExpiredHolds`](../apps/api/app/Modules/Bookings/Actions/ReleaseExpiredHolds.php)
ne tourne plus et **l'inventaire se gèle** — un paiement Mobile Money abandonné
immobilise sa place indéfiniment, et un car affiche complet sans avoir vendu un
billet ([B2](BRIEF.md)). Un déploiement web-seul casse le produit sans qu'aucune
erreur ne le signale.

Le jour où le volume le justifie : deux services de fond avec la même image et
`CONTAINER_ROLE=worker` / `scheduler`, et `RUN_QUEUE=false` /
`RUN_SCHEDULER=false` sur le service web.

---

## 2. Neon

### La chaîne de connexion

Neon fournit une URL complète. Elle va dans `DB_URL`, telle quelle :

```
postgresql://<user>:<password>@<endpoint>.eu-central-1.aws.neon.tech/<db>?sslmode=require
```

### Endpoint direct, pas le pooler

Neon expose deux endpoints : le direct et le **pooler**, reconnaissable au
suffixe `-pooler` dans l'hôte. **Utiliser le direct.**

Le pooler est un PgBouncer en mode transaction, où les requêtes préparées côté
serveur — ce que fait PDO par défaut — se marchent dessus d'une connexion à
l'autre, avec des erreurs intermittentes du type « prepared statement already
exists ». Avec huit processus PHP (`pm.max_children`), l'endpoint direct suffit
très largement.

Y passer un jour demandera d'émuler les requêtes préparées côté PDO, **et de le
vérifier** — pas de le supposer.

### Le nombre de connexions

Le plafond est `pm.max_children` × nombre d'instances, plus une pour le worker et
une pour le planificateur. Avec une instance : **dix connexions**. Augmenter le
nombre d'instances sur Render augmente ce total d'autant — c'est la borne à
surveiller avant toute montée en charge.

### La mise en veille

Neon endort une base inactive. La première requête après une période creuse paie
quelques centaines de millisecondes de réveil. Sans effet ici : le planificateur
interroge la base à la minute, donc elle ne dort jamais vraiment.

---

## 3. Variables d'environnement

`render.yaml` porte tout ce qui n'est pas secret. Les six valeurs marquées
`sync: false` se saisissent dans l'interface de Render :

| Variable | Source |
|---|---|
| `DB_URL` | Neon |
| `R2_ACCESS_KEY_ID` | Cloudflare |
| `R2_SECRET_ACCESS_KEY` | Cloudflare |
| `R2_BUCKET` | Cloudflare |
| `R2_ENDPOINT` | Cloudflare — `https://<account_id>.r2.cloudflarestorage.com` |

### ⚠️ `APP_KEY`

Render la génère à la première création du service. **Ne jamais la régénérer
ensuite.**

Elle ne chiffre pas seulement les sessions : la clé de signature des QR Codes en
est dérivée par séparation de domaine
([`QrPayload`](../apps/api/app/Modules/Tickets/Support/QrPayload.php)). La
changer invalide **tous les billets déjà émis**, qui ne passeront plus
l'embarquement — et le problème se découvre en gare, pas au déploiement.

---

## 4. Cloudflare R2

`DOCUMENTS_DISK=r2` est **obligatoire en production**. Le système de fichiers
d'un conteneur Render est éphémère : un document d'agence déposé sur le disque
local disparaît au redéploiement suivant, et le dossier de validation avec lui.

Le bucket doit rester **privé**. Un registre de commerce ou une pièce d'identité
de dirigeant ne s'atteint pas par une URL permanente : la consultation passe par
une URL signée à durée limitée.

---

## 5. Ce qui se passe au démarrage d'un conteneur

1. Refus immédiat si `APP_KEY` est absente.
2. **nginx est reconfiguré pour écouter sur `PORT`.** Render choisit le port et
   l'annonce par cette variable ; un port figé dans l'image laisse le service
   « en attente de détection de port » indéfiniment, sans qu'aucune erreur ne
   soit émise — rien n'écoute là où l'hébergeur regarde.
3. `package:discover`, puis mise en cache de la configuration, des routes et des
   événements. **Au démarrage, jamais à la construction de l'image** : mettre la
   configuration en cache fige les valeurs d'environnement, et celles de
   production ne sont pas connues au moment du build.
4. `migrate --force --isolated`. Le verrou d'isolation est partagé par le cache
   en base : deux conteneurs qui démarrent ensemble — le cas normal d'un
   redéploiement — n'en jouent qu'une seule série.
5. `supervisord` lance nginx, php-fpm, le planificateur et le worker.

Le blueprint pointe la sonde de santé sur `/up`.

---

## 6. Mise en service

1. Créer la base sur Neon, récupérer l'URL de l'endpoint **direct**.
2. Créer le bucket R2 et un jeton d'accès.
3. Sur Render : *New → Blueprint*, pointer sur le dépôt. `render.yaml` est lu à
   la racine.
4. Saisir les cinq secrets.
5. Déployer. Les migrations tournent au premier démarrage.
6. Seeder le référentiel — pays, villes, rôles et permissions :

```bash
render exec motoboy-api -- php artisan db:seed --force
```

7. Créer le premier super administrateur. Il n'y a pas d'endpoint pour cela, et
   c'est délibéré : une route qui fabrique un super administrateur est une porte
   ouverte tant qu'elle existe.

```bash
render exec motoboy-api -- php artisan tinker
```

---

## 7. Ce qui n'est pas fait

- **Aucun prestataire n'est branché.** Les pilotes factices restent actifs :
  `PAYMENT_GATEWAY=fake`, `PAYOUT_GATEWAY=fake`, `SMS_DRIVER=log`. Ils ne
  simulent pas un succès — un paiement reste en attente, un SMS part dans les
  journaux. Le déploiement n'attend donc pas le choix de l'agrégateur, mais
  **rien ne s'encaisse réellement** tant qu'il n'est pas fait.
- **Pas de suivi d'erreurs.** [I7](BRIEF.md) en fait une brique non négociable
  sur un produit qui encaisse de l'argent et dépend de webhooks tiers. Les
  journaux de Render ne remplacent pas un outil de suivi : ils ne dédupliquent
  rien, n'alertent pas, et se perdent.
- **Pas de supervision des files.** Un worker bloqué ne se signale pas.
- **Pas de sauvegarde vérifiée.** Neon garde un historique de restauration ; il
  n'a jamais été exercé.
- **Pas de domaine ni de HTTPS propre** — l'URL `onrender.com` par défaut.
