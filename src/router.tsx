import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, defaultParseSearch, lazyRouteComponent, Link, redirect, RouterProvider } from '@tanstack/react-router'
import { Chrome } from './components/chrome'
import { Button, EmptyState, LoadingError, Skeleton } from './components/ui'
import { parseCatalogSearch } from './lib/catalog'
import { queryClient } from './lib/query'
import { onSessionChange, safeRedirect, sessionOptions } from './lib/session'

const root = createRootRoute({ component: Chrome, notFoundComponent: NotFound })
const home = createRoute({
  getParentRoute: () => root, path: '/', validateSearch: parseCatalogSearch,
  component: lazyRouteComponent(() => import('./features/catalog'), 'HomePage'),
})
const nft = createRoute({
  getParentRoute: () => root, path: '/nft/$slug',
  component: lazyRouteComponent(() => import('./features/nft'), 'NftPage'),
})
const cart = createRoute({
  getParentRoute: () => root, path: '/cart',
  component: lazyRouteComponent(() => import('./features/cart'), 'CartPage'),
})
const authSearch = (search: Record<string, unknown>) => ({ redirect: typeof search.redirect === 'string' ? safeRedirect(search.redirect) : undefined })
const login = createRoute({
  getParentRoute: () => root, path: '/login', validateSearch: authSearch,
  component: lazyRouteComponent(() => import('./features/account'), 'LoginPage'),
})
const register = createRoute({
  getParentRoute: () => root, path: '/register', validateSearch: authSearch,
  component: lazyRouteComponent(() => import('./features/account'), 'RegisterPage'),
})
const privateRoute = createRoute({
  getParentRoute: () => root, id: 'private',
  beforeLoad: async ({ location }) => {
    const session = await queryClient.fetchQuery(sessionOptions)
    if (!session) throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
    return { session }
  },
})
const checkout = createRoute({
  getParentRoute: () => privateRoute, path: '/checkout',
  component: lazyRouteComponent(() => import('./features/checkout'), 'CheckoutPage'),
})
const order = createRoute({
  getParentRoute: () => privateRoute, path: '/orders/$orderId',
  component: lazyRouteComponent(() => import('./features/checkout'), 'OrderPage'),
})
const profile = createRoute({
  getParentRoute: () => privateRoute, path: '/profile',
  component: lazyRouteComponent(() => import('./features/account'), 'ProfilePage'),
})
const wallets = createRoute({
  getParentRoute: () => privateRoute, path: '/wallets',
  component: lazyRouteComponent(() => import('./features/account'), 'WalletsPage'),
})
const favorites = createRoute({
  getParentRoute: () => privateRoute, path: '/favorites',
  component: lazyRouteComponent(() => import('./features/nft'), 'FavoritesPage'),
})

const router = createRouter({
  routeTree: root.addChildren([home, nft, cart, login, register, privateRoute.addChildren([checkout, order, profile, wallets, favorites])]),
  parseSearch: (raw) => {
    const search: Record<string, unknown> = { ...defaultParseSearch(raw) }
    const params = new URLSearchParams(raw)
    // Preserve exact decimals and numeric search terms from manually entered URLs.
    for (const key of ['minPrice', 'maxPrice', 'q']) {
      const value = params.get(key)
      if (value !== null && typeof search[key] !== 'string') search[key] = value
    }
    return search
  },
  scrollRestoration: true,
  defaultPendingMs: 100,
  defaultPendingMinMs: 0,
  defaultPendingComponent: () => <div className="container route-loading" aria-label="Carregando página" aria-busy="true"><Skeleton /><Skeleton /></div>,
  defaultErrorComponent: ({ error, reset }) => <div className="container route-loading"><LoadingError error={error} onRetry={() => { reset(); void router.invalidate() }} /></div>,
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

onSessionChange(() => void router.invalidate())

function NotFound() {
  return <div className="container route-loading"><EmptyState title="Página não encontrada" description="Confira o endereço ou retorne ao marketplace.">
    <Button asChild><Link to="/">Voltar ao início</Link></Button>
  </EmptyState></div>
}

export function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
}
