import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { sessionForToken, socketOffline, subscribeEvents, subscribeMockControl } from './store'

// MSW 2.15 strips the default Socket.IO transport path before matching.
const endpoint = new URL('/', import.meta.env.VITE_SOCKET_URL || location.origin)
endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
const socket = ws.link(endpoint.href)

export const socketHandler = socket.addEventListener('connection', (connection) => {
  if (connection.client.url.pathname !== '/socket.io/') {
    connection.server.connect()
    return
  }
  if (socketOffline()) {
    queueMicrotask(() => connection.client.close(1012, 'Service restart'))
    return
  }
  const { client, rawClient } = toSocketIo(connection)
  let token: string | null = null
  client.on('session.subscribe', (_event, next: unknown) => {
    token = typeof next === 'string' ? next : null
  })
  // The WebSocket binding performs the handshake. Engine.IO v4 expects server pings.
  const heartbeat = setInterval(() => rawClient.send('2'), 20_000)
  const stopEvents = subscribeEvents(({ name, payload }) => {
    if ('userId' in payload && sessionForToken(token)?.user.id !== payload.userId) return
    client.emit(name, payload)
  })
  const stopControl = subscribeMockControl(() => {
    dispose()
    rawClient.close(1012, 'Service restart')
  })
  function dispose() {
    clearInterval(heartbeat)
    stopEvents()
    stopControl()
  }
  rawClient.addEventListener('close', dispose, { once: true })
})
