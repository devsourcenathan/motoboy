import { render } from '@testing-library/react-native'
import { TicketQr } from './TicketQr'

/**
 * Ce que ce test protège : **le QR est dessiné sur l'appareil**.
 *
 * Il ne vérifie pas un pixel — il vérifie qu'aucune image distante n'entre dans
 * l'arbre rendu. Le jour où quelqu'un remplacerait le rendu local par une
 * `<Image source={{ uri }}>`, le billet cesserait de s'afficher en gare, là où
 * il n'y a pas de réseau — et personne ne s'en apercevrait avant (I5).
 */
describe('TicketQr', () => {
  const PAYLOAD = 'MTB1:TKT-7F3K2A:9a1c4f'

  it('rend un code, sans rien télécharger', async () => {
    const tree = await render(<TicketQr payload={PAYLOAD} />)
    const json = JSON.stringify(tree.toJSON())

    // Aucune source distante : ni `uri`, ni `http`.
    expect(json).not.toMatch(/https?:/)
    expect(json).not.toMatch(/"uri"/)
  })

  it('encode bien la charge reçue, et pas autre chose', async () => {
    const first = await render(<TicketQr payload={PAYLOAD} />)
    const second = await render(<TicketQr payload="MTB1:TKT-AUTRE:0000" />)

    // Le tracé est dérivé de la valeur : deux charges différentes donnent deux
    // dessins différents. Un composant qui ignorerait sa propriété — parce
    // qu'on lui aurait passé une constante, par exemple — produirait deux fois
    // le même, et tous les billets se ressembleraient.
    expect(JSON.stringify(first.toJSON())).not.toBe(JSON.stringify(second.toJSON()))
  })

  it('atténue un billet qui n’est plus valable', async () => {
    const dimmed = await render(<TicketQr payload={PAYLOAD} dimmed />)
    const normal = await render(<TicketQr payload={PAYLOAD} />)

    expect(JSON.stringify(dimmed.toJSON())).toContain('0.35')
    expect(JSON.stringify(normal.toJSON())).not.toContain('0.35')
  })
})
