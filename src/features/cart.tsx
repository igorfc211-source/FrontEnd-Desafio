import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, EmptyState } from '../components/ui'
import type { Cart, CartItem } from '../contracts'
import { api, ApiError } from '../lib/api'
import { catalogOptions } from '../lib/catalog'
import { keys } from '../lib/query'
import { scopeKey, useSession } from '../lib/session'
import { NftCard } from './catalog'
import { CommerceBreadcrumb, eth, Failure, FeatureTitle, Feedback, Field, LoadingPanel, OrderSummary } from './commerce-ui'

export function CartPage() {
  const session = useSession()
  const scope = scopeKey(session)
  return <CartView key={scope} scope={scope} sessionReady={session !== undefined} />
}

function CartView({ scope, sessionReady }: { scope: string; sessionReady: boolean }) {
  const client = useQueryClient()
  const cart = useQuery({ queryKey: keys.cart(scope), queryFn: ({ signal }) => api.get<Cart>('/cart', signal), enabled: sessionReady })
  const [liveChanges, setLiveChanges] = useState<string[]>([])
  const previous = useRef<CartItem[]>([])
  const cartItems = cart.data?.items
  const recommendations = useQuery({ ...catalogOptions({}), enabled: Boolean(cartItems?.length) })

  useEffect(() => {
    if (!cartItems) return
    const byId = new Map(previous.current.map((item) => [item.id, item]))
    previous.current = cartItems
    const changed = cartItems.filter((item) => {
      const older = byId.get(item.id)
      return older && (older.unitPrice !== item.unitPrice || older.available !== item.available)
    }).map((item) => item.title)
    if (changed.length) setLiveChanges((existing) => [...new Set([...existing, ...changed])])
  }, [cartItems])

  async function refreshCart() {
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.cart(scope) }),
      client.invalidateQueries({ queryKey: keys.quote(scope) }),
    ])
  }

  const itemMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => quantity === 0
      ? api.delete<Cart>(`/cart/items/${id}`)
      : api.put<Cart>(`/cart/items/${id}`, { quantity }),
    onSuccess: refreshCart,
    onError: refreshCart,
  })
  const couponMutation = useMutation({
    mutationFn: (code: string | null) => api.put<Cart>('/cart/coupon', { code }),
    onSuccess: refreshCart,
  })
  const blocked = cartItems?.some((item) => item.quantity > item.available)
  const pending = itemMutation.isPending || couponMutation.isPending
  const couponError = couponMutation.error instanceof ApiError ? couponMutation.error.fields?.code : undefined

  function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const code = String(new FormData(event.currentTarget).get('coupon')).trim()
    if (code) couponMutation.mutate(code)
  }

  return <div className="container commerce-page commerce-cart-page">
    <CommerceBreadcrumb current="Carrinho" />
    <div className="commerce-compact-heading"><Link className="commerce-back-icon" to="/" aria-label="Continuar explorando"><ArrowLeft size={18} aria-hidden /></Link><FeatureTitle title="Carrinho de NFTs" /></div>
    {cart.isError && <Failure message={cart.error.message} retry={() => { void cart.refetch() }} />}
    {cartItems?.length === 0 && <EmptyState title="Seu carrinho está vazio" description="Explore o catálogo para adicionar uma obra à sua coleção.">
      <Button asChild><Link to="/"><ShoppingBag size={18} aria-hidden /> Explorar NFTs</Link></Button>
    </EmptyState>}
    {(cart.isPending || Boolean(cartItems?.length)) && <div className="commerce-grid">
      <div className="commerce-stack">
        {liveChanges.length > 0 && <Feedback>Preço ou disponibilidade atualizados: {liveChanges.join(', ')}.</Feedback>}
        {itemMutation.error && <Failure message={itemMutation.error.message} />}
        {cart.isPending && <LoadingPanel label="Carregando itens do carrinho" />}
        {cartItems && <section className="commerce-cart-items" aria-label="Itens do carrinho" aria-busy={itemMutation.isPending}>
          <div className="commerce-cart-table-head" aria-hidden><span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span></div>
          <ul>
            {cartItems.map((item) => <li className="commerce-line-item" key={item.id}>
              <Link to="/nft/$slug" params={{ slug: item.slug }} className="commerce-line-art" aria-label={`Ver ${item.title}`}>
                <img src={item.image} width={96} height={96} alt="" />
              </Link>
              <div className="commerce-line-info">
                <h3><Link to="/nft/$slug" params={{ slug: item.slug }}>{item.title}</Link></h3>
                <p className="commerce-muted">{item.edition} · {item.creator}</p>
                {item.quantity > item.available && <small className="commerce-field-error">
                  {item.available === 0 ? 'Edição esgotada. Remova o item para continuar.' : `Apenas ${item.available} disponíveis. Ajuste a quantidade.`}
                </small>}
              </div>
              <span className="commerce-line-price"><span className="sr-only">Preço por unidade </span>{eth(item.unitPrice)}</span>
              <div className="commerce-quantity" role="group" aria-label={`Quantidade de ${item.title}`}>
                  <Button variant="secondary" type="button" aria-label={`Diminuir quantidade de ${item.title}`} disabled={pending || item.quantity <= 1 || item.available === 0} onClick={() => itemMutation.mutate({ id: item.id, quantity: Math.min(item.quantity - 1, item.available) })}>
                    <Minus size={17} aria-hidden />
                  </Button>
                  <output aria-label={`Unidades de ${item.title}`}>{item.quantity}</output>
                  <Button variant="secondary" type="button" aria-label={`Aumentar quantidade de ${item.title}`} disabled={pending || item.quantity >= item.available} onClick={() => itemMutation.mutate({ id: item.id, quantity: item.quantity + 1 })}>
                    <Plus size={17} aria-hidden />
                  </Button>
              </div>
              <strong className="commerce-line-amount"><span className="sr-only">Subtotal </span>{eth(item.subtotal)}</strong>
              <Button className="commerce-line-remove icon-button" variant="ghost" type="button" aria-label={`Remover ${item.title}`} disabled={pending} onClick={() => itemMutation.mutate({ id: item.id, quantity: 0 })}>
                <Trash2 size={18} aria-hidden />
              </Button>
            </li>)}
          </ul>
        </section>}
      </div>
      <OrderSummary totals={cart.data} title="Resumo da carteira" label="Resumo do pedido" leading={cart.data && <div className="commerce-coupon">
          {cart.data.coupon ? <div className="commerce-applied"><span className="commerce-pill">Cupom {cart.data.coupon} aplicado</span>
            <button className="commerce-text-button" type="button" disabled={pending} onClick={() => couponMutation.mutate(null)}>Remover cupom</button></div>
            : <form onSubmit={applyCoupon}>
              <Field label="Código do cupom" placeholder="Digite o código promocional…" name="coupon" maxLength={40} required autoCapitalize="characters" autoComplete="off" error={couponError} />
              <Button type="submit" aria-label="Aplicar cupom" disabled={pending}>{couponMutation.isPending ? 'Validando…' : 'Aplicar'}</Button>
            </form>}
          {couponMutation.error && <Failure message={couponMutation.error.message} />}
          {couponMutation.isSuccess && !cart.data.coupon && <Feedback>Cupom removido.</Feedback>}
        </div>}>
        {blocked || pending || !cart.data || cart.isError ? <Button type="button" disabled>Conectar e finalizar <ArrowRight size={18} aria-hidden /></Button>
          : <Button asChild><Link to="/checkout" aria-label="Conectar e finalizar. Ir para pagamento">Conectar e finalizar <ArrowRight size={18} aria-hidden /></Link></Button>}
        <Link className="commerce-cart-continue" to="/">Continuar explorando</Link>
      </OrderSummary>
    </div>}
    {!!recommendations.data?.featured.length && <section className="commerce-recommendations" aria-labelledby="cart-recommendations">
      <h2 id="cart-recommendations">Colecionadores também viram</h2>
      <div className="nft-grid">{recommendations.data.featured.slice(0, 5).map((item) => <NftCard key={item.id} nft={item} />)}</div>
    </section>}
  </div>
}
