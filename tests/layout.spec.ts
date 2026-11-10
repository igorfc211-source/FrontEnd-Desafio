import { expect, test } from '@playwright/test'
import { addFixture, artworkLink, detailUrl, fixtureTitle, login, openCheckout, prepareScreenshot, visit } from './support'

test('traps keyboard focus in the wallet dialog and restores it on Escape', async ({ page }) => {
  await visit(page, '/wallets')
  await login(page)
  const trigger = page.getByRole('button', { name: /adicionar carteira/i })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    const inDialog = await dialog.evaluate((element) => element.contains(document.activeElement))
    expect(inDialog).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('home @visual', async ({ page }) => {
  await visit(page)
  await expect(artworkLink(page).last()).toBeVisible()
  await prepareScreenshot(page)
  await expect(page).toHaveScreenshot('home.png')
})

test('NFT detail @visual', async ({ page }) => {
  await visit(page, detailUrl)
  await expect(page.getByRole('heading', { name: fixtureTitle, exact: true })).toBeVisible()
  await prepareScreenshot(page)
  await expect(page).toHaveScreenshot('nft-detail.png')
})

test('populated cart @visual', async ({ page }) => {
  await visit(page)
  await addFixture(page)
  await page.goto('/cart')
  await expect(page.getByRole('region', { name: 'Resumo do pedido' })).toHaveAttribute('aria-busy', 'false')
  await prepareScreenshot(page)
  await expect(page).toHaveScreenshot('cart.png')
})

test('checkout @visual', async ({ page }) => {
  await visit(page)
  await openCheckout(page)
  await expect(page.getByRole('region', { name: 'Resumo do pedido' })).toHaveAttribute('aria-busy', 'false')
  await prepareScreenshot(page)
  await expect(page).toHaveScreenshot('checkout.png')
})

test('responsive layout fits the document width at the configured viewport', async ({ page }) => {
  await visit(page)
  await expect(artworkLink(page).last()).toBeVisible()
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(await fits()).toBe(true)
  await addFixture(page)
  expect(await fits()).toBe(true)
  await page.goto('/cart')
  await expect(page.getByRole('region', { name: 'Resumo do pedido' })).toHaveAttribute('aria-busy', 'false')
  expect(await fits()).toBe(true)
})
