import type { CatalogNetwork, Category, Nft, Profile, Wallet } from '../contracts'

const works: Array<[
  slug: string, title: string, creator: string, category: Category, network: CatalogNetwork, price: string, art: string,
]> = [
  ['chromatic-echoes', 'Emerald Ape #042', 'Nova Sato', 'Arte digital', 'Ethereum', '1.19', '01'],
  ['orbital-reverie', 'Sage Nomad #009', 'Kai Tanaka', 'Colecionáveis', 'Polygon', '1.69', '02'],
  ['silent-tide', 'Neon Vessel #552', 'Maya Alves', 'Arte digital', 'Ethereum', '1.99', '03'],
  ['soft-machines', 'Cosmic Bloom #118', 'Ivo Ramos', 'Arte 3D', 'Solana', '1.29', '02'],
  ['desert-frequency', 'Violet Nomad #314', 'Noah Sol', 'Colecionáveis', 'Polygon', '1.39', '02'],
  ['neon-botany', 'Ivory Baron #088', 'Luna Moreno', 'Arte digital', 'Ethereum', '1.79', '03'],
  ['glass-dreams', 'Golden Beat #207', 'Nina Costa', 'Música', 'Polygon', '0.99', '04'],
  ['aurora-index', 'Golden Signal #160', 'Kai Tanaka', 'Música', 'Solana', '0.39', '04'],
  ['solstice-archive', 'Golden Frequency #671', 'Maya Alves', 'Fotografia', 'Ethereum', '0.31', '04'],
  ['synthetic-bloom', 'Hollow Bloom #324', 'Ivo Ramos', 'Generativa', 'Ethereum', '0.52', '02'],
  ['lunar-fragments', 'Ivory Echo #451', 'Nina Costa', 'Colecionáveis', 'Solana', '0.57', '03'],
  ['still-motion', 'Emerald Motion #705', 'Nova Sato', 'Arte digital', 'Polygon', '0.96', '01'],
  ['midnight-atlas', 'Midnight Atlas #921', 'Luna Moreno', 'Jogos', 'Ethereum', '0.48', '03'],
  ['violet-circuit', 'Violet Circuit #073', 'Kai Tanaka', 'Assinaturas', 'Polygon', '0.36', '02'],
  ['afterimage', 'Emerald Pass #153', 'Nina Costa', 'Utilidade', 'Ethereum', '0.22', '01'],
  ['material-memory', 'Golden Memory #636', 'Ivo Ramos', 'Colecionáveis', 'Solana', '0.68', '04'],
]

const asset = (name: string) => `/art/${name}.webp`

export function makeCatalog(): Nft[] {
  return works.map(([slug, title, creator, category, network, price, art], index) => {
    const soldOut = index === 11 || index === 15
    const image = asset(art)
    const emerald = index === 0
    const editions = emerald ? [
      { id: 'collector', name: '1/1', price: '2.5', supply: 1, available: 0 },
      { id: 'limited', name: '1/10', price: '1.65', supply: 10, available: 3 },
      { id: 'original', name: '1/50', price, supply: 50, available: 12 },
      { id: 'open', name: 'Aberta', price: '1.29', supply: 120, available: 28 },
    ] : [
      { id: 'original', name: 'Edição original', price, supply: 24, available: soldOut ? 0 : 12 + index % 5 },
      { id: 'collector', name: 'Edição de colecionador', price: '2.5', supply: 6, available: soldOut ? 0 : 3 },
    ]
    return {
      id: slug,
      slug,
      title,
      creator,
      category,
      network,
      image,
      gallery: emerald ? [image, asset('01-view-2'), asset('01-view-3'), asset('01-view-4')] : [image, asset(`${art}-view-2`)],
      description: emerald
        ? 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.'
        : `${title} é uma obra digital de ${creator}. A série explora a relação entre cor, forma e movimento, com tiragem limitada e registro de edição para cada peça.`,
      editions,
      price,
      previousPrice: index === 2 ? '2.29' : undefined,
      available: !soldOut,
      featured: index < 3,
      createdAt: `2026-06-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      version: 1,
      ...(emerald ? { tokenId: '#0042', collection: 'Kurio Apes', traits: ['Óculos', 'Esmeralda', 'Raro'] } : {}),
    }
  })
}

export interface Account {
  profile: Profile
  password: { salt: string; hash: string }
  favorites: string[]
  wallets: Wallet[]
}

export function makeAccounts(): Account[] {
  return [
    {
      profile: {
        id: 'collector', name: 'Alex Martins', email: 'collector@example.com',
        username: 'alexmartins', walletNickname: 'Carteira principal',
        avatar: null, bio: 'Colecionador de arte digital e entusiasta de novas mídias.',
      },
      password: {
        salt: '1d7952cc63792f1fa88d8afafdd94c1a',
        hash: '915da7c2715c10566c0376177e7aaff6d8a1f39d3de31c38d4e767f1a5d4bf74',
      },
      favorites: [],
      wallets: [
        {
          id: 'collector-main', name: 'Carteira principal', address: '0x31a58d32561e321259e04673222014c612767a12',
          network: 'Ethereum', primary: true, provider: 'MetaMask',
        },
        {
          id: 'collector-secondary', name: 'Carteira Polygon', address: '0xa11cdb75a30426412e10ad5e480d237122a004d8',
          network: 'Polygon', primary: false, provider: 'WalletConnect',
        },
      ],
    },
    {
      profile: {
        id: 'curator', name: 'Sofia Nunes', email: 'curator@example.com',
        username: 'sofianunes',
        avatar: null, bio: 'Curadoria independente de arte contemporânea.',
      },
      password: {
        salt: 'c31f9f2b2d4d0614979672b33433282d',
        hash: '41ca563cdc46ac3c9671e89251e52da064495c8f477063c6e4e852442900b357',
      },
      favorites: ['silent-tide'],
      wallets: [{
        id: 'curator-main', name: 'Carteira principal', address: '0xb25a13054e4aebd275c638968ec1f11b7597a21d',
        network: 'Ethereum', primary: true, provider: 'MetaMask',
      }],
    },
  ]
}
