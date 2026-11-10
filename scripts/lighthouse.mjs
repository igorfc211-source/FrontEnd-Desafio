import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { availableParallelism, cpus, platform, release } from 'node:os'
import { createRequire } from 'node:module'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { chromium } from '@playwright/test'

const require = createRequire(import.meta.url)
const output = new URL('../audit-reports/', import.meta.url)
const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4174'
const fixtureTitle = 'Emerald Ape #042'
const pages = [
  ['home', '/'],
  ['detail', '/nft/chromatic-echoes'],
]
const profiles = [['mobile', undefined], ['desktop', desktopConfig]]
const categories = ['performance', 'accessibility', 'best-practices', 'seo']
const targets = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const metrics = ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time']
const chromeFlags = ['--headless=new', '--no-sandbox', '--force-color-profile=srgb']

async function waitForPreview(preview) {
  for (let i = 0; i < 40; i += 1) {
    if (preview?.exitCode !== null && preview?.exitCode !== undefined) {
      throw new Error(`Vite preview ended with exit code ${preview.exitCode}`)
    }
    try {
      if ((await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) })).ok) return
    } catch {
      // Vite may still be starting.
    }
    await sleep(250)
  }
  throw new Error(`No preview server at ${baseUrl}. Run npm run build first.`)
}

function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

function measures(lhr) {
  return {
    ...Object.fromEntries(categories.map((key) => [key, Math.round(lhr.categories[key].score * 100)])),
    ...Object.fromEntries(metrics.map((key) => [key, lhr.audits[key].numericValue])),
  }
}

function fixtureEvidence(result, page, url) {
  const requests = result.lhr.audits['network-requests'].details.items
  const apiPath = page === 'home' ? '/api/nfts' : '/api/nfts/chromatic-echoes'
  const api = requests.find((request) => new URL(request.url).pathname === apiPath && request.statusCode === 200)
  const artwork = result.artifacts.ImageElements.find((image) =>
    image.src === new URL('/art/01.webp', url).href &&
    image.naturalDimensions?.width > 0 &&
    image.node?.snippet?.includes(fixtureTitle),
  )
  if (!api || !artwork) throw new Error(`The real demo fixture was not loaded during the ${page} audit`)
  return { api: api.url, image: artwork.src, alt: fixtureTitle }
}

function failedAudits(lhr, category) {
  return lhr.categories[category].auditRefs
    .filter(({ weight, id }) => weight > 0 && lhr.audits[id].score !== null && lhr.audits[id].score < 1)
    .map(({ id }) => {
      const { title, score, displayValue } = lhr.audits[id]
      return { id, title, score, displayValue }
    })
}

function performanceEvidence(lhr) {
  const mainThread = lhr.audits['mainthread-work-breakdown']?.details?.items ?? []
  const scriptBoot = lhr.audits['bootup-time']?.details?.items ?? []
  const lcpBreakdown = lhr.audits['lcp-breakdown-insight']?.details?.items?.find((item) => item.type === 'table')?.items ?? []
  const opportunities = Object.values(lhr.audits)
    .filter((audit) => audit.details?.type === 'opportunity' && audit.details.overallSavingsMs > 0)
    .sort((left, right) => right.details.overallSavingsMs - left.details.overallSavingsMs)
    .slice(0, 4)
    .map((audit) => ({ id: audit.id, title: audit.title, estimatedSavingsMs: audit.details.overallSavingsMs }))
  return { mainThread, scriptBoot, lcpBreakdown, opportunities }
}

async function runProfile(page, path, profile, config) {
  const samples = []
  for (let run = 1; run <= 3; run += 1) {
    const browser = await launch({
      chromePath: process.env.CHROME_PATH || chromium.executablePath(),
      chromeFlags,
    })
    try {
      const version = await (await fetch(`http://127.0.0.1:${browser.port}/json/version`)).json()
      const url = new URL(path, baseUrl).href
      process.stdout.write(`Lighthouse ${page} / ${profile} / ${run}\n`)
      const result = await lighthouse(
        url,
        { port: browser.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: categories },
        config,
      )
      const lhr = result?.lhr
      if (!lhr || lhr.runtimeError) {
        throw new Error(lhr?.runtimeError?.message ?? 'Lighthouse returned no report')
      }
      const fixture = fixtureEvidence(result, page, url)
      const name = `${page}-${profile}-${run}`
      const [html, json] = result.report
      await Promise.all([
        writeFile(new URL(`${name}.html`, output), html),
        writeFile(new URL(`${name}.json`, output), json),
      ])
      samples.push({ name, version: version.Browser, fixture, lhr, ...measures(lhr) })
    } finally {
      await browser.kill()
    }
  }
  const medians = Object.fromEntries(
    [...categories, ...metrics].map((key) => [key, median(samples.map((sample) => sample[key]))]),
  )
  const belowTarget = categories
    .filter((category) => medians[category] < targets[category])
    .map((category) => {
      const representative = samples.find((sample) => sample[category] === medians[category])
      return { category, target: targets[category], audits: failedAudits(representative.lhr, category) }
    })
  const first = samples[0]
  const performanceRun = samples.find((sample) => sample.performance === medians.performance)
  return {
    page, path, profile, medians, belowTarget,
    performanceEvidence: performanceEvidence(performanceRun.lhr),
    lighthouseVersion: first.lhr.lighthouseVersion,
    browserVersion: first.version,
    settings: first.lhr.configSettings,
    samples: samples.map(({ lhr, ...sample }) => sample),
  }
}

async function main() {
  await mkdir(output, { recursive: true })
  const preview = process.env.LIGHTHOUSE_BASE_URL
    ? undefined
    : spawn(
        process.execPath,
        [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview',
          '--host', '127.0.0.1', '--port', '4174', '--strictPort'],
        { stdio: 'inherit' },
      )
  try {
    await waitForPreview(preview)
    const results = []
    for (const [page, path] of pages) {
      for (const [profile, config] of profiles) {
        results.push(await runProfile(page, path, profile, config))
      }
    }
    const summary = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      scenario: 'default, new browser profile per measurement',
      environment: {
        node: process.version,
        playwright: require('@playwright/test/package.json').version,
        os: `${platform()} ${release()}`,
        cpu: cpus()[0]?.model,
        threads: availableParallelism(),
        chromeFlags,
      },
      targets,
      results,
    }
    await writeFile(new URL('summary.json', output), `${JSON.stringify(summary, null, 2)}\n`)
    console.table(results.map(({ page, profile, medians }) => ({ page, profile, ...medians })))
  } finally {
    if (preview && preview.exitCode === null) {
      const closed = once(preview, 'exit')
      preview.kill()
      await closed
    }
  }
}

await main()
