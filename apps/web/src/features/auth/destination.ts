/**
 * Où atterrit un compte une fois connecté.
 *
 * **Il n'y a qu'une porte d'entrée pour quatre espaces.** Le web sert
 * l'administration, l'agence, l'embarquement et le propriétaire depuis le même
 * formulaire — c'est le rôle du compte qui décide, pas l'URL tapée. Sans cette
 * fonction, on se connectait et on restait sur le formulaire : authentifié, sans
 * que rien ne le dise et sans nulle part où aller.
 *
 * L'ordre est celui du **privilège décroissant**, et il compte : un compte peut
 * porter plusieurs rôles — un gérant d'agence qui embarque aussi sur le quai — et
 * l'envoyer vers le plus restreint des deux lui cacherait la moitié de son
 * travail.
 */
const SPACES = [
  { roles: ['ADMIN', 'SUPER_ADMIN'], path: '/admin' },
  { roles: ['AGENCY'], path: '/agency/departures' },
  /*
   * `AGENT` va au quai et non au bureau : il valide des billets, ne vend pas, et
   * l'espace agence lui refuserait la moitié de ses onglets. Le lui présenter
   * quand même lui ferait chercher ce qu'il ne peut pas atteindre.
   */
  { roles: ['AGENT'], path: '/boarding' },
  { roles: ['OWNER'], path: '/owner' },
] as const

/** L'accueil public : c'est là qu'un passager doit rester. */
export const PUBLIC_HOME = '/'

export function destinationFor(roles: readonly string[] | undefined): string {
  const space = SPACES.find((entry) =>
    entry.roles.some((role) => (roles ?? []).includes(role)),
  )

  return space?.path ?? PUBLIC_HOME
}

/** Le nom de l'espace, pour dire lequel a été refusé plutôt que « l'administration ». */
export function spaceLabel(path: string): string {
  if (path.startsWith('/admin')) return 'l’administration'
  if (path.startsWith('/agency')) return 'l’espace agence'
  if (path.startsWith('/boarding')) return 'l’embarquement'
  if (path.startsWith('/owner')) return 'l’espace propriétaire'

  return 'cet espace'
}
