import type { ErrorCode } from './types.js'

/**
 * Une erreur métier renvoyée par l'API.
 *
 * **Le client branche sur `code`, jamais sur `message`.** Le message de l'API
 * est un diagnostic destiné aux journaux : sa langue n'est pas garantie et son
 * libellé peut changer sans préavis. Le texte affiché se compose à partir du
 * code — `errorLabel()` dans `@motoboy/shared` — dans la langue de
 * l'utilisateur, ce qui garde la localisation des erreurs entièrement cliente
 * (I10 du brief).
 *
 * Les champs sont affectés dans le corps du constructeur plutôt que déclarés en
 * paramètres : `erasableSyntaxOnly` est actif dans ce dépôt, et une propriété de
 * constructeur émet du code là où le TypeScript doit pouvoir s'effacer.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError'

  readonly code: ErrorCode

  /** Diagnostic. **Ne jamais afficher tel quel.** */
  readonly diagnostic: string

  readonly status: number

  readonly details: Record<string, unknown>

  constructor(
    code: ErrorCode,
    diagnostic: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(`${code} (${status}) — ${diagnostic}`)

    this.code = code
    this.diagnostic = diagnostic
    this.status = status
    this.details = details
  }

  /**
   * Les échecs qu'un même geste peut résoudre, par opposition à ceux qui
   * exigent de changer quelque chose — choisir un autre siège, un autre départ,
   * ou renoncer.
   */
  get isTransient(): boolean {
    return this.code === 'RATE_LIMITED' || this.status >= 500
  }
}

/**
 * Une requête qui n'a jamais abouti.
 *
 * **Distincte d'`ApiError`, délibérément.** Le produit s'utilise en gare
 * routière, où la couverture n'est pas garantie (I5) : « pas de réseau » et
 * « le serveur a refusé » appellent deux réactions opposées — réessayer plus
 * tard, ou corriger la demande. Les confondre sous un code d'erreur inventé
 * ferait entrer dans le contrat une valeur que le serveur n'émet jamais.
 */
export class NetworkError extends Error {
  override readonly name = 'NetworkError'

  constructor(cause: unknown) {
    super('Requête interrompue avant toute réponse du serveur.', { cause })
  }
}

/** Forme d'une réponse d'erreur, avant vérification. */
interface RawErrorBody {
  code?: unknown
  message?: unknown
  details?: unknown
}

/**
 * Ramène un résultat `openapi-fetch` à sa donnée, ou lève.
 *
 * Les bibliothèques de données — TanStack Query en tête — distinguent succès et
 * échec par l'exception, pas par un champ à tester. Sans cette conversion,
 * chaque appelant réécrirait le même `if (error)`, et l'oublierait une fois.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined && result.error !== null) {
    throw toApiError(result.error, result.response.status)
  }

  // Un `204` sans corps est une réussite : c'est à l'appelant de typer sa
  // réponse en `void` plutôt que de recevoir une exception.
  return result.data as T
}

/**
 * Une réponse d'erreur illisible reste une erreur.
 *
 * Un proxy ou une passerelle peut renvoyer du HTML sur un 502 : la rabattre sur
 * `VALIDATION_FAILED` ferait afficher « vérifiez votre saisie » sur une panne de
 * serveur. Le code de repli suit donc le statut HTTP.
 */
export function toApiError(body: unknown, status: number): ApiError {
  const parsed: RawErrorBody = typeof body === 'object' && body !== null ? body : {}

  const code =
    typeof parsed.code === 'string' ? (parsed.code as ErrorCode) : fallbackCode(status)
  const diagnostic =
    typeof parsed.message === 'string'
      ? parsed.message
      : `Réponse ${status} sans corps exploitable.`
  const details =
    typeof parsed.details === 'object' && parsed.details !== null
      ? (parsed.details as Record<string, unknown>)
      : {}

  return new ApiError(code, diagnostic, status, details)
}

function fallbackCode(status: number): ErrorCode {
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'

  return 'VALIDATION_FAILED'
}
