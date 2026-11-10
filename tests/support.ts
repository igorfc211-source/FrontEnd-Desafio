import { expect, type Locator, type Page } from '@playwright/test'
import type { MockAction, Scenario } from '../src/contracts'

export const detailUrl = '/nft/chromatic-echoes'
export const fixtureTitle = 'Emerald Ape #042'
export const fixturePassword = 'Galeria123!'
export const collectorEmail = 'collector@example.com'
export const curatorEmail = 'curator@example.com'

export function artworkLink(root: Page | Locator, title = fixtureTitle) {
  return root.getByRole('link', { name: new RegExp('^' + title + '(?:\\s|$)') })
}

export async function visit(page: Page, path = '/') {
  await page.goto(path)
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch('/api/__mock/scenario')
    return response.headers.get('content-type')?.includes('application/json') ?? false
  })).toBe(true)
}

async function mockPost(page: Page, path: string, data: object) {
  const response = await page.evaluate(async ({ path, data }) => {
    const response = await fetch(`/api/__mock/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return { status: response.status, body: await response.text() }
  }, { path, data })
  expect(response.status, response.body).toBeLessThan(300)
  expect(response.status, response.body).toBeGreaterThanOrEqual(200)
}

export function scenario(page: Page, value: Scenario, reset = false) {
  return mockPost(page, 'scenario', { scenario: value, reset })
}

export function action(page: Page, value: MockAction) {
  return mockPost(page, 'action', value)
}

export async function login(page: Page, email = collectorEmail, password = fixturePassword) {
  await page.getByLabel(/^e-mail$/i).fill(email)
  await page.getByLabel(/^senha$/i).fill(password)
  await expect(page.getByLabel(/^e-mail$/i)).toHaveValue(email)
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function logout(page: Page) {
  const button = page.getByRole('button', { name: /^sair(?: da conta)?$/i }).first()
  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: /menu da conta|abrir menu/i }).click()
  }
  const response = page.waitForResponse((response) => response.url().includes('/api/session/logout'))
  await button.click()
  expect((await response).ok()).toBe(true)
}

export async function addFixture(page: Page, fromCatalog = false) {
  if (fromCatalog) {
    await artworkLink(page).click()
  } else {
    await page.goto(detailUrl)
  }
  await expect(page.getByRole('heading', { name: fixtureTitle, exact: true })).toBeVisible()
  const response = page.waitForResponse((response) =>
    /\/api\/cart\/items(?:\?|$)/.test(response.url()) && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /adicionar ao carrinho/i }).click()
  expect((await response).ok()).toBe(true)
  await expect(page.getByRole('link', { name: 'Ver carrinho', exact: true })).toBeVisible()
}

export async function openCheckout(page: Page) {
  await addFixture(page, true)
  await page.getByRole('link', { name: 'Ver carrinho', exact: true }).click()
  await page.getByRole('link', { name: /ir para pagamento/i }).click()
  await expect(page).toHaveURL(/\/login/)
  await login(page)
  await expect(page).toHaveURL(/\/checkout/)
}

export async function reviewOrder(page: Page) {
  await page.getByRole('button', { name: /^conectar carteira$/i }).click()
  await page.getByRole('button', { name: /revisar pedido/i }).click()
  await expect(page.getByRole('button', { name: /confirmar compra/i })).toBeVisible()
}

export function orderSubmission(page: Page) {
  return page.waitForRequest((request) =>
    /\/api\/orders(?:\?|$)/.test(request.url()) && request.method() === 'POST',
  )
}

export async function prepareScreenshot(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].filter((image) => {
      const rect = image.getBoundingClientRect()
      return rect.top < window.innerHeight && rect.bottom > 0
    }).map((image) => image.decode().catch(() => undefined)))
    window.scrollTo(0, 0)
  })
}
