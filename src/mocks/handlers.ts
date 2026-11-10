import { delay, http, HttpResponse, type JsonBodyType } from 'msw'
import Decimal from 'decimal.js'
import type {
  CartItemInput, CreateOrderInput, LoginInput, MockAction, Network, PasswordInput, ProfileInput,
  RegisterInput, Scenario, WalletInput,
} from '../contracts'
import { networks, scenarios } from '../contracts'
import { connectWallet, login, register, saveWallet, updatePassword, updateProfile } from './accounts'
import { getNft, listNfts } from './catalog'
import {
  actorCart, cartView, createOrder, findCartItem, quoteCart, removeCartItem, setCartQuantity, setCoupon,
} from './commerce'
import { authorized, body, fail, failure, invalid, MockApiError, readSession, tokenFrom } from './http'
import {
  currentScenario, fixtureDatabase, publishControl, recordNftUpdate, replayEvent, settleOrder, transact,
  type MockEvent, type Transaction,
} from './store'

type Route = { request: Request; params: Record<string, string | readonly string[] | undefined> }
const id = (route: Route, name = 'id') => String(route.params[name] ?? '')
const json = (data: unknown, status = 200) => HttpResponse.json(data as JsonBodyType, { status })

function route(write: boolean, action: (route: Route, tx: Transaction) => unknown, control = false) {
  return async (context: Route) => {
    const { request } = context
    const scenario = currentScenario()
    if (!control) {
      if (scenario === 'offline') return HttpResponse.error()
      if (scenario === 'server-error') return failure(503, 'UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
      if (scenario === 'validation-error' && write) {
        return json({ code: 'VALIDATION', message: 'A simulação recusou os dados enviados.' }, 422)
      }
      if (scenario === 'slow' || scenario === 'timeout') await delay(scenario === 'slow' ? 850 : 8_000)
      if (request.signal.aborted) return HttpResponse.error()
    }

    try {
      const result = await transact(write, (tx) => action(context, tx))
      if (!control && scenario === 'out-of-order' && request.method === 'GET') {
        const q = new URL(request.url).searchParams.get('q') ?? ''
        await delay(q.length <= 3 ? 950 : 80)
      }
      if (result instanceof Response) return result
      return result === undefined ? new HttpResponse(null, { status: 204 }) : json(result)
    } catch (error) {
      if (error instanceof MockApiError) return json(error.body, error.status)
      console.error('Falha na simulação de rede', error)
      return failure(500, 'UNEXPECTED_ERROR', 'Ocorreu uma falha na simulação. Tente novamente.')
    }
  }
}

function favorite(write: 'add' | 'remove') {
  return route(true, (context, { state }) => {
    const { account } = authorized(state, context.request)
    const nft = getNft(state, id(context))
    if (state.rejectFavorite) {
      state.rejectFavorite = false
      return failure(503, 'FAVORITE_UNAVAILABLE', 'Não foi possível salvar o favorito. Tente novamente.')
    }
    if (write === 'add' && !account.favorites.includes(nft.id)) account.favorites.push(nft.id)
    if (write === 'remove') account.favorites = account.favorites.filter((item) => item !== nft.id)
    return account.favorites
  })
}

function olderEvent(event: MockEvent): MockEvent {
  const version = Math.max(0, event.payload.version - 1)
  const eventId = `${event.payload.eventId}:old`
  if (event.name === 'nft.updated') return { name: event.name, payload: { ...event.payload, eventId, version } }
  return { name: event.name, payload: { ...event.payload, eventId, version, status: 'pending' } }
}

function validEth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,12}(?:\.\d{1,18})?$/.test(value)
}

async function mockAction(request: Request, tx: Transaction) {
  const action = await body<MockAction>(request)
  const { state } = tx
  switch (action.type) {
    case 'expire-session': {
      const token = tokenFrom(request)
      state.sessions = token ? state.sessions.filter((entry) => entry.token !== token) : []
      break
    }
    case 'reject-favorite':
      state.rejectFavorite = true
      break
    case 'reject-wallet':
      state.rejectWallet = true
      break
    case 'expire-coupon':
      state.couponActive = false
      break
    case 'change-network-fee': {
      const network = action.network ?? 'Ethereum'
      if (!networks.includes(network)) invalid({ network: 'Selecione uma rede compatível.' })
      const fee = action.fee ?? new Decimal(state.networkFees[network]).plus('0.001').toFixed()
      if (!validEth(fee)) invalid({ fee: 'Informe uma taxa ETH não negativa com até 18 casas decimais.' })
      state.networkFees[network] = new Decimal(fee).toFixed()
      break
    }
    case 'price-change':
    case 'sell-out': {
      const nft = getNft(state, action.nftId ?? 'chromatic-echoes')
      const edition = nft.editions.find((item) => item.id === (action.editionId ?? 'original'))
      if (!edition) return fail(404, 'EDITION_NOT_FOUND', 'Esta edição não existe.')
      if (action.type === 'sell-out') {
        edition.available = 0
      } else {
        const price = action.price ?? new Decimal(edition.price).plus('0.12').toFixed()
        if (!validEth(price) || new Decimal(price).isZero()) {
          invalid({ price: 'Informe um preço ETH positivo com até 18 casas decimais.' })
        }
        edition.price = new Decimal(price).toFixed()
      }
      recordNftUpdate(tx, nft)
      break
    }
    case 'resolve-orders': {
      if (action.status && action.status !== 'confirmed' && action.status !== 'declined') invalid({ status: 'Selecione um estado terminal.' })
      state.orders.forEach((order) => settleOrder(tx, order, action.status))
      break
    }
    case 'replay-event':
      if (state.recentEvent) {
        const event = action.mode === 'old' ? olderEvent(state.recentEvent) : state.recentEvent
        tx.effects.push(() => replayEvent(event))
      }
      break
    case 'disconnect': {
      const requested = action.duration ?? 1_500
      const duration = Number.isFinite(requested) ? Math.min(15_000, Math.max(250, requested)) : 1_500
      state.socketOfflineUntil = Date.now() + duration
      tx.effects.push(() => publishControl({ type: 'disconnect', duration }))
      break
    }
    default:
      return fail(400, 'INVALID_ACTION', 'Ação de simulação desconhecida.')
  }
  return { scenario: state.scenario }
}

export const handlers = [
  http.get('/api/nfts', route(false, ({ request }, { state }) => listNfts(state, request))),
  http.get('/api/nfts/:id', route(false, (context, { state }) => getNft(state, id(context)))),

  http.get('/api/session', route(false, ({ request }, { state }) => readSession(state, request))),
  http.post('/api/session/login', route(true, async ({ request }, { state }) => login(state, await body<LoginInput>(request)))),
  http.post('/api/session/register', route(true, async ({ request }, { state }) => register(state, await body<RegisterInput>(request)))),
  http.post('/api/session/logout', route(true, ({ request }, { state }) => {
    state.sessions = state.sessions.filter((session) => session.token !== tokenFrom(request))
  })),

  http.get('/api/favorites', route(false, ({ request }, { state }) => authorized(state, request).account.favorites)),
  http.put('/api/favorites/:id', favorite('add')),
  http.delete('/api/favorites/:id', favorite('remove')),

  http.get('/api/cart', route(false, ({ request }, { state }) => cartView(state, actorCart(state, request)))),
  http.post('/api/cart/items', route(true, async ({ request }, { state }) =>
    setCartQuantity(state, request, await body<CartItemInput>(request), true))),
  http.put('/api/cart/items/:id', route(true, async (context, { state }) => {
    const { quantity } = await body<Pick<CartItemInput, 'quantity'>>(context.request)
    const line = findCartItem(state, context.request, id(context))
    return setCartQuantity(state, context.request, { ...line, quantity }, false)
  })),
  http.delete('/api/cart/items/:id', route(true, (context, { state }) => removeCartItem(state, context.request, id(context)))),
  http.put('/api/cart/coupon', route(true, async ({ request }, { state }) => {
    const { code } = await body<{ code: string | null }>(request)
    return setCoupon(state, request, code)
  })),
  http.post('/api/quote', route(false, async ({ request }, { state }) => {
    authorized(state, request)
    const { network } = await body<{ network: Network }>(request)
    return quoteCart(state, actorCart(state, request), network)
  })),
  http.post('/api/orders', async (context) => {
    let lostResponse = false
    const handle = route(true, async ({ request }, tx) => {
      const { order, created } = await createOrder(tx, request, await body<CreateOrderInput>(request))
      lostResponse = created && tx.state.scenario === 'order-timeout'
      return json(order, created ? 201 : 200)
    })
    const response = await handle(context)
    if (!lostResponse) return response
    await delay(6_200)
    return failure(504, 'ORDER_RESPONSE_TIMEOUT', 'A confirmação da tentativa demorou. Consulte o estado do pedido.')
  }),
  http.get('/api/orders', route(false, ({ request }, { state }) => {
    const userId = authorized(state, request).account.profile.id
    return state.orders.filter(({ order }) => order.userId === userId).map(({ order }) => order)
  })),
  http.get('/api/orders/attempt/:key', route(false, (context, { state }) => {
    const userId = authorized(state, context.request).account.profile.id
    const order = state.orders.find((entry) => entry.order.userId === userId && entry.key === id(context, 'key'))?.order
    if (!order) return fail(404, 'ORDER_NOT_FOUND', 'Não encontramos um pedido para esta tentativa.')
    return order
  })),
  http.get('/api/orders/:id', route(false, (context, { state }) => {
    const userId = authorized(state, context.request).account.profile.id
    const order = state.orders.find((entry) => entry.order.id === id(context))?.order
    if (!order) return fail(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== userId) return fail(403, 'ORDER_FORBIDDEN', 'Este pedido pertence a outra conta.')
    return order
  })),

  http.get('/api/profile', route(false, ({ request }, { state }) => authorized(state, request).account.profile)),
  http.patch('/api/profile', route(true, async ({ request }, { state }) =>
    updateProfile(state, request, await body<Partial<ProfileInput>>(request)))),
  http.put('/api/profile/password', route(true, async ({ request }, { state }) =>
    updatePassword(state, request, await body<PasswordInput>(request)))),

  http.get('/api/wallets', route(false, ({ request }, { state }) => authorized(state, request).account.wallets)),
  http.post('/api/wallets', route(true, async ({ request }, { state }) => saveWallet(state, request, await body<WalletInput>(request)))),
  http.put('/api/wallets/:id', route(true, async (context, { state }) =>
    saveWallet(state, context.request, await body<WalletInput>(context.request), id(context)))),
  http.post('/api/wallets/:id/connect', route(true, async (context, { state }) => {
    const { network } = await body<{ network: Network }>(context.request)
    return connectWallet(state, context.request, id(context), network)
  })),
  http.delete('/api/wallets/:id/connect', route(true, (context, { state }) => {
    const { session } = authorized(state, context.request)
    if (session.connection?.walletId === id(context)) delete session.connection
  })),

  http.get('/api/__mock/scenario', route(false, (_, { state }) => ({ scenario: state.scenario }), true)),
  http.post('/api/__mock/scenario', async (context) => {
    let reset = false
    const response = await route(true, async ({ request }, tx) => {
      const input = await body<{ scenario: Scenario; reset?: boolean }>(request)
      if (!scenarios.includes(input.scenario)) return fail(400, 'INVALID_SCENARIO', 'Cenário desconhecido.')
      if (input.reset) {
        tx.state = fixtureDatabase()
        reset = true
      }
      tx.state.scenario = input.scenario
      return { scenario: tx.state.scenario }
    }, true)(context)
    if (reset && response.ok) publishControl({ type: 'reset' })
    return response
  }),
  http.post('/api/__mock/action', route(true, ({ request }, tx) => mockAction(request, tx), true)),
]
