/**
 * Les primitives du back-office.
 *
 * **Un seul endroit pour les classes.** Dix pages qui répètent le même Tailwind
 * divergent en une semaine : un espacement ici, un arrondi là, et l'ensemble
 * cesse de ressembler à un produit.
 *
 * Un dossier plutôt qu'un fichier depuis que s'y sont ajoutés le panneau, les
 * squelettes et les vignettes. Le découpage suit la **question** à laquelle
 * chaque module répond, pas le type technique de ce qu'il contient :
 *
 * | Module | Ce qu'il règle |
 * |---|---|
 * | `Layout` | Où les choses se posent — titre, section, tableau |
 * | `Card` | Les surfaces, et les chiffres qu'on y montre |
 * | `Button` | Une action, et l'attente qu'elle provoque |
 * | `Field` | Une saisie, et son étiquette |
 * | `Sheet` | Un formulaire, en surcouche de ce qu'on regardait |
 * | `Feedback` | L'attente, l'absence, l'échec |
 * | `Icon` | Les tracés, et le rond d'attente |
 * | `Logo` | La marque, et le choix de langue |
 *
 * Cette barrière garde les imports courts — `../../shared/ui` partout — et
 * permet de déplacer un composant sans toucher ses appelants. **Rien n'invente
 * de composant avant qu'il ne serve deux fois** : anticiper coûte plus que
 * réunir après coup.
 */

export { Actions, Button } from './Button'
export { Badge, Card, CardHeader, StatCard, Thumb, type Tone } from './Card'
export {
  EmptyState,
  ErrorNote,
  Skeleton,
  SkeletonCards,
  SkeletonTable,
  SkeletonText,
} from './Feedback'
export { Field, INPUT } from './Field'
export { Icon, Spinner, type IconName } from './Icon'
export { Cell, PageHeader, Section, Table } from './Layout'
export { LocaleSwitch, Logo } from './Logo'
export { Sheet, SheetForm } from './Sheet'
