import { useState } from 'react'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, Heart, Minus, Plus, Search } from 'lucide-react'
import type { Cart, CartItemInput, Nft } from '../contracts'
import { api, ApiError } from '../lib/api'
import { catalogOptions, nftOptions } from '../lib/catalog'
import { keys, queryClient } from '../lib/query'
import { scopeKey, useSession } from '../lib/session'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, EmptyState, LoadingError, Notice, Skeleton } from '../components/ui'
import { NftCard } from './catalog'

function BackToCatalog() {
  return <Link to="/" hash="catalogo" className="back-link" aria-label="Voltar ao catálogo"><ArrowLeft size={16} /> <span>Início / Mercado</span></Link>
}

export function NftPage() {
  const { slug } = useParams({ from: '/nft/$slug' })
  const nft = useQuery(nftOptions(slug))
  if (nft.isPending) return <div className="container detail-page" aria-busy="true" aria-label="Carregando NFT">
    <BackToCatalog />
    <div className="detail-layout">
      <div className="gallery"><div className="gallery-thumbs">{[1, 2, 3, 4].map((index) => <Skeleton className="thumbnail-skeleton" key={index} />)}</div>
        <Skeleton className="detail-art" />
      </div>
      <Skeleton className="detail-copy-skeleton" />
    </div>
  </div>
  if (nft.isError) return <div className="container detail-page">{nft.error instanceof ApiError && nft.error.status === 404
    ? <EmptyState title="NFT não encontrado" description="Esta obra não está disponível no catálogo."><Button asChild><Link to="/" hash="catalogo">Explorar catálogo</Link></Button></EmptyState>
    : <LoadingError error={nft.error} onRetry={() => void nft.refetch()} />}</div>
  return <NftDetail key={slug} nft={nft.data} />
}

function NftDetail({ nft }: { nft: Nft }) {
  const [picture, setPicture] = useState(0)
  const [editionId, setEditionId] = useState(nft.editions.find((item) => item.id === 'original' && item.available > 0)?.id ?? nft.editions.find((item) => item.available > 0)?.id ?? nft.editions[0]?.id)
  const [quantity, setQuantity] = useState(1)
  const session = useSession()
  const scope = scopeKey(session)
  const href = useRouterState({ select: (state) => state.location.href })
  const edition = nft.editions.find((item) => item.id === editionId)
  const cart = useQuery({ queryKey: keys.cart(scope), queryFn: ({ signal }) => api.get<Cart>('/cart', signal), enabled: session !== undefined })
  const inCart = cart.data?.items.find((item) => item.nftId === nft.id && item.editionId === edition?.id)?.quantity ?? 0
  const limit = Math.max(0, (edition?.available ?? 0) - inCart)
  const favorites = useQuery({ queryKey: keys.favorites(scope), queryFn: ({ signal }) => api.get<string[]>('/favorites', signal), enabled: !!session })
  const isFavorite = favorites.data?.includes(nft.id) ?? false
  const favorite = useMutation({
    mutationFn: (remove: boolean) => remove ? api.delete<string[]>(`/favorites/${nft.id}`) : api.put<string[]>(`/favorites/${nft.id}`),
    onMutate: async (remove) => {
      const key = keys.favorites(scope)
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<string[]>(key)
      queryClient.setQueryData<string[]>(key, (items = []) => remove ? items.filter((id) => id !== nft.id) : [...items, nft.id])
      return { snapshot }
    },
    onError: (_error, _remove, previous) => {
      if (queryClient.getQueryState(keys.favorites(scope))) queryClient.setQueryData(keys.favorites(scope), previous?.snapshot ?? [])
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.favorites(scope) }),
  })
  const add = useMutation({
    mutationFn: (input: CartItemInput) => api.post<Cart>('/cart/items', input),
    onSuccess: (next) => {
      if (queryClient.getQueryState(keys.cart(scope))) queryClient.setQueryData(keys.cart(scope), next)
      void queryClient.invalidateQueries({ queryKey: keys.quote(scope) })
    },
    onError: () => { void queryClient.invalidateQueries({ queryKey: keys.cart(scope) }); void queryClient.invalidateQueries({ queryKey: keys.nft(nft.slug) }) },
  })
  const gallery = [...new Set([nft.image, ...nft.gallery])]
  const count = Math.min(quantity, limit || 1)
  const favoriteAction = session ? <Button className="favorite-button" variant="secondary" aria-label={isFavorite ? 'Favoritado. Remover dos favoritos' : 'Favoritar. Adicionar aos favoritos'} aria-pressed={isFavorite} disabled={favorite.isPending || !favorites.data} onClick={() => favorite.mutate(isFavorite)}><Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} /><span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span></Button>
    : <Button asChild className="favorite-button" variant="secondary"><Link to="/login" search={{ redirect: href }} aria-label="Favoritar. Entrar para adicionar aos favoritos"><Heart size={19} /><span>Favoritar</span></Link></Button>
  return <div className="container detail-page">
    <BackToCatalog />
    <div className="detail-layout">
      <section className="gallery" aria-label="Galeria da obra">
        {gallery.length > 1 && <div className="gallery-thumbs">{gallery.map((src, index) => <button type="button" key={src} aria-label={`Imagem ${index + 1}`} aria-pressed={index === picture} onClick={() => setPicture(index)}><img src={src} alt="" width="100" height="100" loading="lazy" /></button>)}</div>}
        <figure className="detail-art">
          <img src={gallery[picture] ?? nft.image} alt={nft.title} width="450" height="450" fetchPriority="high" />
          <Dialog>
            <DialogTrigger asChild><Button variant="ghost" className="icon-button gallery-zoom" aria-label="Ampliar imagem"><Search size={21} /></Button></DialogTrigger>
            <DialogContent className="gallery-modal"><DialogTitle>{nft.title}</DialogTitle><DialogDescription>Imagem ampliada da obra selecionada.</DialogDescription><img src={gallery[picture] ?? nft.image} alt={nft.title} width="450" height="450" /></DialogContent>
          </Dialog>
        </figure>
      </section>
      <section className="detail-content" aria-labelledby="detail-title">
        <h1 id="detail-title">{nft.title}</h1>
        <div className="detail-price"><strong>{edition?.price ?? nft.price} ETH</strong><span>por {nft.creator}</span></div>
        <div className="detail-description"><strong>Sobre este NFT:</strong><p>{nft.description}</p></div>
        <fieldset className="edition-field">
          <legend>Edição:</legend>
          <div className="edition-options">
            {nft.editions.map((item) => <label key={item.id} title={item.available === 0 ? 'Edição esgotada' : undefined}>
              <input type="radio" name="edition" value={item.id} checked={item.id === editionId} onChange={() => { setEditionId(item.id); setQuantity(1); add.reset() }} />
              <span>{item.name}</span>
            </label>)}
          </div>
        </fieldset>
        <div className="detail-actions">
          <div className="field quantity-field"><label htmlFor="detail-quantity">Qtd.</label><div className="quantity-stepper">
            <Button variant="primary" className="icon-button" aria-label="Diminuir quantidade" disabled={count <= 1} onClick={() => setQuantity(count - 1)}><Minus size={16} /></Button>
            <input id="detail-quantity" aria-label="Quantidade" type="number" min={1} max={limit || 1} value={count} disabled={!limit} onChange={(event) => setQuantity(Math.max(1, Math.min(limit, Math.floor(event.target.valueAsNumber || 1))))} />
            <Button variant="primary" className="icon-button" aria-label="Aumentar quantidade" disabled={count >= limit} onClick={() => setQuantity(count + 1)}><Plus size={16} /></Button>
          </div></div>
          <div className="detail-buttons">
            <Button className="add-to-cart" aria-label={add.isPending ? undefined : 'Comprar NFT. Adicionar ao carrinho'} disabled={!limit || !edition || add.isPending || session === undefined} onClick={() => edition && add.mutate({ nftId: nft.id, editionId: edition.id, quantity: count })}>{add.isPending ? 'Adicionando…' : 'Comprar NFT'}</Button>
            {favoriteAction}
          </div>
        </div>
        <p className="availability" role="status">{edition?.available ? (limit ? `${limit} disponíveis` : 'Todas as unidades disponíveis já estão no carrinho.') : 'Edição esgotada'}</p>
        {add.isSuccess && <Notice kind="success">Item adicionado. <Link to="/cart" className="text-link">Ver carrinho</Link></Notice>}
        {add.isError && <Notice kind="error">{add.error.message}</Notice>}
        {favorite.isError && <Notice kind="error">{favorite.error.message}</Notice>}
        {favorites.isError && <LoadingError error={favorites.error} onRetry={() => void favorites.refetch()} />}
        <dl className="nft-metadata">
          {nft.tokenId && <div><dt>ID do token:</dt> <dd>{nft.tokenId}</dd></div>}
          {nft.collection && <div><dt>Coleção:</dt> <dd>{nft.collection}</dd></div>}
          {nft.traits?.length ? <div><dt>Atributos:</dt> <dd>{nft.traits.join(', ')}</dd></div> : null}
        </dl>
      </section>
    </div>
    <section className="detail-about"><h2>Detalhes do NFT</h2><p>{nft.description}</p><p><strong>Rede:</strong> {nft.network}</p></section>
    <RelatedWorks nft={nft} />
  </div>
}

function RelatedWorks({ nft }: { nft: Nft }) {
  const related = useQuery(catalogOptions({}))
  const works = related.data?.items.filter((item) => item.id !== nft.id).slice(0, 5)
  if (!works?.length) return null
  return <section className="related-works"><h2>Mais desta coleção</h2><div className="nft-grid">{works.map((item) => <NftCard key={item.id} nft={item} />)}</div></section>
}

export function FavoritesPage() {
  const session = useSession()
  const favorites = useQuery({
    queryKey: keys.favorites(scopeKey(session)),
    queryFn: ({ signal }) => api.get<string[]>('/favorites', signal),
    enabled: !!session,
  })
  const items = useQueries({ queries: (favorites.data ?? []).map(nftOptions) })
  return <div className="container detail-page">
    <p className="eyebrow"><span /> MINHA COLEÇÃO</p><h1>Favoritos</h1>
    <h2 className="sr-only">Obras salvas</h2>
    {favorites.isError && <LoadingError error={favorites.error} onRetry={() => void favorites.refetch()} />}
    {(favorites.isPending || items.some((item) => item.isPending)) && <div className="nft-grid" aria-busy="true"><Skeleton className="card-skeleton" /></div>}
    {favorites.data?.length === 0 && <EmptyState title="Você ainda não tem favoritos" description="Salve as obras que mais gostou para encontrá-las aqui."><Button asChild><Link to="/" hash="catalogo">Explorar catálogo</Link></Button></EmptyState>}
    <div className="nft-grid favorites-grid">{items.flatMap((item) => item.data ? [<NftCard key={item.data.id} nft={item.data} />] : [])}</div>
    {items.some((item) => item.isError) && <LoadingError error={items.find((item) => item.isError)?.error} onRetry={() => { for (const item of items) if (item.isError) void item.refetch() }} />}
  </div>
}
