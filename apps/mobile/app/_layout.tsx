import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { i18next } from '../src/shared/i18n'
import { persister, queryClient } from '../src/shared/api/query'
import { isPersistedKey } from '../src/shared/api/queryKeys'
import { onSessionExpired } from '../src/shared/session/session'
import { theme } from '../src/shared/ui'

/**
 * Coquille de l'application.
 *
 * Trois fournisseurs, dans cet ordre : la langue, les données, la zone sûre.
 * Les écrans en dépendent tous, et les monter plus bas obligerait chaque
 * branche de navigation à les remonter.
 */
export default function RootLayout() {
  const router = useRouter()

  /*
   * Une session expirée renvoie à l'accueil.
   *
   * Le branchement est ici et pas dans `src/lib/session` : ce module ne doit
   * pas connaître le routeur, sinon la session cesse d'être testable hors
   * application. Le vidage du cache est indissociable — y laisser les
   * réservations d'un compte les rendrait visibles au suivant.
   */
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear()
        router.replace('/')
      }),
    [router],
  )

  return (
    <I18nextProvider i18n={i18next}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // Le cache est écrit en clair : seules les données qui n'ont rien de
          // secret y restent — billets et départs, précisément ce qu'il faut
          // pouvoir consulter sans réseau (I5).
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => isPersistedKey(query.queryKey),
          },
        }}
      >
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.surface.page },
            }}
          />
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </I18nextProvider>
  )
}
