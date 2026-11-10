import { expect, test, type Page } from '@playwright/test'
import type { CreateOrderInput } from '../src/contracts'
import { action, addFixture, detailUrl, fixtureTitle, login, openCheckout, orderSubmission, reviewOrder, scenario, visit } from './support'

const summary = (page: Page) => page.getByRole('region', { name: 'Resumo do pedido' })

test('persists cart and coupon, reconciles a guest cart at login and removes the item', async ({ page }) => {
  await visit(page)
  await addFixture(page)
  await page.goto('/cart')
  await expect(page.getByText(fixtureTitle).first()).toBeVisible()
  await page.getByRole('button', { name: /aumentar quantidade/i }).click()
  await expect(summary(page)).toContainText(/2[.,]38 ETH/)

  const code = page.getByRole('textbox', { name: /^código do cupom$/i })
  await code.fill('NAOEXISTE')
  await page.getByRole('button', { name: /aplicar cupom/i }).click()
  await expect(page.getByRole('alert')).toContainText(/cupom.*inválido/i)
  await code.fill('EXPIRED10')
  await page.getByRole('button', { name: /aplicar cupom/i }).click()
  await expect(page.getByRole('alert')).toContainText(/expirou|expirado/i)
  await code.fill('WELCOME10')
  await page.getByRole('button', { name: /aplicar cupom/i }).click()
  await expect(summary(page)).toContainText(/[-−]0[.,]238 ETH/)
  await page.reload()
  await expect(summary(page)).toContainText(/[-−]0[.,]238 ETH/)

  await page.getByRole('link', { name: /ir para pagamento/i }).click()
  await expect(page).toHaveURL(/\/login/)
  await login(page)
  await expect(page).toHaveURL(/\/checkout/)
  await page.goto('/cart')
  await expect(summary(page)).toContainText(/[-−]0[.,]238 ETH/)
  await page.getByRole('button', { name: /remover cupom/i }).click()
  await expect(summary(page)).not.toContainText(/[-−]0[.,]238 ETH/)
  await page.getByRole('button', { name: `Remover ${fixtureTitle}`, exact: true }).click()
  await expect(page.getByText(/carrinho.*vazio/i).first()).toBeVisible()
})

test('completes a purchase and keeps the confirmed receipt immutable', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await reviewOrder(page)
  await page.getByRole('button', { name: /confirmar compra/i }).click()
  await expect(page).toHaveURL(/\/orders\/[^/?]+/)
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toBeVisible()
  await expect(page.getByText(fixtureTitle).first()).toBeVisible()
  await expect(page.getByText(/^1[.,]19 ETH$/).first()).toBeVisible()
  await expect(page.getByText(/identificador da transação/i)).toBeVisible()
  await expect(page.getByText(/^0x[a-f0-9]{20,}$/i)).toBeVisible()
  await action(page, { type: 'price-change', price: '2.145' })
  await page.reload()
  await expect(page.getByText(/^1[.,]19 ETH$/).first()).toBeVisible()
  await expect(page.getByText(/^2[.,]145 ETH$/)).toHaveCount(0)
  await page.goto('/cart')
  await expect(page.getByText(/carrinho.*vazio/i).first()).toBeVisible()
})

test('handles a refused payment and preserves the cart', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await scenario(page, 'payment-declined')
  await reviewOrder(page)
  await page.getByRole('button', { name: /confirmar compra/i }).click()
  await expect(page.getByRole('heading', { name: /pagamento recusado/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toHaveCount(0)
  await page.goto('/cart')
  await expect(page.getByText(fixtureTitle).first()).toBeVisible()
})

test('switches networks, handles refused wallet connection and can disconnect', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await page.getByLabel(/^rede$/i).selectOption('Polygon')
  await expect(page.getByLabel(/^carteira$/i)).toHaveValue('collector-secondary')
  await expect(summary(page)).toContainText(/0[.,]0002 ETH/)
  const connect = page.getByRole('button', { name: /^conectar carteira$/i })
  await action(page, { type: 'reject-wallet' })
  await connect.click()
  await expect(page.getByRole('alert')).toContainText(/recusad/i)
  await connect.click()
  await expect(page.getByText(/carteira conectada à rede Polygon/i)).toBeVisible()
  await page.getByRole('button', { name: /desconectar carteira/i }).click()
  await expect(connect).toBeEnabled()
  await expect(page.getByRole('button', { name: /revisar pedido/i })).toBeDisabled()
})

test('recovers the same order after timeout and suppresses repeated clicks', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await scenario(page, 'order-timeout')
  await reviewOrder(page)
  const requests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/orders(?:\?|$)/.test(request.url()) && request.method() === 'POST') {
      requests.push(request.headers()['idempotency-key'])
    }
  })
  const submit = page.getByRole('button', { name: /confirmar compra/i })
  const original = orderSubmission(page)
  const recovery = page.waitForRequest((request) =>
    request.url().includes('/api/orders/attempt/') && request.method() === 'GET',
  )
  await submit.dblclick()
  const request = await original
  const key = await request.headerValue('idempotency-key')
  expect(key).toBeTruthy()
  const first = await request.response()
  expect(first === null || !first.ok()).toBe(true)

  expect((await recovery).url()).toContain(key)
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toBeVisible()
  expect(requests[0]).toBe(key)
  expect(requests).toEqual([key])
  const orderUrl = page.url()
  await page.reload()
  await expect(page).toHaveURL(orderUrl)
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toBeVisible()
  const authorization = await request.headerValue('authorization')
  const payload = request.postDataJSON() as CreateOrderInput
  const replays = await page.evaluate(async ({ authorization, key, payload }) => {
    const headers = {
      Authorization: authorization ?? '',
      'Idempotency-Key': key ?? '',
      'Content-Type': 'application/json',
    }
    const send = (data: CreateOrderInput) => fetch('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })
    const same = await send(payload)
    const conflict = await send({ ...payload, collector: { ...payload.collector, name: 'Outro nome' } })
    return { status: same.status, id: (await same.json()).id, conflict: conflict.status }
  }, { authorization, key, payload })
  expect(replays).toEqual({ status: 200, id: new URL(orderUrl).pathname.split('/').at(-1), conflict: 409 })
})

test('revalidates a stale quote when a Socket.IO price or stock event arrives', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await reviewOrder(page)
  await action(page, { type: 'price-change', price: '1.325' })
  await expect(page.getByText(/preço ou.*(?:mudou|atualiz)/i).first()).toBeVisible()
  await expect(page.getByText(/^1[.,]325 ETH$/).first()).toBeVisible()
  await action(page, { type: 'replay-event', mode: 'duplicate' })
  await action(page, { type: 'replay-event', mode: 'old' })
  await expect(page.getByText(/^1[.,]325 ETH$/).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toHaveCount(0)
  await action(page, { type: 'sell-out', editionId: 'original' })
  await expect(page.getByText(/esgotad|disponibilidade.*alter|edição indisponível/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /confirmar compra/i })).toHaveCount(0)
  await page.goto(detailUrl)
  await page.getByRole('radio', { name: '1/50', exact: true }).check()
  await expect(page.getByRole('button', { name: /adicionar ao carrinho/i })).toBeDisabled()
})

test('rejects a stale quote at REST when the socket is offline', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await reviewOrder(page)
  await action(page, { type: 'disconnect', duration: 10_000 })
  await action(page, { type: 'price-change', price: '1.15' })
  const post = orderSubmission(page)
  await page.getByRole('button', { name: /confirmar compra/i }).click()
  const request = await post
  expect((await request.response())?.status()).toBe(409)
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByRole('alert')).toContainText(/revise a nova cotação/i)
  await expect(summary(page)).toContainText(/1[.,]15 ETH/)
  await expect(page.getByRole('button', { name: /confirmar compra/i })).toHaveCount(0)
})

test('recovers a pending order after disconnect and refresh without submitting again', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await scenario(page, 'order-pending')
  await reviewOrder(page)
  const submissions: string[] = []
  page.on('request', (request) => {
    if (/\/api\/orders(?:\?|$)/.test(request.url()) && request.method() === 'POST') submissions.push(request.url())
  })
  await page.getByRole('button', { name: /confirmar compra/i }).click()
  await expect(page.getByRole('heading', { name: /pagamento pendente|pedido pendente/i })).toBeVisible()
  const orderUrl = page.url()
  await addFixture(page)
  await page.goto(orderUrl)
  await expect(page.getByRole('heading', { name: /pagamento pendente|pedido pendente/i })).toBeVisible()
  await action(page, { type: 'disconnect' })
  await action(page, { type: 'resolve-orders', status: 'confirmed' })
  await expect(page.getByText(/conexão restabelecida/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(orderUrl)
  await expect(page.getByRole('heading', { name: /pedido confirmado/i })).toBeVisible()
  expect(submissions).toHaveLength(1)
  await page.goto('/cart')
  await expect(page.getByLabel(`Unidades de ${fixtureTitle}`)).toHaveText('1')
})
