import { HttpResponse } from 'msw'
import type { ApiErrorBody, Session } from '../contracts'
import type { Account } from './fixtures'
import { findSession, type Database, type SessionRecord } from './store'

export class MockApiError extends Error {
  constructor(readonly status: number, readonly body: ApiErrorBody) { super(body.message) }
}

export function fail(status: number, code: string, message: string, extra?: Partial<ApiErrorBody>): never {
  throw new MockApiError(status, { code, message, ...extra })
}

export function invalid(fields: Record<string, string>): never {
  return fail(422, 'VALIDATION', 'Revise os campos indicados.', { fields })
}

export function failure(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message } satisfies ApiErrorBody, { status })
}

export function tokenFrom(request: Request): string | null {
  const authorization = request.headers.get('Authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
}

export function authorized(state: Database, request: Request): { session: SessionRecord; account: Account } {
  const session = findSession(state, tokenFrom(request))
  const account = state.accounts.find(({ profile }) => profile.id === session?.userId)
  if (!session || !account) return fail(401, 'SESSION_REQUIRED', 'Entre na sua conta para continuar.')
  return { session, account }
}

export function readSession(state: Database, request: Request): Session | null {
  if (!tokenFrom(request)) return null
  const { session, account } = authorized(state, request)
  return { token: session.token, expiresAt: session.expiresAt, user: account.profile }
}

export function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const accountPatterns = {
  username: /^[a-z0-9._-]{2,32}$/i,
  address: /^0x[0-9a-f]{40}$/i,
  ens: /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+eth$/i,
  referralCode: /^[a-z0-9_-]{1,40}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
}

export function optionalText(
  fields: Record<string, string>, key: string, input: unknown, limit: number, pattern?: RegExp, message?: string,
) {
  if (input === undefined || input === null) return undefined
  const value = text(input)
  if (typeof input !== 'string' || value.length > limit || (value && pattern && !pattern.test(value))) {
    fields[key] = message ?? `Use até ${limit} caracteres.`
  }
  return value || undefined
}

export async function body<T extends object>(request: Request): Promise<T> {
  try {
    const value: unknown = await request.json()
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as T
  } catch { /* validation response below */ }
  return fail(400, 'INVALID_BODY', 'Envie um corpo JSON válido.')
}
