/**
 * La marque MOTOBOY, en géométrie plutôt qu'en pixels.
 *
 * **Pourquoi du tracé et pas le JPEG.** Le logo est arrivé sous forme de
 * `logo.jpg` : 669 × 631, 32 Ko, du bruit de compression dans le marine, un
 * vignettage qui assombrit le bas — et surtout **aucune transparence**. Un JPEG
 * ne peut pas se poser sur un en-tête marine sans traîner son cadre blanc, ne
 * reste pas net en favicon 16 px, et ne se recolore pas.
 *
 * Les chiffres ci-dessous ne sont pas une interprétation : ils ont été relevés
 * au pixel sur l'image d'origine, piste par piste (largeur de trait constante
 * mesurée à 13,3 % du carré, creux à 63,5 %, seconde bosse à 52,2 %). La marque
 * est **volontairement asymétrique** — bosse gauche haute, bosse droite basse et
 * courte — et c'est ce qui la rend reconnaissable. Un « M » symétrique dessiné
 * de mémoire ne ressemble pas à celui-ci.
 *
 * Tout est exprimé dans un carré de 512, ce qui permet de rendre n'importe
 * quelle taille sans retoucher un nombre. Les PNG que réclament Expo et le
 * manifeste PWA sont générés depuis ici par `scripts/build-brand-assets.mjs` :
 * il n'existe aucun raster à maintenir à la main.
 */

/** Le carré arrondi de fond. Rayon à 23,7 % du côté, comme sur l'original. */
export const BRAND_SQUARE = { x: 16, y: 16, size: 480, radius: 114 } as const

/**
 * Le « M », en un seul tracé épaissi.
 *
 * Un trait plutôt que cinq polygones : les extrémités et les sommets arrondis
 * viennent de `linecap`/`linejoin`, donc l'épaisseur reste un seul nombre à
 * régler. Les cinq points sont, dans l'ordre : pied gauche, sommet, creux,
 * seconde bosse, pied droit.
 */
export const BRAND_MARK_PATH = 'M100 349 L146 186 L268 321 L380 267 L393 349'

/** Épaisseur du « M » — 13,3 % du carré, comme mesuré. */
export const BRAND_MARK_WIDTH = 64

/**
 * L'éclat incliné, en haut à droite.
 *
 * Un parallélogramme à sommets horizontaux, penché de 0,947 en x par unité de y
 * — soit **l'inverse exact** de la pente du trait qui descend du sommet vers le
 * creux. C'est ce qui le fait lire comme une trace de vitesse et non comme un
 * morceau de lettre détaché. Coins adoucis de 10 unités.
 */
export const BRAND_STREAK_PATH =
  'M392 143 L432 143 Q442 143 435.1 150.3 L380.9 207.7 Q374 215 364 215 ' +
  'L324 215 Q314 215 320.9 207.7 L375.1 150.3 Q382 143 392 143 Z'

/**
 * L'encombrement réel du dessin, éclat compris.
 *
 * Sert à centrer la marque quand le carré de fond disparaît : sans lui, on
 * centrerait la zone de dessin de 512 et le résultat pencherait, la marque
 * n'étant ni centrée ni carrée dedans. C'est aussi ce qui permet de tenir la
 * zone de sécurité des icônes adaptatives Android.
 */
export const BRAND_MARK_BOX = { x: 68, y: 143, width: 374, height: 238 } as const

/**
 * Les couleurs de la marque.
 *
 * **Le marine est celui de l'interface, pas celui du fichier.** L'original tire
 * sur le bleu roi (#031a60) là où toute la plateforme porte #10314f. Poser un
 * logo bleu roi sur un en-tête #10314f donne un rectangle légèrement violet au
 * milieu du marine : ça ne se lit pas comme une marque, ça se lit comme une
 * erreur d'export. On garde donc le jeton de l'interface.
 *
 * **L'or reste l'or de la marque, et c'est voulu.** L'orange #f4661b est réservé
 * à l'action et à elle seule — c'est la seule règle que toute l'interface suit.
 * Habiller le logo de la couleur de l'action ferait porter à l'identité un
 * vêtement qui veut dire « touchez ici ». L'or, absent de la palette sémantique,
 * ne peut être confondu avec aucune affordance.
 */
export const BRAND_COLORS = {
  navy: '#10314f',
  accent: '#fcb50d',
  mark: '#ffffff',
} as const
