import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { Actions, Button } from './Button'
import { Icon } from './Icon'
import { ErrorNote } from './Feedback'

/**
 * Le panneau de saisie, en surcouche.
 *
 * En **surcouche** plutôt qu'en page : ajouter un véhicule se fait en regardant
 * la liste des véhicules, et quitter la liste pour un formulaire fait perdre le
 * contexte de ce qu'on est en train de compléter.
 *
 * Ce qu'il apporte que la version précédente n'avait pas, et qui n'est pas
 * cosmétique :
 *
 * - **Échap ferme.** C'est le réflexe, et son absence fait chercher la croix.
 * - **Le fond de page ne défile plus.** Sans cela, faire défiler le panneau
 *   jusqu'en bas continue sur la page derrière, qui a bougé quand on referme.
 * - **Le focus entre et revient.** À l'ouverture il va dans le panneau ; à la
 *   fermeture il retourne sur le bouton qui l'a ouvert, sinon la navigation au
 *   clavier repart du haut de la page à chaque fois.
 * - **Le pied colle.** Un formulaire long cachait son bouton d'envoi sous la
 *   ligne de flottaison, et l'on croyait le formulaire incomplet.
 */
export function Sheet({
  title,
  description,
  onClose,
  footer,
  children,
}: {
  title: string
  description?: string | undefined
  onClose: () => void
  /** Collé en bas, hors de la zone qui défile. */
  footer?: ReactNode
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const opener = document.activeElement

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)

    // Le fond ne défile pas tant que le panneau est ouvert.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panel.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow

      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      {/*
        Le fond ferme le panneau : c'est le geste attendu, et l'oublier force à
        viser une croix de seize pixels.
      */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="flex-1 cursor-default bg-ink-900/40 backdrop-blur-[1px]"
      />

      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex w-full max-w-md flex-col bg-neutral-0 shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink-700">{title}</h2>
            {description === undefined ? null : (
              <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer === undefined ? null : (
          <footer className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}

/**
 * Un panneau qui contient un formulaire — le cas de tous, à ce jour.
 *
 * **Ce qui se répétait dans huit écrans se dit ici une fois** : la balise
 * `form`, l'annulation du rechargement, l'erreur au-dessus du pied, le bouton
 * d'envoi qui porte l'attente, et celui qui referme. Répété, cet assemblage
 * dérivait — un écran affichait son erreur en haut, un autre en bas, un
 * troisième désactivait son bouton sans rien montrer.
 *
 * `submitDisabled` reste à l'appelant : la validité d'un formulaire dépend de ce
 * qu'il demande, et la deviner ici obligerait à lui décrire ses champs.
 */
export function SheetForm({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  submitVariant = 'primary',
  submitDisabled = false,
  pending = false,
  error,
  children,
}: {
  title: string
  description?: string | undefined
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  /**
   * `danger` pour ce qui détruit — annuler un départ, supprimer.
   *
   * Le bouton orange des créations sur une annulation irréversible ferait
   * confirmer par habitude : la couleur est la seule chose qu'on lit avant de
   * viser.
   */
  submitVariant?: 'primary' | 'danger'
  submitDisabled?: boolean
  pending?: boolean
  /** Le texte déjà composé — la traduction d'un code d'erreur, pas le code. */
  error?: string | undefined
  children: ReactNode
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <Sheet
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {error === undefined ? null : <ErrorNote message={error} />}
          <Actions>
            <Button label="Annuler" variant="ghost" onPress={onClose} />
            <Button
              label={submitLabel}
              type="submit"
              variant={submitVariant}
              form={FORM_ID}
              disabled={submitDisabled}
              loading={pending}
            />
          </Actions>
        </div>
      }
    >
      {/*
        Le bouton d'envoi vit dans le pied, hors du `form` : `form={id}` les
        relie, ce qui garde la touche Entrée fonctionnelle dans les champs sans
        faire remonter le bouton dans la zone qui défile.
      */}
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4">
        {children}
      </form>
    </Sheet>
  )
}

/** Un seul panneau est ouvert à la fois : un identifiant fixe suffit. */
const FORM_ID = 'sheet-form'
