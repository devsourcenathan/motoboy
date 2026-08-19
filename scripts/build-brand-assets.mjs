/**
 * Fabrique tous les rasters de la marque depuis `packages/shared/src/brand.ts`.
 *
 *   pnpm brand
 *
 * **Pourquoi un script et pas des PNG posés dans le dépôt.** Expo veut des PNG
 * (l'icône, les trois couches de l'icône adaptative Android, l'écran de
 * démarrage), le manifeste PWA en veut d'autres tailles, et iOS veut encore la
 * sienne. Exportés à la main, ces huit fichiers divergent au premier ajustement
 * du dessin : on en corrige six, on oublie les deux qu'on ne regarde jamais. Ici
 * le tracé est la seule source, et tout se régénère d'un coup.
 *
 * Le SVG reste la source pour le web (favicon, manifeste) : net à toute taille
 * et quelques centaines d'octets. Les PNG n'existent que là où la plateforme
 * refuse le SVG.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/*
 * La géométrie est lue dans le TypeScript partagé plutôt que recopiée : c'est
 * tout l'intérêt d'avoir une source unique. Un `import()` direct échouerait (le
 * fichier n'est pas compilé), donc on extrait les littéraux au motif — une
 * extraction ratée lève, et une extraction tronquée se voit à la vérification de
 * débordement en fin de script.
 */
const brandSource = await import('node:fs/promises').then((fs) =>
  fs.readFile(join(root, 'packages/shared/src/brand.ts'), 'utf8'),
)

const literal = (name) => {
  const match = brandSource.match(
    new RegExp(`export const ${name} =\\s*([^\\n]*(?:\\n\\s+'[^']*')?)`),
  )
  if (!match) throw new Error(`brand.ts : ${name} introuvable.`)
  // Recolle les tracés écrits sur deux lignes avec un `+`.
  return match[1]
    .split('+')
    .map((part) => part.trim().replace(/^'|'$/g, ''))
    .join('')
}

const MARK_PATH = literal('BRAND_MARK_PATH')
const STREAK_PATH = literal('BRAND_STREAK_PATH')
const NAVY = '#10314f'
const ACCENT = '#fcb50d'
const WHITE = '#ffffff'
const STROKE = 64
/** Encombrement réel du dessin — sert à le centrer sans le carré de fond. */
const BOX = { x: 68, y: 143, width: 374, height: 238 }

const mark = (color) =>
  `<path d="${MARK_PATH}" fill="none" stroke="${color}" stroke-width="${STROKE}"` +
  ' stroke-linecap="round" stroke-linejoin="round"/>'

const streak = (color) => `<path d="${STREAK_PATH}" fill="${color}"/>`

/** L'icône complète : carré marine, « M » blanc, éclat or. */
const icon = () =>
  svg(
    '0 0 512 512',
    `<rect x="16" y="16" width="480" height="480" rx="114" fill="${NAVY}"/>` +
      mark(WHITE) +
      streak(ACCENT),
  )

/**
 * La marque seule, sur fond transparent, centrée dans un carré de `canvas`.
 *
 * `canvas` plus grand que 512 laisse de la marge autour : c'est ainsi qu'on
 * respecte la zone de sécurité des icônes adaptatives Android, qui rognent tout
 * ce qui dépasse des 66 % centraux — sans quoi Android couperait l'éclat.
 */
const markOnly = (canvas, accent = ACCENT, color = WHITE) => {
  const cx = BOX.x + BOX.width / 2
  const cy = BOX.y + BOX.height / 2
  const half = canvas / 2
  return svg(
    `${cx - half} ${cy - half} ${canvas} ${canvas}`,
    mark(color) + (accent === null ? '' : streak(accent)),
  )
}

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`

const png = (source, size) =>
  sharp(Buffer.from(source), { density: 600 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()

const out = async (relative, data) => {
  const path = join(root, relative)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
  console.log(`  ${relative}`)
}

console.log('Marque MOTOBOY :')

// ── Web ────────────────────────────────────────────────────────────────────
// Le SVG d'abord : c'est lui que le navigateur préfère, et il reste net partout.
await out('apps/web/public/favicon.svg', icon())
// Le manifeste PWA exige des PNG : un agent installe l'embarquement sur son
// écran d'accueil, et Android n'y accepte pas le SVG.
await out('apps/web/public/icon-192.png', await png(icon(), 192))
await out('apps/web/public/icon-512.png', await png(icon(), 512))
/*
 * L'icône « maskable » est rognée par le système en cercle ou en losange selon
 * le lanceur. On l'aplatit donc sur un fond marine plein qui remplit tout le
 * carré : la version à coins arrondis y perdrait ses angles.
 */
await out(
  'apps/web/public/icon-maskable-512.png',
  await sharp(Buffer.from(markOnly(660)), { density: 600 })
    .resize(512, 512)
    .flatten({ background: NAVY })
    .png({ compressionLevel: 9 })
    .toBuffer(),
)
// iOS ne lit pas le manifeste pour l'icône d'accueil : il lui faut ce nom exact.
await out('apps/web/public/apple-touch-icon.png', await png(icon(), 180))

// ── Mobile ─────────────────────────────────────────────────────────────────
await out('apps/mobile/assets/icon.png', await png(icon(), 1024))
await out('apps/mobile/assets/favicon.png', await png(icon(), 48))
/*
 * Icône adaptative Android, en trois couches. Le premier plan est rendu dans un
 * carré de 700 pour que le dessin n'occupe que ~53 % de la largeur : Android
 * anime ces couches indépendamment et rogne largement, donc ce qui touche le
 * bord finit coupé.
 */
await out(
  'apps/mobile/assets/android-icon-foreground.png',
  await png(markOnly(700), 1024),
)
await out(
  'apps/mobile/assets/android-icon-background.png',
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: NAVY } })
    .png({ compressionLevel: 9 })
    .toBuffer(),
)
/*
 * La couche monochrome sert aux icônes thématiques d'Android 13+ : le système la
 * recolore entièrement. L'éclat y est donc inutile — il deviendrait de la même
 * couleur que le « M » et le dessin se refermerait. On le retire et on garde la
 * seule silhouette lisible.
 */
await out(
  'apps/mobile/assets/android-icon-monochrome.png',
  await png(markOnly(700, null), 1024),
)
/*
 * L'écran de démarrage se pose sur du marine : la marque y va donc sans son
 * carré, sinon on verrait un carré marine sur du marine, bordé par son propre
 * arrondi.
 */
await out('apps/mobile/assets/splash-icon.png', await png(markOnly(620), 512))

/*
 * Vérification, plutôt qu'une promesse.
 *
 * Le « M » est un trait épaissi : son contour réel dépend de l'épaisseur, des
 * extrémités arrondies et des sommets, et rien dans le tracé ne dit qu'il tient
 * dans le carré. Un sommet remonté de vingt unités déborderait — invisible sur
 * l'aperçu 512, net sur l'écran d'accueil d'un téléphone. On le mesure donc sur
 * le rendu : aucun pixel du dessin ne doit tomber hors du carré arrondi.
 */
const rendered = await sharp(Buffer.from(icon()), { density: 600 })
  .resize(512, 512)
  .raw()
  .toBuffer({ resolveWithObject: true })

const { data, info } = rendered
const inside = (x, y) => {
  const { x: sx, y: sy, size, radius: r } = { x: 16, y: 16, size: 480, radius: 114 }
  const dx = Math.max(sx + r - x, 0, x - (sx + size - r))
  const dy = Math.max(sy + r - y, 0, y - (sy + size - r))
  return (
    x >= sx && x <= sx + size && y >= sy && y <= sy + size && dx * dx + dy * dy <= r * r
  )
}

let escaped = 0
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels
    // Tout ce qui n'est ni transparent ni marine appartient au dessin.
    const opaque = info.channels < 4 || data[i + 3] > 128
    const navyish = data[i] < 60 && data[i + 1] < 80 && data[i + 2] < 110
    if (opaque && !navyish && !inside(x, y)) escaped++
  }
}

if (escaped > 0) {
  throw new Error(
    `La marque déborde du carré arrondi sur ${escaped} pixels : revoyez la géométrie de brand.ts.`,
  )
}

console.log('Terminé — la marque tient dans son carré.')
