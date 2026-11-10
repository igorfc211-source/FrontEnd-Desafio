export type Eth = string

export const categories = [
  'Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Colecionáveis',
  'Generativa', 'Jogos', 'Assinaturas', 'Utilidade',
] as const
export const networks = ['Ethereum', 'Polygon'] as const
export const catalogNetworks = [...networks, 'Solana'] as const
export const sorts = ['featured', 'newest', 'price-asc', 'price-desc'] as const
export const walletProviders = ['MetaMask', 'WalletConnect', 'Coinbase Wallet'] as const

export type Category = typeof categories[number]
export type Network = typeof networks[number]
export type CatalogNetwork = typeof catalogNetworks[number]
export type Sort = typeof sorts[number]
export type WalletProvider = typeof walletProviders[number]

export function catalogCategory(value: unknown): Category | undefined {
  return value === 'Arte' ? 'Arte digital' : categories.find((category) => category === value)
}

export function catalogPrice(value: unknown): Eth | undefined {
  return typeof value === 'string' && /^\d{1,12}(?:\.\d{1,18})?$/.test(value) ? value : undefined
}

export interface CatalogSearch {
  q?: string
  category?: Category
  availability?: 'available' | 'sold-out'
  minPrice?: Eth
  maxPrice?: Eth
  network?: CatalogNetwork
  featuredOnly?: boolean
  sort?: Sort
  page?: number
}

export interface Edition {
  id: string
  name: string
  price: Eth
  available: number
  supply: number
}

export interface Nft {
  id: string
  slug: string
  title: string
  creator: string
  category: Category
  network: CatalogNetwork
  description: string
  image: string
  gallery: string[]
  editions: Edition[]
  price: Eth
  previousPrice?: Eth
  available: boolean
  featured: boolean
  createdAt: string
  version: number
  tokenId?: string
  collection?: string
  traits?: string[]
}

export interface CatalogPage {
  items: Nft[]
  featured: Nft[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  facets: {
    categories: Record<Category, number>
    networks: Record<CatalogNetwork, number>
  }
}

export interface Profile {
  id: string
  name: string
  email: string
  avatar: string | null
  bio: string
  username?: string
  ens?: string
  walletNickname?: string
}

export interface Session {
  token: string
  user: Profile
  expiresAt: number
}

export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string }
export type ProfileInput = Omit<Profile, 'id'>
export interface PasswordInput { currentPassword: string; newPassword: string }

export interface WalletInput {
  name: string
  address: string
  network: Network
  primary: boolean
  provider?: WalletProvider
  displayName?: string
  profileName?: string
  referralCode?: string
  email?: string
  ens?: string
  secondaryAddress?: string
}

export interface Wallet extends WalletInput { id: string }

export interface CartItemInput { nftId: string; editionId: string; quantity: number }

export interface CartItem extends CartItemInput {
  id: string
  slug: string
  title: string
  creator: string
  image: string
  edition: string
  available: number
  unitPrice: Eth
  subtotal: Eth
}

export interface Totals {
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
}

export interface Cart extends Totals {
  items: CartItem[]
  coupon: string | null
}

export interface Quote extends Cart {
  id: string
  network: Network
}

export interface Collector {
  name: string
  email: string
  username?: string
  profileName?: string
  referralCode?: string
  ens?: string
  secondaryAddress?: string
  note?: string
}
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface CreateOrderInput {
  quoteId: string
  collector: Collector
  walletId: string
  network: Network
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  version: number
  createdAt: string
  quote: Quote
  collector: Collector
  wallet: Wallet
  transactionId: string | null
  explorerUrl: string | null
}

export interface NftUpdated {
  eventId: string
  nftId: string
  version: number
}

export interface OrderUpdated {
  eventId: string
  orderId: string
  userId: string
  version: number
  status: OrderStatus
}

export interface ApiErrorBody {
  code: string
  message: string
  fields?: Record<string, string>
  details?: { quote?: Quote; orderId?: string }
}

export const scenarios = [
  'default', 'empty', 'slow', 'out-of-order', 'offline', 'timeout', 'validation-error',
  'server-error', 'wallet-refused', 'payment-declined', 'order-timeout', 'order-pending',
] as const

export type Scenario = typeof scenarios[number]

export type MockAction =
  | { type: 'expire-session' | 'expire-coupon' | 'reject-favorite' | 'reject-wallet' }
  | { type: 'price-change'; nftId?: string; editionId?: string; price?: Eth }
  | { type: 'sell-out'; nftId?: string; editionId?: string }
  | { type: 'change-network-fee'; network?: Network; fee?: Eth }
  | { type: 'replay-event'; mode?: 'duplicate' | 'old' }
  | { type: 'disconnect'; duration?: number }
  | { type: 'resolve-orders'; status?: Exclude<OrderStatus, 'pending'> }
