/**
 * Où vit le jeton de session.
 *
 * **Un port, pas une implémentation.** Le stockage diffère par plateforme et
 * la différence n'est pas cosmétique : sur mobile le jeton va dans le coffre du
 * système, parce qu'un jeton en clair dans le stockage d'une application est
 * lisible sur un téléphone déverrouillé. Le client d'API ne doit connaître ni
 * l'un ni l'autre — sinon il faudrait deux clients.
 *
 * Asynchrone parce que le coffre l'est. Rendre le port synchrone forcerait
 * l'implémentation mobile à mettre le jeton en cache mémoire pour tenir la
 * signature, c'est-à-dire à contourner le coffre.
 */
export interface TokenStore {
  read(): Promise<string | null>
  write(token: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Stockage en mémoire — tests, et rien d'autre.
 *
 * Le jeton disparaît à la fermeture. Utilisé dans une application, il
 * redemanderait un code par SMS à chaque démarrage : le coût du SMS est un
 * point de vigilance du brief (I8), et l'OTP est le seul canal sans
 * alternative.
 */
export function memoryTokenStore(initial: string | null = null): TokenStore {
  let token = initial

  return {
    read: () => Promise.resolve(token),
    write: (value) => {
      token = value

      return Promise.resolve()
    },
    clear: () => {
      token = null

      return Promise.resolve()
    },
  }
}

/**
 * La session, vue par l'application.
 *
 * Regroupe la lecture du jeton pour le client d'API et sa purge : sans ce
 * point unique, chaque écran déciderait pour lui-même de ce que « déconnecté »
 * veut dire.
 *
 * Les champs sont affectés dans le constructeur — `erasableSyntaxOnly` interdit
 * les propriétés de paramètre dans ce dépôt.
 */
export class Session {
  private cached: string | null = null

  private loaded = false

  private readonly store: TokenStore

  /** Appelé quand la session tombe, pour que l'application renvoie à l'accueil. */
  private readonly onExpired: (() => void) | undefined

  constructor(store: TokenStore, onExpired?: () => void) {
    this.store = store
    this.onExpired = onExpired
  }

  /**
   * Le jeton courant.
   *
   * Mis en cache après la première lecture : le port est asynchrone parce que
   * le coffre l'est, mais l'interroger à chaque requête ajouterait un accès
   * disque par appel d'API.
   */
  async token(): Promise<string | null> {
    if (!this.loaded) {
      this.cached = await this.store.read()
      this.loaded = true
    }

    return this.cached
  }

  async start(token: string): Promise<void> {
    this.cached = token
    this.loaded = true
    await this.store.write(token)
  }

  async end(): Promise<void> {
    this.cached = null
    this.loaded = true
    await this.store.clear()
  }

  /**
   * Appelé sur un `401`.
   *
   * Purge sans attendre : laisser un jeton mort en place ferait renvoyer 401 à
   * chaque écran suivant, et l'application semblerait cassée plutôt que
   * déconnectée.
   */
  expire(): void {
    this.cached = null
    this.loaded = true
    void this.store.clear()
    this.onExpired?.()
  }
}
