import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import type { Cart, CatalogPage, Nft, NftUpdated, Order, OrderUpdated } from '../contracts'
import { currentToken } from '../lib/api'
import { keys, queryClient } from '../lib/query'
import { scopeKey, useSession } from '../lib/session'

export function Realtime() {
  const session = useSession()
  const token = session?.token
  const userId = session?.user.id
  const scope = scopeKey(session)
  const [message, setMessage] = useState<{ scope: string; text: string }>()
  useEffect(() => {
    if (session === undefined) return
    const socket = io(import.meta.env.VITE_SOCKET_URL || location.origin, {
      transports: ['websocket'],
      timeout: 1500,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2500,
    })
    const versions = new Map<string, number>()
    let active = true
    let reconnect = false
    const isCurrent = () => active && (token ?? null) === currentToken()
    const fresh = (resource: string, version: number, known = 0) => {
      if (version <= Math.max(known, versions.get(resource) ?? 0)) return false
      versions.set(resource, version)
      return true
    }
    const invalidate = (...queryKeys: ReadonlyArray<readonly unknown[]>) => {
      for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey })
    }

    socket.on('connect', () => {
      if (!isCurrent()) return
      socket.emit('session.subscribe', token ?? null)
      if (reconnect) {
        invalidate(keys.session, keys.catalog(), ['nft'], keys.cart(scope), keys.quote(scope), keys.orders(scope))
        setMessage({ scope, text: 'Conexão restabelecida. Dados sincronizados.' })
      }
      reconnect = true
    })
    socket.on('nft.updated', (event: NftUpdated) => {
      if (!isCurrent()) return
      let known = queryClient.getQueryData<Nft>(keys.nft(event.nftId))?.version ?? 0
      for (const [, data] of queryClient.getQueriesData<CatalogPage>({ queryKey: keys.catalog() })) {
        const version = data?.items.find((item) => item.id === event.nftId)?.version
        known = Math.max(known, version ?? 0)
      }
      const hadChange = fresh(`nft:${event.nftId}`, event.version, known)
      if (!hadChange) return
      if (queryClient.getQueryData<Cart>(keys.cart(scope))?.items.some((item) => item.nftId === event.nftId)) {
        setMessage({ scope, text: 'O preço ou a disponibilidade de um item mudou. Revise os valores atualizados.' })
      }
      invalidate(keys.catalog(), keys.nft(event.nftId), keys.cart(scope), keys.quote(scope))
    })
    socket.on('order.updated', (event: OrderUpdated) => {
      if (!isCurrent() || event.userId !== userId) return
      const cached = queryClient.getQueryData<Order>(keys.order(scope, event.orderId))
      if (cached && cached.status !== 'pending') return
      if (!fresh(`order:${event.orderId}`, event.version, cached?.version)) return
      invalidate(keys.orders(scope), keys.cart(scope), keys.quote(scope))
    })
    return () => {
      active = false
      socket.removeAllListeners()
      socket.disconnect()
    }
  // The identity is stable across profile edits and refreshes of the same session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, token, userId, session === undefined])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(undefined), 7500)
    return () => clearTimeout(timer)
  }, [message])

  return <div className="live-feedback" role="status" aria-atomic="true">{message?.scope === scope && message.text}</div>
}
