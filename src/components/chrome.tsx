import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ArrowUpRight, Heart, House, LogIn, ScanLine, Search, ShieldCheck, UserRound, Wallet } from 'lucide-react'
import type { Cart } from '../contracts'
import { api } from '../lib/api'
import { keys, queryClient } from '../lib/query'
import { acceptSession, scopeKey, useSession } from '../lib/session'
import { MockTools } from './mock-tools'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Notice } from './ui'

const Realtime = lazy(() => import('./realtime').then(({ Realtime }) => ({ default: Realtime })))

function Brand() {
  return <Link to="/" className="brand" aria-label="Kurio, início">KURIO</Link>
}

export function Chrome() {
  const [open, setOpen] = useState(false)
  const session = useSession()
  const href = useRouterState({ select: (state) => state.location.href })
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const contentRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = contentRef.current?.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    )
    return () => animation?.cancel()
  }, [pathname])
  const home = pathname === '/'
  const standalone = /^\/(nft\/|cart$|checkout$|login$|register$)/.test(pathname)
  const scope = scopeKey(session)
  const cart = useQuery({
    queryKey: keys.cart(scope),
    queryFn: ({ signal }) => api.get<Cart>('/cart', signal),
    enabled: session !== undefined,
  })
  const count = cart.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0
  const logout = useMutation({
    mutationFn: () => api.post('/session/logout'),
    onSuccess: () => { setOpen(false); return acceptSession(null) },
  })
  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const timeout = setTimeout(() => void queryClient.invalidateQueries({ queryKey: keys.session }), Math.max(0, expiresAt - Date.now()) + 50)
    return () => clearTimeout(timeout)
  }, [expiresAt])

  const redirect = pathname === '/login' || pathname === '/register' ? undefined : href
  const accountLinks = session ? <>
    <Link to="/profile" onClick={() => setOpen(false)}><UserRound size={17} /> Perfil</Link>
    <Link to="/wallets" onClick={() => setOpen(false)}><Wallet size={17} /> Carteiras</Link>
    <Link to="/favorites" onClick={() => setOpen(false)}><Heart size={17} /> Favoritos</Link>
    <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>Sair</Button>
    {logout.isError && <Notice kind="error">{logout.error.message}</Notice>}
  </> : <Button asChild><Link to="/login" search={{ redirect }} onClick={() => setOpen(false)}><LogIn size={17} /> Entrar</Link></Button>

  return <>
    <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <header className={`site-header ${home ? 'home-chrome' : ''} ${standalone ? 'standalone-chrome' : ''}`}>
      <div className="container header-inner">
        <Brand />
        <nav aria-label="Navegação principal" className="header-nav">
          <Link to="/" activeOptions={{ exact: true, includeSearch: false }} className={home && !href.includes('#catalogo') ? 'nav-current' : undefined}>Início</Link>
          <Link to="/" hash="catalogo" activeOptions={{ exact: true, includeHash: true }} className={!home || href.includes('#catalogo') ? 'nav-current' : undefined}>Mercado</Link>
          <Link to="/creators">Criadores</Link><Link to="/learn">Aprenda</Link>
        </nav>
        <div className="header-actions">
          <Link to="/" className="icon-button dock-only" aria-label="Início"><House size={20} /></Link>
          <Link to="/favorites" className="icon-button dock-only" aria-label="Favoritos"><Heart size={20} /></Link>
          <Link to="/" hash="market-search" className="icon-button dock-only dock-search" aria-label="Ir para a busca"><ScanLine size={24} /></Link>
          <Link to="/" hash="catalog-search" className="icon-button desktop-search-link" aria-label="Buscar no catálogo"><Search size={23} /></Link>
          <Link to="/cart" className="icon-button cart-link" aria-label={count ? `Carrinho (${count})` : 'Carrinho'}><img src="/icons/shop.svg" width="23" height="23" alt="" />{count > 0 && <span>{count}</span>}</Link>
          {!session && <div className="desktop-login">{accountLinks}</div>}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="ghost" className={session ? 'account-trigger icon-button' : 'mobile-menu icon-button'} aria-label={session ? 'Menu da conta' : 'Abrir menu'}><img src="/icons/user.svg" width="20" height="20" alt="" /></Button></DialogTrigger>
            <DialogContent className="navigation-dialog">
              <DialogTitle>{session ? 'Menu da conta' : 'Menu de navegação'}</DialogTitle>
              <DialogDescription>Explore o catálogo e acesse sua conta.</DialogDescription>
              <nav aria-label="Menu" className="menu-links">
                <Link to="/" onClick={() => setOpen(false)}>Início</Link>
                <Link to="/" hash="catalogo" onClick={() => setOpen(false)}>Explorar catálogo</Link>
                <Link to="/creators" onClick={() => setOpen(false)}>Criadores</Link><Link to="/learn" onClick={() => setOpen(false)}>Aprenda</Link>
                {accountLinks}
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
    {session !== undefined && <Suspense fallback={null}><Realtime /></Suspense>}
    <main ref={contentRef} id="conteudo" tabIndex={-1}><Outlet /></main>
    <footer className={`site-footer ${home ? 'home-footer' : ''}`}>
      <div className="container">
        <div className="footer-features">
          <div><ShieldCheck size={20} /><h2>Segurança da carteira</h2><p>Revise os valores e a rede antes de confirmar uma compra.</p></div>
          <div><Heart size={20} /><h2>Obras em destaque</h2><p>Descubra as coleções selecionadas no mercado.</p></div>
          <div><Wallet size={20} /><h2>Controle de pagamento</h2><p>Acompanhe o estado e o recibo das compras simuladas.</p></div>
        </div>
        <div className="footer-inner">
          <div><Brand /><p>Feito para colecionadores, criadores e cultura digital.</p></div>
          <nav aria-label="Links do rodapé"><Link to="/" hash="catalogo">Explorar catálogo <ArrowUpRight size={15} /></Link><Link to="/cart">Carrinho <ArrowUpRight size={15} /></Link></nav>
        </div>
        <div className="footer-meta"><span>KURIO · Marketplace de NFTs</span><div className="footer-demo"><span>Ambiente de demonstração</span>{import.meta.env.VITE_ENABLE_MOCKS !== 'false' && <MockTools />}</div></div>
      </div>
    </footer>
  </>
}
