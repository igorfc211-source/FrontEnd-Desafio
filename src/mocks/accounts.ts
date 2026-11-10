import type {
  LoginInput, Network, PasswordInput, ProfileInput, RegisterInput, Session, Wallet, WalletInput,
} from '../contracts'
import { networks, walletProviders } from '../contracts'
import { accountPatterns, authorized, fail, failure, invalid, optionalText, text, validEmail } from './http'
import { emptyCart, randomHex, type Database } from './store'
import type { Account } from './fixtures'

const sessionLifetime = 6 * 60 * 60 * 1000

async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', iterations: 120_000,
    salt: new Uint8Array(salt.match(/../g)?.map((byte) => Number.parseInt(byte, 16)) ?? []),
  }, key, 256)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function passwordInput(value: unknown): string {
  return typeof value === 'string' && value.length <= 128 ? value : ''
}

function validName(value: string) { return value.length >= 2 && value.length <= 100 }

function startSession(state: Database, account: Account): Session {
  const { profile } = account
  const session = { token: randomHex(32), userId: profile.id, expiresAt: Date.now() + sessionLifetime }
  state.sessions = state.sessions.filter(({ expiresAt }) => expiresAt > Date.now())
  state.sessions.push(session)
  const cart = state.carts[profile.id] ??= emptyCart()
  for (const line of state.guestCart.items) {
    const existing = cart.items.find(({ nftId, editionId }) => nftId === line.nftId && editionId === line.editionId)
    if (!existing) {
      cart.items.push({ ...line })
      continue
    }
    const available = state.nfts.find(({ id }) => id === line.nftId)
      ?.editions.find(({ id }) => id === line.editionId)?.available ?? 0
    // Preserve the larger existing quantity when an edition became unavailable before login.
    existing.quantity = Math.min(existing.quantity + line.quantity, Math.max(available, existing.quantity, line.quantity))
  }
  cart.coupon ??= state.guestCart.coupon
  state.guestCart = emptyCart()
  return { token: session.token, expiresAt: session.expiresAt, user: profile }
}

export async function login(state: Database, input: LoginInput): Promise<Session> {
  const email = text(input.email).toLowerCase()
  const password = passwordInput(input.password)
  const fields: Record<string, string> = {}
  if (!validEmail(email)) fields.email = 'Informe um e-mail válido.'
  if (!password) fields.password = 'Informe a senha.'
  if (Object.keys(fields).length) invalid(fields)
  const account = state.accounts.find(({ profile }) => profile.email === email)
  if (!account || await passwordHash(password, account.password.salt) !== account.password.hash) {
    return fail(400, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
  }
  return startSession(state, account)
}

export async function register(state: Database, input: RegisterInput): Promise<Session> {
  const name = text(input.name)
  const email = text(input.email).toLowerCase()
  const password = passwordInput(input.password)
  const fields: Record<string, string> = {}
  if (!validName(name)) fields.name = 'Use de 2 a 100 caracteres.'
  if (!validEmail(email)) fields.email = 'Informe um e-mail válido.'
  if (password.length < 8) fields.password = 'Use de 8 a 128 caracteres.'
  if (Object.keys(fields).length) invalid(fields)
  checkEmail(state, email)
  const salt = randomHex(16)
  const account: Account = {
    profile: { id: crypto.randomUUID(), name, email, avatar: null, bio: '' },
    password: { salt, hash: await passwordHash(password, salt) },
    favorites: [], wallets: [],
  }
  state.accounts.push(account)
  return startSession(state, account)
}

function checkEmail(state: Database, email: string, owner?: string) {
  if (state.accounts.some(({ profile }) => profile.email === email && profile.id !== owner)) {
    fail(409, 'EMAIL_EXISTS', 'Já existe uma conta com este e-mail.', {
      fields: { email: 'Este e-mail já está cadastrado.' },
    })
  }
}

export function updateProfile(state: Database, request: Request, input: Partial<ProfileInput>) {
  const { account } = authorized(state, request)
  const { profile } = account
  const name = input.name === undefined ? profile.name : text(input.name)
  const email = input.email === undefined ? profile.email : text(input.email).toLowerCase()
  const bio = input.bio === undefined ? profile.bio : text(input.bio)
  const avatar = input.avatar === undefined ? profile.avatar : input.avatar
  const fields: Record<string, string> = {}
  const username = optionalText(fields, 'username', input.username ?? profile.username, 32, accountPatterns.username,
    'Use de 2 a 32 letras, números, pontos, hífens ou sublinhados.')
  const ens = optionalText(fields, 'ens', input.ens ?? profile.ens, 160, accountPatterns.ens, 'Informe um nome ENS terminado em .eth.')
  const walletNickname = optionalText(fields, 'walletNickname', input.walletNickname ?? profile.walletNickname, 60)
  if (!validName(name)) fields.name = 'Use de 2 a 100 caracteres.'
  if (!validEmail(email)) fields.email = 'Informe um e-mail válido.'
  if (bio.length > 280) fields.bio = 'Use até 280 caracteres.'
  if (avatar !== null && (typeof avatar !== 'string' || avatar.length > 1_400_000 ||
    !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar))) {
    fields.avatar = 'Selecione uma imagem PNG, JPEG, WebP ou GIF de até 1 MB.'
  }
  if (Object.keys(fields).length) invalid(fields)
  checkEmail(state, email, profile.id)
  if (username && state.accounts.some((item) => item.profile.id !== profile.id && item.profile.username?.toLowerCase() === username.toLowerCase())) {
    fail(409, 'USERNAME_EXISTS', 'Este nome de usuário já está em uso.', { fields: { username: 'Escolha outro nome de usuário.' } })
  }
  account.profile = { id: profile.id, name, email, bio, avatar, username, ens, walletNickname }
  return account.profile
}

export async function updatePassword(state: Database, request: Request, input: PasswordInput) {
  const { account, session } = authorized(state, request)
  const current = passwordInput(input.currentPassword)
  const next = passwordInput(input.newPassword)
  const fields: Record<string, string> = {}
  if (!current) fields.currentPassword = 'Informe a senha atual.'
  if (next.length < 8) fields.newPassword = 'Use de 8 a 128 caracteres.'
  else if (current === next) fields.newPassword = 'Escolha uma senha diferente da atual.'
  if (Object.keys(fields).length) invalid(fields)
  if (await passwordHash(current, account.password.salt) !== account.password.hash) {
    invalid({ currentPassword: 'Senha atual incorreta.' })
  }
  const salt = randomHex(16)
  account.password = { salt, hash: await passwordHash(next, salt) }
  state.sessions = state.sessions.filter(({ userId, token }) => userId !== account.profile.id || token === session.token)
}

export function saveWallet(state: Database, request: Request, input: WalletInput, id?: string) {
  const { account } = authorized(state, request)
  const existing = id ? account.wallets.find((wallet) => wallet.id === id) : undefined
  if (id && !existing) fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')

  const name = text(input.name)
  const address = text(input.address).toLowerCase()
  const { network } = input
  const fields: Record<string, string> = {}
  const provider = input.provider ?? existing?.provider
  const displayName = optionalText(fields, 'displayName', input.displayName ?? existing?.displayName, 100)
  const profileName = optionalText(fields, 'profileName', input.profileName ?? existing?.profileName, 100)
  const referralCode = optionalText(fields, 'referralCode', input.referralCode ?? existing?.referralCode, 40, accountPatterns.referralCode,
    'Use até 40 letras, números, hífens ou sublinhados.')
  const email = optionalText(fields, 'email', input.email ?? existing?.email, 254, accountPatterns.email, 'Informe um e-mail válido.')
  const ens = optionalText(fields, 'ens', input.ens ?? existing?.ens, 160, accountPatterns.ens, 'Informe um nome ENS terminado em .eth.')
  const secondaryAddress = optionalText(fields, 'secondaryAddress', input.secondaryAddress ?? existing?.secondaryAddress, 42,
    accountPatterns.address, 'Informe um endereço com 0x e 40 caracteres hexadecimais.')
  if (name.length < 2 || name.length > 60) fields.name = 'Use de 2 a 60 caracteres.'
  if (!accountPatterns.address.test(address)) fields.address = 'Informe um endereço com 0x e 40 caracteres hexadecimais.'
  if (!networks.includes(network)) fields.network = 'Selecione uma rede compatível.'
  if (provider !== undefined && !walletProviders.includes(provider)) fields.provider = 'Selecione um tipo de carteira compatível.'
  if (Object.keys(fields).length) invalid(fields)
  if (account.wallets.some((wallet) => wallet.address === address && wallet.network === network && wallet.id !== id)) {
    fail(409, 'WALLET_EXISTS', 'Esta carteira já está cadastrada na rede.', {
      fields: { address: 'Esta carteira já está cadastrada na rede.' },
    })
  }

  const primary = input.primary === true || !account.wallets.some((wallet) => wallet.primary && wallet.id !== id)
  const wallet: Wallet = {
    id: id ?? crypto.randomUUID(), name, address, network, primary, provider, displayName, profileName,
    referralCode, email, ens, secondaryAddress,
  }
  account.wallets = [...account.wallets.filter((entry) => entry.id !== id), wallet].map((entry) =>
    wallet.primary && entry.id !== wallet.id ? { ...entry, primary: false } : entry)
  for (const session of state.sessions) {
    if (session.userId === account.profile.id && session.connection?.walletId === wallet.id) delete session.connection
  }
  return wallet
}

export function connectWallet(state: Database, request: Request, id: string, network: Network) {
  const { account, session } = authorized(state, request)
  const wallet = account.wallets.find((item) => item.id === id)
  if (!wallet) return fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
  if (wallet.network !== network) invalid({ network: 'Selecione a rede cadastrada para esta carteira.' })
  if (state.rejectWallet || state.scenario === 'wallet-refused') {
    state.rejectWallet = false
    delete session.connection
    return failure(409, 'WALLET_REFUSED', 'Conexão recusada pela carteira. Tente novamente.')
  }
  session.connection = { walletId: id, network }
  return { connected: true as const, walletId: id, network }
}
