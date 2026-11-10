import { setupWorker } from 'msw/browser'
import { storeToken } from '../lib/api'
import { handlers } from './handlers'
import { socketHandler } from './socket'
import { resumePendingOrders, subscribeMockControl } from './store'

export async function startMocks() {
  const worker = setupWorker(...handlers, socketHandler)
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  subscribeMockControl((control) => {
    if (control.type !== 'reset') return
    storeToken(null)
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('aether.checkout.')) sessionStorage.removeItem(key)
    }
  })
  resumePendingOrders()
}
