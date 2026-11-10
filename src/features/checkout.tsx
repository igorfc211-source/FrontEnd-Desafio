import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, Clock3, ExternalLink, LockKeyhole, MailCheck, Wallet as WalletIcon, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, EmptyState } from '../components/ui'
import { networks, type CartItem, type Collector, type CreateOrderInput, type Network, type Order, type Profile, type Quote, type Wallet } from '../contracts'
import { api, ApiError, currentToken } from '../lib/api'
import { keys } from '../lib/query'
import { useSession } from '../lib/session'
import { CommerceBreadcrumb, eth, Failure, FeatureTitle, Feedback, Field, LoadingPanel, OrderSummary, SelectField } from './commerce-ui'

interface CheckoutDraft extends Collector { walletId: string; network: Network }
interface Attempt { key: string; request: CreateOrderInput; orderId?: string }
interface Connection { connected: true; walletId: string; network: Network }

const attemptStorageKey = (scope: string) => `aether.checkout.attempt.${scope}`

function readStored<T>(storage: Storage, key: string): T | undefined {
  const raw = storage.getItem(key)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    storage.removeItem(key)
    return undefined
  }
}

export function CheckoutPage() {
  const session = useSession()
  return session ? <CheckoutView key={session.user.id} user={session.user} /> : null
}

function CheckoutView({ user }: { user: Profile }) {
  const scope = user.id
  const draftKey = `aether.checkout.draft.${scope}`
  const attemptKey = attemptStorageKey(scope)
  const client = useQueryClient()
  const navigate = useNavigate()
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const noteId = useId()
  const submissionLock = useRef(false)
  const draftVersion = useRef(0)
  const previousQuote = useRef<Quote | undefined>(undefined)
  const [draft, setDraft] = useState<CheckoutDraft>(() => readStored(sessionStorage, draftKey) ?? {
    name: user.name, email: user.email, username: user.username, profileName: user.name, ens: user.ens, walletId: '', network: networks[0],
  })
  const [attempt, setAttempt] = useState<Attempt | undefined>(() => readStored(sessionStorage, attemptKey))
  const [reviewed, setReviewed] = useState<Quote>()
  const [connected, setConnected] = useState<Connection>()
  const [reviewError, setReviewError] = useState('')
  const [submission, setSubmission] = useState<'review' | 'retry'>()
  const submitting = Boolean(submission)
  const holdingReview = submission === 'review'
  const [quoteChanged, setQuoteChanged] = useState(false)

  useEffect(() => { sessionStorage.setItem(draftKey, JSON.stringify(draft)) }, [draftKey, draft])

  const wallets = useQuery({ queryKey: keys.wallets(scope), queryFn: ({ signal }) => api.get<Wallet[]>('/wallets', signal) })
  const orders = useQuery({ queryKey: keys.orders(scope), queryFn: ({ signal }) => api.get<Order[]>('/orders', signal), refetchOnMount: 'always' })
  const quote = useQuery({
    queryKey: keys.quote(scope, draft.network),
    queryFn: ({ signal }) => api.post<Quote>('/quote', { network: draft.network }, { signal }),
  })
  useEffect(() => {
    if (!quote.data) return
    const previous = previousQuote.current
    previousQuote.current = quote.data
    if (previous?.network === quote.data.network && previous.id !== quote.data.id) setQuoteChanged(true)
  }, [quote.data])
  const recovery = useQuery({
    queryKey: ['private', scope, 'order-attempt', attempt?.key],
    queryFn: ({ signal }) => api.get<Order>(`/orders/attempt/${attempt?.key}`, signal),
    enabled: Boolean(attempt && !attempt.orderId && !submitting),
    retry: false,
  })

  const networkWallets = wallets.data?.filter((wallet) => wallet.network === draft.network) ?? []
  const walletId = draft.walletId && networkWallets.some((wallet) => wallet.id === draft.walletId)
    ? draft.walletId : (networkWallets.find((wallet) => wallet.primary) ?? networkWallets[0])?.id ?? ''
  const wallet = networkWallets.find((entry) => entry.id === walletId)
  const walletConnected = connected && connected.walletId === walletId && connected.network === draft.network
  const stale = Boolean(reviewed && quote.data && reviewed.id !== quote.data.id)
  const available = Boolean(quote.data?.items.length && quote.data.items.every((item) => item.quantity <= item.available))
  const soldOut = quote.data?.items.some((item) => item.available === 0)
  const displayQuote = holdingReview && reviewed ? reviewed : quote.data
  const pendingOrder = !orders.isFetching ? orders.data?.find((order) => order.status === 'pending') : undefined
  const recoveryId = attempt?.orderId ?? recovery.data?.id ?? (!attempt && !submitting ? pendingOrder?.id : undefined)
  const ordersBusy = orders.isPending || orders.isFetching || orders.isError

  useEffect(() => {
    if (!recoveryId) return
    if (attempt && !attempt.orderId) {
      sessionStorage.setItem(attemptKey, JSON.stringify({ ...attempt, orderId: recoveryId }))
    }
    void navigate({ to: '/orders/$orderId', params: { orderId: recoveryId }, replace: true })
  }, [attempt, attemptKey, navigate, recoveryId])

  const connect = useMutation({
    mutationFn: ({ id, network }: { id: string; network: Network }) => api.post<Connection>(`/wallets/${id}/connect`, { network }),
    onSuccess: (connection) => { setConnected(connection); setReviewError('') },
  })
  const disconnect = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/wallets/${id}/connect`),
    onSuccess: () => { setConnected(undefined); setReviewed(undefined) },
  })
  const placeOrder = useMutation({
    mutationFn: (entry: Attempt) => api.post<Order>('/orders', entry.request, { headers: { 'Idempotency-Key': entry.key } }),
  })
  const fields = placeOrder.error instanceof ApiError ? placeOrder.error.fields : undefined

  function changeDraft(patch: Partial<CheckoutDraft>) {
    if (submissionLock.current) return
    draftVersion.current += 1
    setDraft((previous) => ({ ...previous, ...patch }))
    setReviewed(undefined)
    setReviewError('')
    if ((patch.walletId !== undefined || patch.network !== undefined) && connected) {
      disconnect.mutate(connected.walletId)
      setConnected(undefined)
    }
    if (patch.walletId !== undefined || patch.network !== undefined) connect.reset()
    if (patch.network !== undefined) setQuoteChanged(false)
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!walletConnected || !available || quote.isFetching || submitting) return
    if (draft.name.trim().length < 2) {
      setReviewError('Informe um nome com pelo menos dois caracteres.')
      event.currentTarget.querySelector<HTMLInputElement>('[name="collectorName"]')?.focus()
      return
    }
    const version = draftVersion.current
    const result = await quote.refetch()
    if (version !== draftVersion.current || result.isError || !result.data) return
    if (result.data.items.some((item) => item.quantity > item.available) || !result.data.items.length) {
      setReviewError('A disponibilidade mudou. Ajuste os itens no carrinho antes de continuar.')
      return
    }
    setReviewed(result.data)
    setQuoteChanged(false)
    setReviewError('')
    requestAnimationFrame(() => reviewHeading.current?.focus())
  }

  async function submitOrder(entry: Attempt, source: 'review' | 'retry') {
    if (submissionLock.current) return
    const token = currentToken()
    submissionLock.current = true
    setSubmission(source)
    setReviewError('')
    setAttempt(entry)
    sessionStorage.setItem(attemptKey, JSON.stringify(entry))

    try {
      const order = await placeOrder.mutateAsync(entry)
      if (token !== currentToken()) return
      sessionStorage.setItem(attemptKey, JSON.stringify({ ...entry, orderId: order.id }))
      client.setQueryData(keys.order(scope, order.id), order)
      void client.invalidateQueries({ queryKey: keys.orders(scope) })
      await navigate({ to: '/orders/$orderId', params: { orderId: order.id }, replace: true })
    } catch (error) {
      if (token !== currentToken()) return
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status)) {
        if (error.code === 'ORDER_PENDING' && error.details?.orderId) {
          sessionStorage.setItem(attemptKey, JSON.stringify({ ...entry, orderId: error.details.orderId }))
          await navigate({ to: '/orders/$orderId', params: { orderId: error.details.orderId }, replace: true })
          return
        }
        setAttempt(undefined)
        sessionStorage.removeItem(attemptKey)
        setReviewed(undefined)
        setReviewError(error.message)
        if (error.code === 'WALLET_DISCONNECTED') setConnected(undefined)
        if (error.code === 'ORDER_PENDING') void orders.refetch()
        if (error.details?.quote) client.setQueryData(keys.quote(scope, entry.request.network), error.details.quote)
        else void quote.refetch()
      }
    } finally {
      submissionLock.current = false
      setSubmission(undefined)
    }
  }

  function confirm() {
    if (!reviewed || stale || !available || !walletConnected || !wallet || ordersBusy || quote.isFetching || quote.isError) return
    const { name, email, username, profileName, referralCode, ens, secondaryAddress, note } = draft
    const collector = { name: name.trim(), email: email.trim(), username, profileName, referralCode, ens, secondaryAddress, note }
    void submitOrder({ key: crypto.randomUUID(), request: { quoteId: reviewed.id, collector, walletId: wallet.id, network: draft.network } }, 'review')
  }

  const attemptMissing = recovery.error instanceof ApiError && recovery.error.status === 404

  return <div className="container commerce-page commerce-checkout-page">
    <CommerceBreadcrumb current="Pagamento" />
    <div className="commerce-compact-heading"><Link className="commerce-back-icon" to="/cart" aria-label="Voltar ao carrinho"><ArrowLeft size={18} aria-hidden /></Link><FeatureTitle title="Pagamento com carteira" /></div>
      <div className="commerce-stack">
        {(attempt || recoveryId || submitting) && !holdingReview ? <section className="commerce-card commerce-stack" aria-busy={submitting || recovery.isFetching}>
          <h2>{submitting ? 'Enviando pedido…' : 'Recuperando a tentativa de compra'}</h2>
          {placeOrder.error && <Feedback>A resposta do pagamento foi interrompida. Estamos consultando a mesma tentativa.</Feedback>}
          {attemptMissing && attempt && !submitting && <>
            <p>Ainda não recebemos a confirmação de envio. Você pode reenviar esta mesma tentativa.</p>
            <Button type="button" onClick={() => { void submitOrder(attempt, 'retry') }}>Reenviar tentativa</Button>
          </>}
          {recovery.isError && !attemptMissing && <Failure message={recovery.error.message} retry={() => { void recovery.refetch() }} />}
        </section> : <>
          {orders.isError && <Failure message={orders.error.message} retry={() => { void orders.refetch() }} />}
          {quote.isError && <Failure message={quote.error.message} retry={() => { void quote.refetch() }} />}
          {quote.isPending && <LoadingPanel label="Carregando pagamento" />}
          {displayQuote?.items.length === 0 && <EmptyState title="Seu carrinho está vazio" description="Adicione uma obra para continuar com o pagamento.">
            <Button asChild><Link to="/">Explorar NFTs</Link></Button>
          </EmptyState>}
          {!!displayQuote?.items.length && <form className="commerce-checkout-grid" onSubmit={review}>
            <section className="commerce-checkout-collector commerce-stack">
              <h2>Perfil do colecionador</h2>
              {reviewError && <Failure message={reviewError} />}
              <div className="commerce-profile-fields">
              <Field name="collectorName" label="Nome completo" value={draft.name} readOnly={holdingReview} onChange={(event) => changeDraft({ name: event.target.value })} autoComplete="name" required minLength={2} maxLength={100} error={fields?.name} />
              <Field name="collectorUsername" label="Nome de usuário" autoComplete="username" maxLength={32} value={draft.username ?? ''} readOnly={holdingReview} error={fields?.username} onChange={(event) => changeDraft({ username: event.target.value })} />
              <SelectField label="Rede" name="network" value={draft.network} disabled={holdingReview || connect.isPending || disconnect.isPending} onChange={(event) => {
                const network = networks.find((entry) => entry === event.target.value)
                if (network) changeDraft({ network, walletId: '' })
              }}>{networks.map((network) => <option key={network}>{network}</option>)}</SelectField>
              <Field name="collectorProfile" label="Nome do perfil" maxLength={100} value={draft.profileName ?? ''} readOnly={holdingReview} error={fields?.profileName} onChange={(event) => changeDraft({ profileName: event.target.value })} />
              <Field label="Endereço da carteira" value={wallet?.address ?? ''} readOnly />
              <Field name="collectorSecondaryAddress" label="ENS ou carteira secundária" placeholder="Opcional" maxLength={100} value={draft.secondaryAddress ?? ''} readOnly={holdingReview} error={fields?.secondaryAddress} onChange={(event) => changeDraft({ secondaryAddress: event.target.value })} />
              <SelectField label="Carteira" name="wallet" value={walletId} disabled={holdingReview || wallets.isPending || !networkWallets.length || connect.isPending || disconnect.isPending} onChange={(event) => changeDraft({ walletId: event.target.value })}>
                {!networkWallets.length && <option value="">{wallets.isPending ? 'Carregando carteiras…' : 'Nenhuma carteira nesta rede'}</option>}
                {networkWallets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.provider ? ` · ${entry.provider}` : ''}</option>)}
              </SelectField>
              <Field name="collectorReferral" label="Código de indicação" maxLength={40} value={draft.referralCode ?? ''} readOnly={holdingReview} error={fields?.referralCode} onChange={(event) => changeDraft({ referralCode: event.target.value })} />
              <Field name="collectorEmail" label="E-mail" type="email" value={draft.email} readOnly={holdingReview} onChange={(event) => changeDraft({ email: event.target.value })} autoComplete="email" required maxLength={254} error={fields?.email} />
              <Field name="collectorEns" label="Nome ENS" placeholder="nome.eth" maxLength={100} value={draft.ens ?? ''} readOnly={holdingReview} error={fields?.ens} onChange={(event) => changeDraft({ ens: event.target.value })} />
              </div>
              <div className="commerce-field commerce-collector-note">
                <label htmlFor={noteId}>Observação do colecionador (opcional)</label>
                <textarea id={noteId} rows={4} maxLength={500} value={draft.note ?? ''} readOnly={holdingReview} aria-invalid={fields?.note ? true : undefined} aria-describedby={fields?.note ? `${noteId}-error` : undefined} onChange={(event) => changeDraft({ note: event.target.value })} />
                {fields?.note && <span className="commerce-field-error" id={`${noteId}-error`}>{fields.note}</span>}
              </div>
            </section>
            <div className="commerce-checkout-side commerce-stack">
            <OrderSummary totals={displayQuote} title="Seus NFTs" label="Resumo do pedido" leading={<OrderItems items={displayQuote.items} />}>
              {displayQuote.coupon && <p className="commerce-pill">Cupom {displayQuote.coupon} aplicado</p>}
            </OrderSummary>
            <section className="commerce-checkout-wallet commerce-stack">
              <h2>Carteira e rede</h2>
              {!!wallets.data?.length && <fieldset className="commerce-wallet-options" disabled={holdingReview || connect.isPending || disconnect.isPending}>
                <legend className="sr-only">Carteiras cadastradas</legend>
                {wallets.data.map((entry) => <label key={entry.id}>
                  <input type="radio" name="walletOption" checked={walletId === entry.id} onChange={() => changeDraft({ walletId: entry.id, network: entry.network })} />
                  <span><strong>{entry.name}</strong><small>{entry.provider ? `${entry.provider} · ` : ''}{entry.network}</small></span>
                </label>)}
              </fieldset>}
              {wallets.isError && <Failure message={wallets.error.message} retry={() => { void wallets.refetch() }} />}
              {!networkWallets.length && !wallets.isPending && <Link className="commerce-text-button" to="/wallets">Gerenciar carteiras</Link>}
              {connect.error && <Failure message={connect.error.message} />}
              {disconnect.error && <Failure message={disconnect.error.message} />}
              {walletConnected && <Feedback success>Carteira conectada à rede {draft.network}.</Feedback>}
              <div className="commerce-actions">
                {walletConnected ? <Button type="button" variant="secondary" disabled={holdingReview || disconnect.isPending} onClick={() => disconnect.mutate(walletId)}>{disconnect.isPending ? 'Desconectando…' : 'Desconectar carteira'}</Button>
                  : <Button type="button" variant="secondary" disabled={!walletId || connect.isPending || disconnect.isPending} onClick={() => connect.mutate({ id: walletId, network: draft.network })}><WalletIcon size={18} aria-hidden /> {connect.isPending ? 'Conectando…' : 'Conectar carteira'}</Button>}
              </div>
            </section>
            <section className="commerce-checkout-review commerce-stack" aria-busy={holdingReview}>
              <h2 ref={reviewHeading} tabIndex={-1}>Revisão do pedido</h2>
              {stale && !holdingReview && <Feedback>Preço ou disponibilidade atualizados. Revise a nova cotação antes de confirmar.</Feedback>}
              {quoteChanged && !stale && !reviewError && !holdingReview && <Feedback>Preço ou disponibilidade atualizados. Confira os valores no resumo.</Feedback>}
              {!available && !holdingReview && <Failure message={soldOut ? 'Uma edição está esgotada. Volte ao carrinho para remover o item.' : 'A disponibilidade foi alterada. Volte ao carrinho para ajustar as quantidades.'} />}
              {reviewed && (holdingReview || (!stale && available)) ? <>
                <OrderItems items={reviewed.items} />
                <dl className="commerce-details-list">
                  <div><dt>Colecionador</dt><dd>{draft.name} · {draft.email}</dd></div>
                  <div><dt>Pagamento</dt><dd>{wallet?.name} · {draft.network}</dd></div>
                  <div><dt>Total com desconto e taxa de rede</dt><dd><strong>{eth(reviewed.total)}</strong></dd></div>
                </dl>
                <Button type="button" disabled={holdingReview || !walletConnected || quote.isFetching || quote.isError || ordersBusy} onClick={confirm}><LockKeyhole size={18} aria-hidden /> {holdingReview ? 'Enviando pedido…' : 'Confirmar compra'}</Button>
              </> : <>
                <p className="commerce-muted">Confira a carteira, a rede e os valores na cotação antes de confirmar.</p>
                <Button type="submit" disabled={!walletConnected || !available || quote.isFetching || ordersBusy}>{stale ? 'Revisar nova cotação' : 'Revisar pedido'}</Button>
              </>}
            </section>
            </div>
          </form>}
        </>}
      </div>
  </div>
}

function OrderItems({ items }: { items: CartItem[] }) {
  return <ul className="commerce-order-items" aria-label="Itens do pedido">
    {items.map((item) => <li className="commerce-order-item" key={item.id}>
      <img src={item.image} width={46} height={46} alt="" />
      <div><strong>{item.title}</strong><p>{item.edition} · {item.quantity} × {eth(item.unitPrice)}</p></div>
      <span>{eth(item.subtotal)}</span>
    </li>)}
  </ul>
}

export function OrderPage() {
  const { orderId } = useParams({ from: '/private/orders/$orderId' })
  const session = useSession()
  return session ? <OrderView key={`${session.user.id}:${orderId}`} orderId={orderId} scope={session.user.id} /> : null
}

const orderTitles = { pending: 'Pagamento pendente', confirmed: 'Pedido confirmado', declined: 'Pagamento recusado' }

function OrderView({ orderId, scope }: { orderId: string; scope: string }) {
  const client = useQueryClient()
  const queryKey = keys.order(scope, orderId)
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const fetched = await api.get<Order>(`/orders/${orderId}`, signal)
      const previous = client.getQueryData<Order>(queryKey)
      return previous && previous.version > fetched.version ? previous : fetched
    },
    refetchInterval: ({ state }) => state.data?.status === 'pending' ? 2_500 : false,
  })
  const order = query.data
  const acceptedOrderId = order?.id

  useEffect(() => {
    if (!acceptedOrderId) return
    const key = attemptStorageKey(scope)
    const intent = readStored<Attempt>(sessionStorage, key)
    if (intent?.orderId === acceptedOrderId) sessionStorage.removeItem(key)
  }, [acceptedOrderId, scope])

  useEffect(() => {
    if (order?.status === 'confirmed') {
      sessionStorage.removeItem(`aether.checkout.draft.${scope}`)
      void client.invalidateQueries({ queryKey: keys.cart(scope) })
      void client.invalidateQueries({ queryKey: keys.quote(scope) })
    }
  }, [client, order?.status, scope])

  const StatusIcon = order?.status === 'confirmed' ? MailCheck : order?.status === 'declined' ? CircleAlert : Clock3

  return <div className="container commerce-page commerce-receipt-page">
    {query.isPending && <LoadingPanel label="Carregando pedido" />}
    {query.isError && <Failure message={query.error.message} retry={() => { void query.refetch() }} />}
    {order && <article className="commerce-card commerce-stack commerce-receipt">
          <Link className="commerce-auth-close icon-button" to="/" aria-label="Voltar ao marketplace"><X size={19} aria-hidden /></Link>
          <header className="commerce-receipt-heading">
            <StatusIcon size={62} strokeWidth={1.1} aria-hidden />
            <FeatureTitle title={orderTitles[order.status]} />
          </header>
          <div className="commerce-receipt-status" role="status">
            {order.status === 'confirmed' && 'Seus NFTs agora estão na sua carteira.'}
            {order.status === 'declined' && 'O pagamento foi recusado. Os itens continuam no carrinho.'}
            {order.status === 'pending' && 'Estamos aguardando a confirmação simulada do pagamento.'}
          </div>
          <dl className="commerce-details-list commerce-receipt-meta">
            {order.status === 'confirmed' && order.transactionId && <div><dt>Identificador da transação</dt><dd>{order.transactionId}</dd></div>}
            <div><dt>Data</dt><dd>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(order.createdAt))}</dd></div>
            <div><dt>Total</dt><dd>{eth(order.quote.total)}</dd></div>
            <div><dt>Carteira</dt><dd>{order.wallet.name} · {order.quote.network}</dd></div>
          </dl>
          <OrderSummary totals={order.quote} title="Detalhes da transação" label={order.status === 'confirmed' ? 'Recibo' : 'Resumo do pedido'} leading={<OrderItems items={order.quote.items} />} />
          <dl className="commerce-details-list commerce-receipt-collector">
            <div><dt>Identificador do pedido</dt><dd>{order.id}</dd></div>
            <div><dt>Colecionador</dt><dd>{order.collector.name} · {order.collector.email}</dd></div>
            <div><dt>Endereço da carteira</dt><dd>{order.wallet.name} · {order.wallet.address}</dd></div>
          </dl>
          <div className="commerce-actions commerce-receipt-actions">
            {order.status === 'confirmed' && order.explorerUrl && <Dialog>
              <DialogTrigger asChild><Button>Explorador simulado <ExternalLink size={16} aria-hidden /></Button></DialogTrigger>
              <DialogContent>
                <DialogTitle>Explorador simulado</DialogTitle>
                <DialogDescription>Referência gerada para esta transação na rede {order.quote.network}.</DialogDescription>
                <p className="commerce-transaction-reference">{order.explorerUrl}</p>
              </DialogContent>
            </Dialog>}
            {order.status === 'declined' && <Button asChild><Link to="/cart">Voltar ao carrinho</Link></Button>}
            {order.status === 'pending' && <Button type="button" variant="secondary" disabled={query.isFetching} onClick={() => { void query.refetch() }}>Atualizar status</Button>}
          </div>
        </article>}
  </div>
}
