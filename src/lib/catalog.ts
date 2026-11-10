import { queryOptions } from '@tanstack/react-query'
import { catalogCategory, catalogNetworks, catalogPrice, sorts, type CatalogPage, type CatalogSearch, type Nft } from '../contracts'
import { api } from './api'
import { keys } from './query'

export function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const { q, category, availability, minPrice, maxPrice, network, featuredOnly, sort, page } = raw
  const pageNumber = Number(page)
  return {
    q: typeof q === 'string' ? q.trim().slice(0, 120) || undefined : undefined,
    category: catalogCategory(category),
    availability: availability === 'available' || availability === 'sold-out' ? availability : undefined,
    minPrice: catalogPrice(minPrice),
    maxPrice: catalogPrice(maxPrice),
    network: catalogNetworks.find((item) => item === network),
    featuredOnly: featuredOnly === true || featuredOnly === 'true' ? true : undefined,
    sort: sorts.find((item) => item === sort && item !== 'featured'),
    page: Number.isSafeInteger(pageNumber) && pageNumber > 1 ? pageNumber : undefined,
  }
}

export function catalogOptions(search: CatalogSearch) {
  const params = new URLSearchParams()
  if (search.q) params.set('q', search.q)
  if (search.category) params.set('category', search.category)
  if (search.availability) params.set('availability', search.availability)
  if (search.minPrice) params.set('minPrice', search.minPrice)
  if (search.maxPrice) params.set('maxPrice', search.maxPrice)
  if (search.network) params.set('network', search.network)
  if (search.featuredOnly) params.set('featuredOnly', 'true')
  if (search.sort) params.set('sort', search.sort)
  if (search.page) params.set('page', String(search.page))
  return queryOptions({
    queryKey: keys.catalog(search),
    queryFn: ({ signal }) => api.get<CatalogPage>(`/nfts?${params}`, signal),
  })
}

export function nftOptions(slug: string) {
  return queryOptions({
    queryKey: keys.nft(slug),
    queryFn: ({ signal }) => api.get<Nft>(`/nfts/${encodeURIComponent(slug)}`, signal),
  })
}
