---
name: Motoboy Design System
colors:
  surface: '#fbf8ff'
  surface-dim: '#dbd8e4'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2fe'
  surface-container: '#efecf8'
  surface-container-high: '#e9e7f2'
  surface-container-highest: '#e4e1ed'
  on-surface: '#1b1b23'
  on-surface-variant: '#454554'
  inverse-surface: '#303038'
  inverse-on-surface: '#f2effb'
  outline: '#767686'
  outline-variant: '#c6c5d7'
  surface-tint: '#464dd3'
  primary: '#020075'
  on-primary: '#ffffff'
  primary-container: '#0f0fa9'
  on-primary-container: '#8a91ff'
  inverse-primary: '#bfc2ff'
  secondary: '#745b00'
  on-secondary: '#ffffff'
  secondary-container: '#fecf30'
  on-secondary-container: '#705900'
  tertiary: '#450100'
  on-tertiary: '#ffffff'
  tertiary-container: '#6d0300'
  on-tertiary-container: '#fd6f59'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bfc2ff'
  on-primary-fixed: '#02006e'
  on-primary-fixed-variant: '#2b30bb'
  secondary-fixed: '#ffe089'
  secondary-fixed-dim: '#efc11f'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574400'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a7'
  on-tertiary-fixed: '#400100'
  on-tertiary-fixed-variant: '#8a1c0f'
  background: '#fbf8ff'
  on-background: '#1b1b23'
  surface-variant: '#e4e1ed'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 16px
  gutter: 12px
---

## Brand & Style

Le système de design est conçu pour incarner la vitalité des rues camerounaises tout en imposant un standard de fiabilité institutionnelle. L'identité visuelle repose sur un mélange de **Modernisme Corporatif** et de **Minimalisme Dynamique**. 

L'objectif est de rassurer l'utilisateur sur la sécurité et le professionnalisme du service (le côté "institutionnel") tout en facilitant une navigation rapide et énergique (le côté "mobilité"). L'interface utilise des espaces blancs généreux pour la clarté opérationnelle, contrastés par des accents colorés forts qui guident l'œil vers les actions prioritaires. L'esthétique globale est propre, sans fioritures, optimisée pour une lisibilité parfaite en plein soleil ou lors de déplacements rapides.

## Colors

La palette est structurée pour inverser la hiérarchie traditionnelle, privilégiant la rigueur institutionnelle ponctuée d'énergie solaire :

*   **Bleu Électrique Profond (#0F0FA9) :** Couleur primaire dominante. Elle symbolise la technologie, la loyauté et la sécurité d'une plateforme de confiance. Utilisée pour les en-têtes, la navigation principale et les éléments structurels majeurs.
*   **Or Solaire (#E9BC17) :** Couleur secondaire d'accentuation. Elle apporte la visibilité nécessaire dans l'environnement urbain et rappelle l'énergie du mouvement. À utiliser pour les boutons d'action principaux (CTA), les notifications importantes et les indicateurs de succès.
*   **Neutralité & Contraste :** Le système s'appuie désormais sur des gris sémantiques dérivés pour maintenir une lisibilité optimale, avec une emphase sur des surfaces claires pour équilibrer la force du bleu primaire.

## Typography

Le système utilise **Inter** pour sa lisibilité exceptionnelle sur écran mobile, cruciale pour les chauffeurs et les clients en mouvement. 

*   **Hiérarchie :** Les titres utilisent une graisse "Bold" (700) avec un espacement de lettres légèrement négatif pour un aspect moderne et compact.
*   **Lisibilité :** Le corps de texte privilégie une hauteur de ligne aérée (1.5x la taille de la police) pour faciliter la lecture rapide des détails de trajet.
*   **Labels :** Les informations de statut et les petits indicateurs utilisent la variante "Label-bold" en majuscules pour une distinction immédiate des métadonnées.

## Layout & Spacing

Le système suit une grille de base de **8px**. 

*   **Modèle de Layout :** Principalement fluide pour s'adapter à la diversité des terminaux Android au Cameroun.
*   **Marges :** Une marge de sécurité de 16px est appliquée sur les bords gauche et droit pour le contenu mobile.
*   **Rythme Vertical :** Les sections de cartes et de formulaires sont séparées par des espaces de 24px (lg) pour éviter l'encombrement visuel.
*   **Tactile :** Toutes les zones interactives doivent respecter une zone cible minimale de 48x48px pour garantir l'accessibilité, même lors de vibrations en cours de trajet.

## Elevation & Depth

Le système utilise des **couches tonales** complétées par des ombres très diffuses pour créer de la profondeur sans alourdir l'interface.

*   **Niveau 0 (Fond) :** Utilise les teintes de surface claires pour une base aérée.
*   **Niveau 1 (Cartes/Conteneurs) :** Surfaces blanches avec une bordure fine de 1px et une ombre portée subtile (Y: 2px, Blur: 4px, Opacity: 5%).
*   **Niveau 2 (Éléments flottants/Modales) :** Ombre plus prononcée (Y: 10px, Blur: 20px, Opacity: 10%) pour détacher l'élément du contexte principal.
*   **Interaction :** Lors de l'appui (press), les éléments perdent leur ombre pour simuler une pression physique vers la surface de l'écran.

## Shapes

Le langage de forme est résolument **arrondi**, évoquant la convivialité et la fluidité du mouvement.

*   **Conteneurs & Cartes :** Utilisent le rayon standard de 0.5rem (8px).
*   **Boutons principaux :** Peuvent adopter un style "Rounded-XL" (24px) pour se différencier des cartes d'information.
*   **Champs de saisie :** Doivent conserver un arrondi de 8px pour maintenir un aspect structuré et professionnel.

## Components

*   **Boutons d'action :** Le bouton primaire est plein, utilisant l'Or Solaire avec un texte Bleu Électrique pour un contraste maximal. Le bouton secondaire est un contour (Ghost) ou plein Bleu Électrique.
*   **Cartes de trajet :** Fond blanc, bordure légère, avec une séparation claire entre le point de départ et l'arrivée (utilisant l'Or Solaire pour marquer la destination). Les informations de prix sont mises en avant en gras.
*   **Formulaires :** Champs épurés avec des étiquettes flottantes. L'état de focus est marqué par une bordure de 2px Bleu Électrique, jamais or (pour des raisons de clarté structurelle).
*   **Chips de statut :** Petites capsules arrondies pour indiquer "En attente", "Confirmé" ou "Terminé", utilisant des fonds pastels dérivés des couleurs sémantiques.
*   **Barre de navigation inférieure :** Fond blanc, icônes linéaires qui deviennent pleines et Or Solaire lorsqu'elles sont actives, assurant une distinction claire de la section courante.