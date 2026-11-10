import Decimal from 'decimal.js'
import type { Cart, CartItemInput, Collector, CreateOrderInput, Network, Order, Quote } from '../contracts'
import { networks } from '../contracts'
import { accountPatterns, authorized, fail, invalid, optionalText, text, tokenFrom, validEmail } from './http'
import {
  emptyCart, randomHex, recordNftUpdate, recordOrderUpdate, type Database, type StoredCart, type Transaction,
} from './store'

const EthMath = Decimal.clone({ precision: 64, rounding: Decimal.ROUND_DOWN })
const itemId = (nftId: string, editionId: string) => `${nftId}~${editionId}`

export function actorCart(state: Database, request: Request, create = false): StoredCart {
  if (!tokenFrom(request)) return state.guestCart
  const { account } = authorized(state, request)
  const id = account.profile.id
  if (create) return state.carts[id] ??= emptyCart()
  return state.carts[id] ?? emptyCart()
}

export function cartView(state: Database, cart: StoredCart, network: Network = 'Ethereum'): Cart {
  const items = cart.items.flatMap((line) => {
    const nft = state.nfts.find(({ id }) => id === line.nftId)
    const edition = nft?.editions.find(({ id }) => id === line.editionId)
    if (!nft || !edition) return []
    return [{
      ...line, id: itemId(line.nftId, line.editionId), slug: nft.slug, title: nft.title,
      creator: nft.creator, image: nft.image, edition: edition.name, available: edition.available,
      unitPrice: edition.price, subtotal: new EthMath(edition.price).mul(line.quantity).toFixed(),
    }]
  })
  const subtotal = items.reduce((sum, item) => sum.plus(item.subtotal), new EthMath(0))
  const coupon = state.couponActive && cart.coupon === 'WELCOME10' ? cart.coupon : null
  const discount = coupon ? subtotal.mul('0.1').toDecimalPlaces(18) : new EthMath(0)
  const networkFee = items.length ? state.networkFees[network] : '0'
  const total = subtotal.minus(discount).plus(networkFee)
  return { items, coupon, subtotal: subtotal.toFixed(), discount: discount.toFixed(), networkFee, total: total.toFixed() }
}

export function setCartQuantity(state: Database, request: Request, input: CartItemInput, add: boolean) {
  const cart = actorCart(state, request, true)
  const nft = state.nfts.find(({ id }) => id === input.nftId)
  const edition = nft?.editions.find(({ id }) => id === input.editionId)
  if (!nft || !edition) return fail(404, 'EDITION_NOT_FOUND', 'Esta edição não existe.')
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    invalid({ quantity: 'Informe uma quantidade inteira de pelo menos 1.' })
  }
  const current = cart.items.find(({ nftId, editionId }) => nftId === nft.id && editionId === edition.id)
  const quantity = input.quantity + (add ? current?.quantity ?? 0 : 0)
  if (quantity > edition.available) return fail(409, 'INSUFFICIENT_STOCK', 'A quantidade escolhida excede a disponibilidade da edição.')
  if (current) current.quantity = quantity
  else cart.items.push({ nftId: nft.id, editionId: edition.id, quantity })
  return cartView(state, cart)
}

export function findCartItem(state: Database, request: Request, id: string) {
  const line = actorCart(state, request).items.find(({ nftId, editionId }) => itemId(nftId, editionId) === id)
  if (!line) return fail(404, 'CART_ITEM_NOT_FOUND', 'Item não encontrado no carrinho.')
  return line
}

export function removeCartItem(state: Database, request: Request, id: string) {
  const cart = actorCart(state, request, true)
  findCartItem(state, request, id)
  cart.items = cart.items.filter(({ nftId, editionId }) => itemId(nftId, editionId) !== id)
  if (cart.items.length === 0) cart.coupon = null
  return cartView(state, cart)
}

export function setCoupon(state: Database, request: Request, value: string | null) {
  const cart = actorCart(state, request, true)
  const code = value === null ? null : text(value).toUpperCase()
  if (code === 'EXPIRED10' || (code === 'WELCOME10' && !state.couponActive)) {
    return fail(422, 'COUPON_EXPIRED', 'Este cupom expirou.', { fields: { code: 'Cupom expirado.' } })
  }
  if (code !== null && code !== 'WELCOME10') {
    return fail(422, 'COUPON_INVALID', 'Este cupom é inválido.', { fields: { code: 'Cupom inválido.' } })
  }
  cart.coupon = code
  return cartView(state, cart)
}

export async function quoteCart(state: Database, cart: StoredCart, network: Network): Promise<Quote> {
  if (!networks.includes(network)) invalid({ network: 'Selecione uma rede compatível.' })
  const current = cartView(state, cart, network)
  const signature = JSON.stringify({
    network, ...current, versions: current.items.map(({ nftId }) => state.nfts.find(({ id }) => id === nftId)?.version),
  })
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))
  const id = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { ...current, id, network }
}

export async function createOrder(tx: Transaction, request: Request, input: CreateOrderInput) {
  const { state } = tx
  const { session, account } = authorized(state, request)
  const key = request.headers.get('Idempotency-Key')
  if (!key || !/^[a-zA-Z0-9_-]{1,128}$/.test(key)) return fail(400, 'IDEMPOTENCY_REQUIRED', 'Informe uma chave de idempotência válida.')

  const userId = account.profile.id
  const source = input.collector
  const signature = JSON.stringify({
    quoteId: input.quoteId,
    collector: {
      name: source?.name, email: source?.email, username: source?.username, profileName: source?.profileName,
      referralCode: source?.referralCode, ens: source?.ens, secondaryAddress: source?.secondaryAddress, note: source?.note,
    },
    walletId: input.walletId,
    network: input.network,
  })
  const previous = state.orders.find(({ order, key: storedKey }) => order.userId === userId && storedKey === key)
  if (previous) {
    if (previous.signature !== signature) return fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave já identifica uma tentativa com outros dados.')
    return { order: previous.order, created: false }
  }

  const pending = state.orders.find(({ order }) => order.userId === userId && order.status === 'pending')
  if (pending) return fail(409, 'ORDER_PENDING', 'Você já tem um pedido em processamento.', { details: { orderId: pending.order.id } })

  const fields: Record<string, string> = {}
  const collector: Collector = {
    name: text(source?.name),
    email: text(source?.email).toLowerCase(),
    username: optionalText(fields, 'username', source?.username, 32, accountPatterns.username, 'Informe um nome de usuário válido.'),
    profileName: optionalText(fields, 'profileName', source?.profileName, 100),
    referralCode: optionalText(fields, 'referralCode', source?.referralCode, 40, accountPatterns.referralCode,
      'Use até 40 letras, números, hífens ou sublinhados.'),
    ens: optionalText(fields, 'ens', source?.ens, 160, accountPatterns.ens, 'Informe um nome ENS terminado em .eth.'),
    secondaryAddress: optionalText(fields, 'secondaryAddress', source?.secondaryAddress, 42, accountPatterns.address,
      'Informe um endereço com 0x e 40 caracteres hexadecimais.'),
    note: optionalText(fields, 'note', source?.note, 500),
  }
  if (collector.name.length < 2 || collector.name.length > 100) fields.name = 'Use de 2 a 100 caracteres.'
  if (!validEmail(collector.email)) fields.email = 'Informe um e-mail válido.'
  if (!networks.includes(input.network)) fields.network = 'Selecione uma rede compatível.'
  const wallet = account.wallets.find(({ id }) => id === input.walletId)
  if (!wallet || wallet.network !== input.network) fields.walletId = 'Selecione uma carteira cadastrada nesta rede.'
  if (Object.keys(fields).length || !wallet) invalid(fields)
  if (session.connection?.walletId !== wallet.id || session.connection.network !== input.network) {
    return fail(409, 'WALLET_DISCONNECTED', 'Conecte a carteira antes de enviar o pedido.')
  }

  const cart = actorCart(state, request)
  if (cart.items.length === 0) return fail(409, 'CART_EMPTY', 'O carrinho está vazio.')
  const quote = await quoteCart(state, cart, input.network)
  if (quote.items.some(({ available, quantity }) => quantity > available)) {
    return fail(409, 'INSUFFICIENT_STOCK', 'Uma edição não tem mais a quantidade solicitada. Revise seu carrinho.', { details: { quote } })
  }
  if (quote.id !== input.quoteId) {
    return fail(409, 'QUOTE_CHANGED', 'Os valores ou a disponibilidade mudaram. Revise a nova cotação.', { details: { quote } })
  }

  const order: Order = {
    id: `ord_${randomHex(12)}`, userId, status: 'pending', version: 1, createdAt: new Date().toISOString(),
    quote, collector, wallet: { ...wallet }, transactionId: null, explorerUrl: null,
  }
  for (const item of quote.items) {
    const nft = state.nfts.find(({ id }) => id === item.nftId)
    const edition = nft?.editions.find(({ id }) => id === item.editionId)
    if (!nft || !edition) continue
    edition.available -= item.quantity
    recordNftUpdate(tx, nft)
  }
  state.orders.unshift({
    order, key, signature,
    dueAt: state.scenario === 'order-pending' ? null : Date.now() + 1_600,
    outcome: state.scenario === 'payment-declined' ? 'declined' : 'confirmed',
  })
  recordOrderUpdate(tx, order)
  return { order, created: true }
}
