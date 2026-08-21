import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '../../test/render'
import { Button } from './Button'
import { Field, INPUT } from './Field'
import { SheetForm } from './Sheet'

/**
 * Le panneau de saisie.
 *
 * **Huit écrans en dépendent**, et chacun réécrivait auparavant sa balise
 * `form`, son bouton d'envoi et l'endroit de son erreur — d'où des divergences
 * qu'aucun test ne pouvait attraper puisqu'il n'y avait rien de commun à
 * éprouver. Ce qui est vérifié ici l'est donc une fois pour les huit.
 */
function Exemple({
  onSubmit = () => {},
  pending = false,
  error,
}: {
  onSubmit?: () => void
  pending?: boolean
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  return (
    <>
      {/*
        Le bouton reste monté pendant que le panneau est ouvert, comme dans les
        vraies pages où il vit dans l'en-tête. Le démonter rendrait le retour du
        focus impossible — il n'y aurait plus rien où revenir.
      */}
      <Button label="Ouvrir" onPress={() => setOpen(true)} />

      {open ? (
        <SheetForm
          title="Nouvelle gare"
          onClose={() => setOpen(false)}
          onSubmit={onSubmit}
          submitLabel="Créer"
          submitDisabled={value.trim() === ''}
          pending={pending}
          error={error}
        >
          <Field label="Nom">
            <input
              className={INPUT}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
        </SheetForm>
      ) : null}
    </>
  )
}

describe('SheetForm', () => {
  /**
   * **Le bouton d'envoi vit dans le pied, hors du `form`.** L'attribut `form`
   * les relie ; sans lui le clic ne soumet rien, et le défaut ne se voit pas —
   * il ne produit aucune erreur, juste un formulaire qui ne part pas.
   */
  it('soumet depuis un bouton qui n’est pas dans le formulaire', async () => {
    const onSubmit = vi.fn()

    render(<Exemple onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    await userEvent.type(screen.getByLabelText('Nom'), 'Gare de Bonabéri')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  /** Échap ferme : c'est le réflexe, et son absence fait chercher la croix. */
  it('se ferme avec Échap', async () => {
    render(<Exemple />)

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  /**
   * **Le focus revient sur le bouton qui a ouvert le panneau.** Sans cela la
   * navigation au clavier repart du haut de la page à chaque fermeture, et
   * retrouver sa place dans une liste de trente véhicules coûte trente
   * tabulations.
   */
  it('rend le focus à ce qui l’a ouvert', async () => {
    render(<Exemple />)

    const ouvrir = screen.getByRole('button', { name: 'Ouvrir' })
    await userEvent.click(ouvrir)
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Ouvrir' })).toHaveFocus()
  })

  /**
   * **Un envoi sans retour visible se rejoue.** Désactiver le bouton ne suffit
   * pas : sur un réseau lent, rien ne distingue « en cours » de « mon clic n'a
   * pas été pris ».
   */
  it('montre l’attente sur le bouton, sans en changer le libellé', async () => {
    render(<Exemple pending />)

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))

    const envoyer = screen.getByRole('button', { name: 'Créer' })

    expect(envoyer).toBeDisabled()
    expect(envoyer).toHaveAttribute('aria-busy', 'true')
  })

  /** Rien ne part tant que l'appelant juge le formulaire incomplet. */
  it('bloque l’envoi tant que l’essentiel manque', async () => {
    render(<Exemple />)

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))

    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
  })

  /**
   * L'erreur est annoncée : muette pour un lecteur d'écran, elle laisse
   * attendre une réponse qui est déjà là.
   */
  it('annonce l’erreur au lieu de l’afficher en silence', async () => {
    render(<Exemple error="Ce numéro est déjà pris." />)

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ce numéro est déjà pris.')
  })
})
