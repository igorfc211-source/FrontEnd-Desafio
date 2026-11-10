import Decimal from 'decimal.js'
import type {
  CartItemInput, Network, Nft, NftUpdated, Order, OrderUpdated, Scenario, Session,
} from '../contracts'
import { makeAccounts, makeCatalog, type Account } from './fixtures'

export type MockEvent =
  | { name: 'nft.updated'; payload: NftUpdated }
  | { name: 'order.updated'; payload: OrderUpdated }

type MockControl = { type: 'disconnect'; duration: number } | { type: 'reset' }
type Listener<T> = (message: T) => void
type Message = { event: MockEvent } | { control: MockControl }

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
  connection?: { walletId: string; network: Network }
}

export interface StoredCart {
  items: CartItemInput[]
  coupon: string | null
}

export interface StoredOrder {
  order: Order
  key: string
  signature: string
  dueAt: number | null
  outcome: 'confirmed' | 'declined'
}

export interface Database {
  nfts: Nft[]
  accounts: Account[]
  sessions: SessionRecord[]
  guestCart: StoredCart
  carts: Record<string, StoredCart>
  orders: StoredOrder[]
  scenario: Scenario
  rejectFavorite: boolean
  rejectWallet: boolean
  couponActive: boolean
  networkFees: Record<Network, string>
  socketOfflineUntil: number
  recentEvent: MockEvent | null
}

export interface Transaction {
  state: Database
  events: MockEvent[]
  effects: Array<() => void>
}

const storageKey = 'marketplace.mock.v2'
const defaultFees = { Ethereum: '0.003', Polygon: '0.0002' }
const eventListeners = new Set<Listener<MockEvent>>()
const controlListeners = new Set<Listener<MockControl>>()
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(storageKey)
let settlementTimer: ReturnType<typeof setTimeout> | undefined

function deliver(message: Message) {
  if ('event' in message) eventListeners.forEach((listener) => listener(message.event))
  else controlListeners.forEach((listener) => listener(message.control))
}

channel?.addEventListener('message', (event: MessageEvent<Message>) => {
  deliver(event.data)
  armSettlement(readDatabase())
})

function publish(message: Message) {
  deliver(message)
  channel?.postMessage(message)
}

export function subscribeEvents(listener: Listener<MockEvent>) {
  eventListeners.add(listener)
  return () => { eventListeners.delete(listener) }
}

export function subscribeMockControl(listener: Listener<MockControl>) {
  controlListeners.add(listener)
  return () => { controlListeners.delete(listener) }
}

export function publishControl(control: MockControl) { publish({ control }) }
export function replayEvent(event: MockEvent) { publish({ event }) }

export function emptyCart(): StoredCart { return { items: [], coupon: null } }

export function fixtureDatabase(): Database {
  return {
    nfts: makeCatalog(), accounts: makeAccounts(), sessions: [], guestCart: emptyCart(),
    carts: {}, orders: [], scenario: 'default', rejectFavorite: false, rejectWallet: false,
    couponActive: true, networkFees: { ...defaultFees }, socketOfflineUntil: 0, recentEvent: null,
  }
}

function readDatabase(): Database {
  const serialized = localStorage.getItem(storageKey)
  if (serialized) {
    try {
      const state = JSON.parse(serialized) as Database
      state.couponActive ??= true
      state.networkFees ??= { ...defaultFees }
      state.socketOfflineUntil ??= 0
      return state
    } catch { /* restore a damaged local fixture */ }
  }
  return fixtureDatabase()
}

function saveDatabase(state: Database) { localStorage.setItem(storageKey, JSON.stringify(state)) }

export function currentScenario() { return readDatabase().scenario }
export function socketOffline() { return readDatabase().socketOfflineUntil > Date.now() }

export function findSession(state: Database, token: string | null) {
  return state.sessions.find((session) => session.token === token && session.expiresAt > Date.now())
}

export function sessionForToken(token: string | null): Session | null {
  const state = readDatabase()
  const session = findSession(state, token)
  const account = state.accounts.find(({ profile }) => profile.id === session?.userId)
  if (!session || !account) return null
  return { token: session.token, expiresAt: session.expiresAt, user: account.profile }
}

export function recordNftUpdate(tx: Transaction, nft: Nft) {
  const available = nft.editions.filter((edition) => edition.available > 0)
  const prices = (available.length ? available : nft.editions).map((edition) => edition.price)
  nft.available = available.length > 0
  nft.price = Decimal.min(...prices).toFixed()
  nft.version += 1
  const event: MockEvent = {
    name: 'nft.updated',
    payload: { eventId: `nft:${nft.id}:${nft.version}`, nftId: nft.id, version: nft.version },
  }
  tx.state.recentEvent = event
  tx.events.push(event)
}

export function recordOrderUpdate(tx: Transaction, order: Order) {
  const event: MockEvent = {
    name: 'order.updated',
    payload: {
      eventId: `order:${order.id}:${order.version}`, orderId: order.id, userId: order.userId,
      status: order.status, version: order.version,
    },
  }
  tx.state.recentEvent = event
  tx.events.push(event)
}

export function randomHex(byteLength: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function settleOrder(tx: Transaction, stored: StoredOrder, outcome = stored.outcome) {
  const { order } = stored
  if (order.status !== 'pending') return

  order.status = outcome
  order.version += 1
  stored.dueAt = null

  if (outcome === 'confirmed') {
    order.transactionId = `0x${randomHex(32)}`
    order.explorerUrl = `https://explorer.example/${order.quote.network.toLowerCase()}/tx/${order.transactionId}`

    const cart = tx.state.carts[order.userId]
    if (cart) {
      cart.items = cart.items.flatMap((line) => {
        const purchased = order.quote.items.find(({ nftId, editionId }) => line.nftId === nftId && line.editionId === editionId)
        const quantity = line.quantity - (purchased?.quantity ?? 0)
        return quantity > 0 ? [{ ...line, quantity }] : []
      })
      if (cart.items.length === 0) cart.coupon = null
    }
  } else {
    for (const item of order.quote.items) {
      const nft = tx.state.nfts.find(({ id }) => id === item.nftId)
      const edition = nft?.editions.find(({ id }) => id === item.editionId)
      if (!nft || !edition) continue
      edition.available = Math.min(edition.supply, edition.available + item.quantity)
      recordNftUpdate(tx, nft)
    }
  }
  recordOrderUpdate(tx, order)
}

function commit(tx: Transaction) {
  saveDatabase(tx.state)
  tx.events.forEach((event) => publish({ event }))
  tx.effects.forEach((effect) => effect())
}

function armSettlement(state: Database) {
  clearTimeout(settlementTimer)
  const due = state.orders.flatMap(({ dueAt }) => dueAt === null ? [] : [dueAt])
  if (due.length) {
    settlementTimer = setTimeout(() => { void transact(false, () => undefined) }, Math.max(0, Math.min(...due) - Date.now()))
  }
}

export function resumePendingOrders() { armSettlement(readDatabase()) }

export async function transact<T>(write: boolean, handler: (tx: Transaction) => T | Promise<T>): Promise<T> {
  async function run() {
    const tx: Transaction = { state: readDatabase(), events: [], effects: [] }
    const due = tx.state.orders.filter(({ dueAt }) => dueAt !== null && dueAt <= Date.now())
    if (due.length) {
      due.forEach((entry) => settleOrder(tx, entry))
      commit(tx)
      tx.events.length = 0
    }
    try {
      const result = await handler(tx)
      if (write) commit(tx)
      return result
    } finally {
      armSettlement(readDatabase())
    }
  }

  if (navigator.locks) return navigator.locks.request(storageKey, run)
  // Older browsers without Web Locks still serialize requests within this tab.
  const result = localQueue.then(run)
  localQueue = result.then(() => undefined, () => undefined)
  return result
}

let localQueue: Promise<void> = Promise.resolve()
