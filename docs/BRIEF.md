# MOTOBOY — Brief Projet MVP

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

# 2. Marché cible

## Zone de lancement

**Cameroun uniquement.**

Le produit pourra être étendu à d'autres pays ultérieurement.

## Moyens de transport

Le MVP cible les moyens de transport courants au Cameroun.

Pour commencer :

- Bus
- Voitures / véhicules légers

Le système doit cependant rester suffisamment générique pour permettre l'ajout d'autres types de transport plus tard.

---

# 3. Utilisateurs

Le système distingue plusieurs catégories d'utilisateurs.

## Passager

Utilisateur principal de la plateforme.

Il recherche et réserve des trajets.

## Agence

Entreprise ou opérateur proposant des trajets sur MOTOBOY.

Elle gère notamment :

- véhicules ;
- chauffeurs ;
- trajets ;
- disponibilités ;
- réservations ;
- passagers.

## Propriétaire

Utilisateur pouvant être associé à des véhicules et à leur activité.

## Administrateur

Gère la plateforme dans son ensemble.

## Super administrateur

Dispose des droits de configuration et d'administration avancés.

### Important pour le MVP

Le chauffeur n'a **pas d'application mobile dédiée** pour le moment.

---

# 4. Applications

## Application mobile

Une seule application Flutter.

Elle est destinée **uniquement au passager** dans le MVP.

```text
Flutter Mobile
      |
      └── Passager
