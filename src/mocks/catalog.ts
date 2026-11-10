import Decimal from 'decimal.js'
import { catalogCategory, catalogNetworks, catalogPrice, categories, type CatalogPage, type Nft } from '../contracts'
import { fail } from './http'
import type { Database } from './store'

const pageSize = 8
const searchable = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '')

function facetCounts<T extends string>(options: readonly T[], catalog: Nft[], field: (nft: Nft) => T) {
  return Object.fromEntries(options.map((option) => [option, catalog.filter((nft) => field(nft) === option).length])) as Record<T, number>
}

export function listNfts(state: Database, request: Request): CatalogPage {
  const search = new URL(request.url).searchParams
  const q = searchable((search.get('q') ?? '').trim().slice(0, 150))
  const category = catalogCategory(search.get('category'))
  const availability = search.get('availability')
  const network = catalogNetworks.find((value) => value === search.get('network'))
  const minPrice = catalogPrice(search.get('minPrice'))
  const maxPrice = catalogPrice(search.get('maxPrice'))
  const featuredOnly = search.get('featuredOnly') === 'true'
  const sort = search.get('sort')
  const requestedPage = Number(search.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const catalog = state.scenario === 'empty' ? [] : state.nfts
  const featured = catalog.filter((nft) => nft.featured)
  const matching = catalog.filter((nft) => {
    if (q && !searchable(`${nft.title} ${nft.creator} ${nft.category}`).includes(q)) return false
    if (category && nft.category !== category) return false
    if (network && nft.network !== network) return false
    if (featuredOnly && !nft.featured) return false
    if (minPrice && new Decimal(nft.price).lt(minPrice)) return false
    if (maxPrice && new Decimal(nft.price).gt(maxPrice)) return false
    if (availability === 'available' && !nft.available) return false
    if (availability === 'sold-out' && nft.available) return false
    return true
  })

  if (sort === 'newest') matching.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (sort === 'price-asc') matching.sort((a, b) => new Decimal(a.price).cmp(b.price))
  if (sort === 'price-desc') matching.sort((a, b) => new Decimal(b.price).cmp(a.price))

  const total = matching.length
  return {
    items: matching.slice((page - 1) * pageSize, page * pageSize), featured, total,
    page, pageSize, totalPages: Math.ceil(total / pageSize),
    facets: {
      categories: facetCounts(categories, catalog, (nft) => nft.category),
      networks: facetCounts(catalogNetworks, catalog, (nft) => nft.network),
    },
  }
}

export function getNft(state: Database, id: string) {
  const nft = state.nfts.find((item) => item.id === id || item.slug === id)
  if (!nft) return fail(404, 'NFT_NOT_FOUND', 'Esta obra não foi encontrada.')
  return nft
}
