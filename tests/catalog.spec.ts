import { expect, test } from '@playwright/test'
import { action, artworkLink, collectorEmail, curatorEmail, detailUrl, fixtureTitle, login, logout, scenario, visit } from './support'

test('combines search, category, availability and sort in the URL and restores the page', async ({ page }) => {
  await visit(page)
  await page.getByRole('button', { name: /próxima página/i }).click()
  await expect(page).toHaveURL(/[?&]page=2/)
  const filters = page.getByRole('button', { name: /^filtros$/i })
  if (await filters.isVisible()) {
    await filters.click()
    await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption('Arte digital')
  } else {
    await page.getByRole('button', { name: /^arte digital\b/i }).click()
  }
  await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('Arte digital')
  await expect(page).not.toHaveURL(/[?&]page=2/)
  await page.getByRole('combobox', { name: 'Disponibilidade', exact: true }).selectOption('available')
  await expect(page).toHaveURL(/[?&]availability=available/)
  const network = page.getByRole('combobox', { name: 'Rede', exact: true })
  if (await network.isVisible()) {
    await network.selectOption('Ethereum')
  } else {
    await page.getByRole('button', { name: 'Ethereum', exact: true }).click()
  }
  await expect(page).toHaveURL(/[?&]network=Ethereum/)
  await page.getByRole('spinbutton', { name: 'Mínimo', exact: true }).fill('1.1')
  await page.getByRole('spinbutton', { name: 'Máximo', exact: true }).fill('2')
  await page.getByRole('button', { name: 'Aplicar faixa de preço', exact: true }).click()
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams
    return ['minPrice', 'maxPrice'].map((key) => params.get(key)?.replaceAll('"', ''))
  }).toEqual(['1.1', '2'])
  const sort = page.getByRole('combobox', { name: 'Ordenar por', exact: true })
  if (!(await sort.isVisible()) && await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape')
  await sort.selectOption('price-desc')
  await expect(page).toHaveURL(/[?&]sort=price-desc/)
  if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape')
  const catalog = page.getByRole('region', { name: 'Explore o catálogo' })
  await expect(artworkLink(catalog.locator('.catalog-results .nft-card').first(), 'Neon Vessel #552')).toBeVisible()
  const search = page.getByRole('searchbox')
  await search.fill('Emerald')
  await search.press('Enter')
  await expect(page).toHaveURL(/[?&]q=Emerald/)
  await expect(artworkLink(page).last()).toBeVisible()
  const filteredUrl = page.url()
  await page.reload()
  await expect(search).toHaveValue('Emerald')
  await page.goBack()
  await expect(search).toHaveValue('')
  await page.goForward()
  await expect(page).toHaveURL(filteredUrl)
  expect(new URL(page.url()).searchParams.get('sort')).toBe('price-desc')
})

test('opens a detail URL directly and renders a missing NFT state', async ({ page }) => {
  await visit(page, detailUrl)
  await expect(page.getByRole('heading', { name: fixtureTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: new RegExp(fixtureTitle, 'i') }).first()).toBeVisible()
  await page.goto('/nft/nao-existe')
  await expect(page.getByText(/NFT não encontrado|NFT indisponível/i).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /voltar|explorar/i }).last()).toBeVisible()
})

test('previews gallery images and enforces the edition quantity limit', async ({ page }) => {
  await visit(page, detailUrl)
  await page.getByRole('button', { name: 'Imagem 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Imagem 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('radio', { name: '1/1', exact: true }).check()
  await expect(page.getByText('Edição esgotada', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /adicionar ao carrinho/i })).toBeDisabled()
  await page.getByRole('radio', { name: '1/50', exact: true }).check()
  await page.getByRole('spinbutton', { name: 'Quantidade' }).fill('999')
  await expect(page.getByRole('spinbutton', { name: 'Quantidade' })).toHaveValue('12')
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
})

test('cancels obsolete catalog requests and renders the newest search result', async ({ page }) => {
  await visit(page)
  await scenario(page, 'out-of-order')
  const search = page.getByRole('searchbox')
  const previous = page.waitForRequest((request) => new URL(request.url()).searchParams.get('q') === 'obs')
  await search.fill('obs')
  await search.press('Enter')
  await expect(page).toHaveURL(/[?&]q=obs/)
  await previous
  await search.fill('Emerald')
  await search.press('Enter')
  await expect(page).toHaveURL(/[?&]q=Emerald/)
  await expect(artworkLink(page).last()).toBeVisible()
  await expect(page.getByRole('heading', { name: /nenhuma obra encontrada/i })).toHaveCount(0)
})

test('shows shimmer loading, an error, successful retry and an empty result', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await visit(page, detailUrl)
  await scenario(page, 'slow')
  await page.goto('/')
  const skeleton = page.getByLabel('Carregando catálogo').locator('.skeleton').first()
  await expect(skeleton).toBeVisible()
  expect(await skeleton.evaluate((element) => getComputedStyle(element, '::before').animationName)).toBe('shimmer')
  await expect(artworkLink(page).last()).toBeVisible()

  for (const [failure, message] of [
    ['server-error', /serviço temporariamente indisponível/i],
    ['offline', /verifique sua conexão/i],
  ] as const) {
    await scenario(page, failure)
    await page.reload()
    await expect(page.getByRole('alert')).toContainText(message)
    await scenario(page, 'default')
    await page.getByRole('button', { name: /tentar novamente/i }).click()
    await expect(artworkLink(page).last()).toBeVisible()
  }

  await scenario(page, 'empty')
  await page.reload()
  await expect(page.getByRole('heading', { name: /nenhuma obra encontrada/i })).toBeVisible()
})

test('rolls back a failed favorite, persists a successful favorite and isolates collectors', async ({ page }) => {
  await visit(page, '/login')
  await login(page, collectorEmail)
  await visit(page, detailUrl)
  const add = page.getByRole('button', { name: /adicionar aos favoritos/i })
  const remove = page.getByRole('button', { name: /remover dos favoritos/i })
  await action(page, { type: 'reject-favorite' })
  const failed = page.waitForResponse((response) =>
    response.url().includes('/api/favorites') && response.request().method() !== 'GET' && !response.ok(),
  )
  await add.click()
  await failed
  await expect(add).toBeVisible()
  await add.click()
  await expect(remove).toBeVisible()
  await page.goto('/favorites')
  await expect(artworkLink(page)).toBeVisible()
  await page.reload()
  await expect(artworkLink(page)).toBeVisible()

  await page.goto('/profile')
  await logout(page)
  await page.goto('/favorites')
  await login(page, curatorEmail)
  await expect(page).toHaveURL(/\/favorites/)
  await expect(artworkLink(page)).toHaveCount(0)
  await expect(artworkLink(page, 'Neon Vessel #552')).toBeVisible()
})
