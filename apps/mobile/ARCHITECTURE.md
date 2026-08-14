# Architecture — application mobile

Découpage **par fonctionnalité**, pas par type de fichier. Un dossier
`components/` à plat oblige, pour comprendre la réservation, à ouvrir six
répertoires et à deviner lesquels de leurs fichiers s'y rapportent.

```
app/                     Routes. Rien d'autre.
src/
  features/<domaine>/
    ui/                  Écrans et composants du domaine
    model/               État, stockage, règles d'affichage
    api/                 Requêtes et mutations du domaine
    index.ts             Ce que le reste de l'application a le droit d'importer
  shared/
    api/                 Client, clés de cache, configuration des requêtes
    session/             Jeton et session
    i18n/                Branchement du moteur sur les catalogues partagés
    ui/                  Primitives et thème
```

## Trois règles

**Les routes n'implémentent rien.** Un fichier de `app/` réexporte l'écran de
sa fonctionnalité, et c'est tout. Changer de routeur ne doit pas obliger à
réécrire les écrans — et un écran doit pouvoir se monter dans un test sans
routeur du tout.

**Une fonctionnalité s'importe par son `index.ts`.** Atteindre
`features/booking/model/seatSelection` depuis un autre domaine crée un couplage
que rien ne signale ; passer par la porte d'entrée rend visible ce qui est
public et ce qui ne l'est pas.

**Une fonctionnalité n'en importe pas une autre.** Ce qu'elles partagent
remonte dans `shared/`. Deux domaines qui s'appellent l'un l'autre finissent par
n'en faire qu'un, en plus difficile à lire.

## Ce qui ne vit pas ici

Les **catalogues de traduction** sont dans `@motoboy/shared`, un par espace
produit — passager, agence, administration. Ils s'importent par point d'entrée
dédié (`@motoboy/shared/i18n/passenger`) : Metro ne secoue pas l'arbre, et les
faire passer par l'index du package embarquerait au mobile les textes du
back-office.

Les **jetons de design** aussi. Seuls les jetons se partagent entre web et
mobile : les composants, non — shadcn repose sur Radix et le DOM.
