import { QueryClient } from '@tanstack/react-query'
import type { CatalogSearch, Network } from '../contracts'

const scoped = (scope: string, resource: string) => ['private', scope, resource] as const

export const keys = {
  session: ['session'] as const,
  catalog: (search?: CatalogSearch) => search ? ['catalog', search] as const : ['catalog'] as const,
  nft: (slug: string) => ['nft', slug] as const,
  cart: (scope: string) => scoped(scope, 'cart'),
  quote: (scope: string, network?: Network) => network ? [...scoped(scope, 'quote'), network] as const : scoped(scope, 'quote'),
  profile: (scope: string) => scoped(scope, 'profile'),
  wallets: (scope: string) => scoped(scope, 'wallets'),
  orders: (scope: string) => scoped(scope, 'orders'),
  order: (scope: string, id: string) => [...scoped(scope, 'orders'), id] as const,
  favorites: (scope: string) => scoped(scope, 'favorites'),
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      retry: (failures, error) => {
        const status = 'status' in error ? Number(error.status) : 0
        return failures < 1 && (!status || status >= 500)
      },
      refetchOnReconnect: 'always',
    },
    mutations: { retry: false },
  },
})
