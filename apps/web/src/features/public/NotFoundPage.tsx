import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Logo } from '../../shared/ui'

/**
 * L'adresse qui ne mène nulle part.
 *
 * **Il n'y en avait pas.** Le routeur public n'avait pas de route attrape-tout :
 * une URL inconnue rendait une page **entièrement blanche** — indistinguable
 * d'une panne, et sans rien pour repartir. Un lien de départ partagé puis périmé
 * est pourtant le cas le plus banal ici.
 */
export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page p-8 text-center">
      <Logo size={48} title="MOTOBOY" />
      <h1 className="text-xl font-bold text-ink-700">{t('public:notFound.title')}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{t('public:notFound.body')}</p>
      <Link to="/" className="text-sm text-ink-500 underline">
        {t('public:notFound.home')}
      </Link>
    </main>
  )
}
