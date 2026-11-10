import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Session } from '../contracts'
import { api, ApiError, currentToken, onUnauthorized, storeToken } from './api'
import { keys, queryClient } from './query'

let onChange = () => {}
export function onSessionChange(handler: () => void) {
  onChange = handler
}

export const scopeKey = (session: Session | null | undefined) => session?.user.id ?? 'guest'

function evictPrivate() {
  const filters = { queryKey: ['private'] }
  void queryClient.cancelQueries(filters)
  queryClient.removeQueries(filters)
  queryClient.getMutationCache().clear()
}

export async function acceptSession(session: Session | null) {
  await queryClient.cancelQueries({ queryKey: keys.session })
  const previous = currentToken()
  const next = session?.token ?? null
  if (previous !== next) evictPrivate()
  storeToken(next)
  queryClient.setQueryData(keys.session, session)
  onChange()
}

onUnauthorized((token) => {
  if (token !== currentToken()) return
  storeToken(null)
  evictPrivate()
  queryClient.setQueryData(keys.session, null)
  onChange()
})

export const sessionOptions = queryOptions({
  queryKey: keys.session,
  queryFn: async ({ signal }) => {
    try {
      return await api.get<Session | null>('/session', signal)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  staleTime: 30_000,
  retry: false,
})

export function useSession() {
  return useQuery(sessionOptions).data
}

export function safeRedirect(input: unknown) {
  if (typeof input !== 'string' || !input.startsWith('/') || /^\/[/\\]/.test(input)) return '/'
  const target = new URL(input, location.origin)
  if (target.origin !== location.origin || /^\/(login|register)(\/|$)/.test(target.pathname)) return '/'
  return target.pathname + target.search + target.hash
}
