import Decimal from 'decimal.js'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { catalogNetworks, catalogPrice, categories, type CatalogPage, type CatalogSearch, type Nft } from '../contracts'
import { catalogOptions } from '../lib/catalog'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, EmptyState, LoadingError, Skeleton } from '../components/ui'

export function NftCard({ nft }: { nft: Nft }) {
  return <article className="nft-card">
    <Link to="/nft/$slug" params={{ slug: nft.slug }} className="card-link">
      <div className="card-art"><img src={nft.image} alt="" width="450" height="450" loading="lazy" /></div>
      <div className="card-content"><h3>{nft.title}</h3><div className="card-prices"><strong>{nft.price} ETH</strong>{nft.previousPrice && <del>{nft.previousPrice} ETH</del>}</div>{!nft.available && <span>Esgotado</span>}</div>
    </Link>
  </article>
}

function Hero({ items, pending }: { items: Nft[]; pending: boolean }) {
  const [slide, setSlide] = useState(0)
  const artwork = items[slide] ?? items[0]
  const companion = items.length > 1 ? items[(slide + 1) % items.length] : undefined
  return <section className="hero container" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="hero-kicker">Bem-vindo à Kurio</p>
      <h1 id="hero-title"><span className="desktop-hero-title">Seja dono do futuro<br />da arte digital</span><span className="mobile-hero-title">Seja dono da cultura digital</span></h1>
      <p className="hero-description desktop-hero-title">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p>
      <p className="hero-description mobile-hero-title">Descubra NFTs selecionados de criadores do mundo todo.</p>
      <Button className="hero-cta" asChild><a href="#catalogo">Explorar <ArrowRight className="hero-cta-arrow" size={15} /></a></Button>
    </div>
    <div className="hero-media">
      {artwork ? <Link to="/nft/$slug" params={{ slug: artwork.slug }} className="hero-art" aria-label={`Ver destaque: ${artwork.title}`}>
        <img src={artwork.image} alt={artwork.title} width="450" height="450" fetchPriority="high" />
        {companion && <img className="hero-companion" src={companion.image} alt="" width="60" height="60" />}
      </Link> : pending ? <Skeleton className="hero-skeleton" /> : <div className="hero-placeholder" aria-hidden />}
    </div>
    {items.length > 1 && <div className="hero-dots" aria-label="Obras em destaque">
      {items.slice(0, 3).map((item, index) => <button key={item.id} type="button" aria-label={`Mostrar ${item.title}`} aria-pressed={index === slide} onClick={() => setSlide(index)} />)}
    </div>}
  </section>
}

type FilterProps = {
  search: CatalogSearch
  update: (patch: Partial<CatalogSearch>) => void
  facets?: CatalogPage['facets']
}

function Filters({ search, update, facets, compact = false }: FilterProps & { compact?: boolean }) {
  const id = useId()
  const [minPrice, setMinPrice] = useState(search.minPrice ?? '')
  const [maxPrice, setMaxPrice] = useState(search.maxPrice ?? '')
  useEffect(() => { setMinPrice(search.minPrice ?? ''); setMaxPrice(search.maxPrice ?? '') }, [search.minPrice, search.maxPrice])
  const applyPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('maxPrice') as HTMLInputElement
    if ((minPrice && !catalogPrice(minPrice)) || (maxPrice && !catalogPrice(maxPrice))) {
      input.setCustomValidity('Informe preços decimais válidos com até 18 casas decimais.')
      input.reportValidity()
      return
    }
    if (minPrice && maxPrice && new Decimal(minPrice).greaterThan(maxPrice)) {
      input.setCustomValidity('O preço máximo deve ser maior ou igual ao mínimo.')
      input.reportValidity()
      return
    }
    update({ minPrice: minPrice || undefined, maxPrice: maxPrice || undefined, page: undefined })
  }

  return <div className="filter-fields">
    {compact ? <div className="field"><label htmlFor={`${id}-category`}>Categoria</label>
      <select id={`${id}-category`} value={search.category ?? ''} onChange={(event) => update({ category: categories.find((item) => item === event.target.value), page: undefined })}>
        <option value="">Todas as categorias</option>
        {categories.map((category) => <option key={category}>{category}</option>)}
      </select>
    </div> : <section><h3>Coleções</h3><div className="filter-list" aria-label="Categorias de coleção">
      {categories.map((category) => <button key={category} type="button" aria-label={category} aria-pressed={category === search.category} onClick={() => update({ category: category === search.category ? undefined : category, page: undefined })}><span>{category}</span><span>({facets?.categories[category] ?? 0})</span></button>)}
    </div></section>}
    <form className="price-range" onSubmit={applyPrice}>
      <h3>Faixa de preço</h3>
      <div className="price-inputs">
        <div className="field"><label htmlFor={`${id}-min-price`}>Mínimo</label><input id={`${id}-min-price`} name="minPrice" type="number" min="0" step="any" value={minPrice} placeholder="0,02" onChange={(event) => { setMinPrice(event.target.value); (event.currentTarget.form?.elements.namedItem('maxPrice') as HTMLInputElement | null)?.setCustomValidity('') }} /></div>
        <div className="field"><label htmlFor={`${id}-max-price`}>Máximo</label><input id={`${id}-max-price`} name="maxPrice" type="number" min="0" step="any" value={maxPrice} placeholder="12,30" onChange={(event) => { event.target.setCustomValidity(''); setMaxPrice(event.target.value) }} /></div>
      </div>
      <Button type="submit" aria-label="Aplicar faixa de preço">Aplicar</Button>
    </form>
    {compact ? <div className="field"><label htmlFor={`${id}-network`}>Rede</label>
      <select id={`${id}-network`} value={search.network ?? ''} onChange={(event) => update({ network: catalogNetworks.find((item) => item === event.target.value), page: undefined })}>
        <option value="">Todas as redes</option>
        {catalogNetworks.map((network) => <option key={network}>{network}</option>)}
      </select>
    </div> : <section><h3>Rede</h3><div className="filter-list" aria-label="Redes">
      {catalogNetworks.map((network) => <button key={network} type="button" aria-label={network} aria-pressed={network === search.network} onClick={() => update({ network: network === search.network ? undefined : network, page: undefined })}><span>{network}</span><span>({facets?.networks[network] ?? 0})</span></button>)}
    </div></section>}
    <div className="field"><label htmlFor={`${id}-availability`}>Disponibilidade</label>
      <select id={`${id}-availability`} value={search.availability ?? ''} onChange={(event) => update({ availability: event.target.value as CatalogSearch['availability'] || undefined, page: undefined })}>
        <option value="">Todas as edições</option>
        <option value="available">Disponíveis</option>
        <option value="sold-out">Esgotadas</option>
      </select>
    </div>
    {(search.category || search.availability || search.network || search.minPrice || search.maxPrice) && <Button variant="ghost" onClick={() => update({ category: undefined, availability: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, page: undefined })}>Limpar filtros</Button>}
  </div>
}

function SearchForm({ draft, setDraft, onSubmit, className }: { draft: string; setDraft: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; className?: string }) {
  return <form className={`catalog-search ${className ?? ''}`} onSubmit={onSubmit} role="search">
    <Button className="icon-button" variant="ghost" type="submit" aria-label="Buscar"><img src="/icons/search.svg" width="22" height="22" alt="" /></Button>
    <input type="search" value={draft} aria-label="Buscar NFTs" placeholder="Explorar coleções" onChange={(event) => setDraft(event.target.value)} maxLength={120} />
  </form>
}

export function HomePage() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [draft, setDraft] = useState(search.q ?? '')
  const [filterOpen, setFilterOpen] = useState(false)
  useEffect(() => { setDraft(search.q ?? '') }, [search.q])
  const catalog = useQuery(catalogOptions(search))
  const update: FilterProps['update'] = (patch) => { void navigate({ search: (previous) => ({ ...previous, ...patch }), resetScroll: false }) }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    update({ q: draft.trim() || undefined, page: undefined })
  }
  const page = search.page ?? 1
  const totalPages = catalog.data?.totalPages ?? 0
  const featured = catalog.data?.featured ?? []
  const pending = catalog.isPending
  const searchProps = { draft, setDraft, onSubmit: submit }
  return <>
    <div className="container market-searchbar" id="market-search">
      <SearchForm {...searchProps} />
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogTrigger asChild><Button className="filter-trigger icon-button" aria-label="Filtros"><SlidersHorizontal size={19} /></Button></DialogTrigger>
        <DialogContent><DialogTitle>Filtrar catálogo</DialogTitle><DialogDescription>Combine filtros para refinar as obras.</DialogDescription>
          <Filters compact search={search} update={update} facets={catalog.data?.facets} /><Button onClick={() => setFilterOpen(false)}>Ver resultados</Button>
        </DialogContent>
      </Dialog>
    </div>
    <Hero items={featured} pending={pending} />
    <section id="catalogo" className="container catalog-section" aria-labelledby="catalog-title">
      <h2 id="catalog-title" className="sr-only">Explore o catálogo</h2>
      <div className="catalog-layout">
        <aside className="catalog-sidebar" aria-label="Filtros do catálogo">
          <div className="sidebar-panel"><Filters search={search} update={update} facets={catalog.data?.facets} /></div>
          {featured[1] && <div className="sidebar-feature"><p>NFT em destaque</p><NftCard nft={featured[1]} /></div>}
        </aside>
        <div className="catalog-results">
          <div className="catalog-toolbar" id="catalog-search">
            <div className="catalog-views" aria-label="Vitrine">
              <button type="button" aria-pressed={!search.featuredOnly && search.sort !== 'newest'} onClick={() => update({ featuredOnly: undefined, sort: undefined, page: undefined })}>Todos os NFTs</button>
              <button type="button" aria-pressed={search.sort === 'newest' && !search.featuredOnly} onClick={() => update({ featuredOnly: undefined, sort: 'newest', page: undefined })}>Novos lançamentos</button>
              <button type="button" aria-pressed={!!search.featuredOnly} onClick={() => update({ featuredOnly: true, sort: undefined, page: undefined })}>Em alta</button>
            </div>
            <SearchForm {...searchProps} className="desktop-catalog-search" />
            <select className="sort-select" aria-label="Ordenar por" value={search.sort ?? 'featured'} onChange={(event) => update({ sort: event.target.value as CatalogSearch['sort'], page: undefined })}>
              <option value="featured">Ordenar por: destaques</option><option value="newest">Mais recentes</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option>
            </select>
          </div>
          <p className="sr-only" role="status">{pending ? 'Carregando obras…' : catalog.isFetching ? 'Atualizando catálogo…' : catalog.data ? `${catalog.data.total} obras encontradas` : ''}</p>
          {pending && <div className="nft-grid" aria-busy="true" aria-label="Carregando catálogo">{Array.from({ length: 8 }, (_, index) => <Skeleton className="card-skeleton" key={index} />)}</div>}
          {catalog.isError && <LoadingError error={catalog.error} onRetry={() => void catalog.refetch()} />}
          {catalog.data?.items.length === 0 && <EmptyState title="Nenhuma obra encontrada" description="Experimente outra busca ou altere os filtros.">
            <Button variant="secondary" onClick={() => update({ category: undefined, availability: undefined, q: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, featuredOnly: undefined, page: undefined })}>Limpar busca</Button>
          </EmptyState>}
          {!!catalog.data?.items.length && <div className="nft-grid">{catalog.data.items.map((nft) => <NftCard nft={nft} key={nft.id} />)}</div>}
          {totalPages > 1 && <nav aria-label="Paginação do catálogo" className="pagination">
            <Button className="icon-button" variant="ghost" aria-label="Página anterior" disabled={page <= 1} onClick={() => update({ page: page - 1 <= 1 ? undefined : page - 1 })}><ChevronLeft size={17} /></Button>
            {Array.from({ length: totalPages }, (_, index) => <Button className="icon-button" variant={index + 1 === page ? 'primary' : 'ghost'} aria-label={`Página ${index + 1}`} aria-current={index + 1 === page ? 'page' : undefined} key={index} onClick={() => update({ page: index === 0 ? undefined : index + 1 })}>{index + 1}</Button>)}
            <Button className="icon-button" variant="ghost" aria-label="Próxima página" disabled={page >= totalPages} onClick={() => update({ page: page + 1 })}><ChevronRight size={17} /></Button>
          </nav>}
        </div>
      </div>
    </section>
    {featured.length > 1 && <section className="container collection-banners" aria-label="Seleções do mercado">
      {[{ item: featured[0], title: 'Lançamentos clássicos' }, { item: featured[featured.length - 1], title: 'Arte digital selecionada' }].map(({ item, title }) =>
        <article key={item.id}>
          <img src={item.image} alt={item.title} width="250" height="250" loading="lazy" />
          <div><h2>{title}</h2><p>{item.title}</p><Button asChild><Link to="/nft/$slug" params={{ slug: item.slug }} aria-label={`Explorar: ${item.title}`}>Explorar</Link></Button></div>
        </article>,
      )}
    </section>}
  </>
}

export function HomePreview() {
  const catalog = useQuery(catalogOptions({}))
  return <div inert aria-hidden="true" className="home-preview">
    <Hero items={catalog.data?.featured ?? []} pending={catalog.isPending} />
    <div className="container preview-grid"><div className="sidebar-panel"><h3>Coleções</h3>{categories.map((category) => <p key={category}>{category}</p>)}</div>
      <div className="nft-grid">{catalog.data?.items.slice(0, 6).map((nft) => <NftCard key={nft.id} nft={nft} />)}</div></div>
  </div>
}
