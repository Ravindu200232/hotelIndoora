// Import `test` and `expect` from here, not from '@playwright/test'.
//
// Every test fails when the page throws, logs a console error, or a request
// answers 5xx - a page that renders while broken is still broken.
//
// A negative test provokes a 401 or 403 on purpose, and the browser logs every
// 4xx sub-request as a console error. Declare it, and only it, for that test:
//
//   test.use({ allowedStatuses: [401, 403] })
import fs from 'node:fs'
import path from 'node:path'
import { test as base, expect } from '@playwright/test'
import { startLiveView } from './live-view.js'

export const test = base.extend({
  allowedStatuses: [[], { option: true }],
  page: async ({ page, allowedStatuses }, use, testInfo) => {
    const problems = []
    const allowed = new Set(allowedStatuses)
    // The session probe answers 401 whenever nobody is signed in: that is how a
    // page asks whether anyone is, so it is not a fault. Every other 401, and
    // every 403, still counts.
    const SESSION_PROBE = '/api/v1/auth/session'
    page.on('pageerror', error => problems.push(`page error: ${error.message}`))
    page.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      const status = /status of (\d{3})/.exec(text)?.[1]
      if (status && allowed.has(Number(status))) return
      if (status === '401' && String(message.location()?.url ?? '').endsWith(SESSION_PROBE)) return
      problems.push(`console error: ${text}`)
    })
    // Every call this test's page made to the app's own API, and what it answered. The Testing
    // view links each one to its handler as E2E evidence; a unit test only links what it imports.
    let origin = ''
    try { origin = new URL(testInfo.project.use?.baseURL || process.env.BASE_URL).origin } catch { /* any origin */ }
    const apiCalls = new Set()
    page.on('response', response => {
      const status = response.status()
      if (status >= 500 && !allowed.has(status)) problems.push(`HTTP ${status} ${response.url()}`)
      try {
        const url = new URL(response.url())
        if ((!origin || url.origin === origin) && /^\/api(\/|$)/.test(url.pathname)) {
          apiCalls.add(`${response.request().method()} ${url.pathname} ${status}`)
        }
      } catch { /* not a URL of the app */ }
    })
    // When the Studio started this run, what the browser shows appears in its preview.
    // Watching must never change a test's outcome: it is best-effort and swallows its own errors.
    const stopLive = await startLiveView(page, testInfo).catch(() => async () => {})
    // The runner starts the gateway first and the services behind it, so a page can
    // be served while they are still booting. Wait for the API itself once, so no
    // layer races a service that has not opened its port yet.
    const deadline = Date.now() + 60_000
    let apiReady = false
    while (!apiReady && Date.now() < deadline) {
      apiReady = await page.request.get('/api/v1/room-types').then(r => r.status() === 200).catch(() => false)
      if (!apiReady) await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (!apiReady) throw new Error("the app's services did not answer within 60s")
    try {
      await use(page)
    } finally {
      await stopLive().catch(() => {})
      if (apiCalls.size) {
        await testInfo.attach('api-calls', { body: JSON.stringify([...apiCalls]), contentType: 'application/json' })
          .catch(() => {})
      }
    }
    expect(problems, 'the page reported problems').toEqual([])
  },
})

/**
 * Call the app's own API exactly as the signed-in browser does - same cookies, same
 * origin. `page.request` and a fresh `request` context do not reliably carry the
 * page's session, so an authorization test built on them sees a 401 where the app
 * really answers 403.
 *
 *   await signIn(page)                       // the app's own sign-in journey
 *   const api = apiFrom(page)
 *   expect((await api.get('/api/users')).status).toBe(403)
 *
 * The page must already be on the app (any page of it), not about:blank.
 */
export function apiFrom(page) {
  const call = async (method, url, body) => {
    if (page.url() === 'about:blank') throw new Error('apiFrom(page): open a page of the app first (page.goto)')
    return page.evaluate(async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      let json = null
      try { json = await response.json() } catch { /* not JSON */ }
      return { status: response.status, body: json }
    }, { method, url, body })
  }
  return {
    get: url => call('GET', url),
    post: (url, body) => call('POST', url, body ?? {}),
    put: (url, body) => call('PUT', url, body ?? {}),
    patch: (url, body) => call('PATCH', url, body ?? {}),
    delete: url => call('DELETE', url),
  }
}

/**
 * Screenshot-match a page against its recorded baseline - the same self-recording
 * check visual.spec.js does for signed-out public routes. A missing baseline is
 * written and the check passes with a "first run: baseline recorded" annotation;
 * a later run compares against it.
 *
 * Use this for any *additional* screen a journey needs a visual check for (a
 * signed-in member page, an admin screen) instead of hand-writing the
 * fs.existsSync/page.screenshot logic again, and instead of editing
 * visual.spec.js itself, which only ever covers signed-out public routes -
 * signed in, every route shows the same sign-in redirect there.
 *
 *   await signIn(page, 'admin')
 *   await page.goto('/admin/bookings')
 *   await expectMatchesBaseline(page, testInfo, 'admin-bookings')
 */
export async function expectMatchesBaseline(page, testInfo, name) {
  const file = `${name}.png`
  const baseline = testInfo.snapshotPath(file)
  if (!fs.existsSync(baseline) && !process.env.CI && testInfo.config.updateSnapshots !== 'none') {
    fs.mkdirSync(path.dirname(baseline), { recursive: true })
    await page.screenshot({ path: baseline, fullPage: true, animations: 'disabled' })
    testInfo.annotations.push({ type: 'baseline', description: 'first run: baseline recorded, nothing to compare yet' })
    return
  }
  await expect(page).toHaveScreenshot(file, { fullPage: true })
}

/**
 * Sign in through the app's own sign-in page, as the person being tested would.
 *
 *   await signIn(page)                      // the seeded guest: My Bookings
 *   await signIn(page, 'hotel_staff')       // the seeded desk account: Dashboard
 *   await signIn(page, 'guest', { email: 'priya.nair@example.com' })
 *
 * The credentials are the ones the seed creates (the same review accounts the
 * sign-in page offers as buttons); they are passed to the form rather than typed
 * into the review buttons, so the journey goes through the real door. It returns
 * when the page the role lands on is open, so the caller can carry straight on.
 */
export const REVIEW_ACCOUNTS = {
  hotel_staff: { email: 'hotel.staff@example.com', password: 'Demo!2026', home: '/staff' },
  guest: { email: 'marta.ferreira@example.com', password: 'Demo!2026', home: '/my-bookings' },
}

export async function signIn(page, role = 'guest', { email, password, home } = {}) {
  const account = REVIEW_ACCOUNTS[role]
  if (!account) throw new Error(`signIn: no review account for role "${role}"`)
  const credentials = {
    email: email ?? account.email,
    password: password ?? account.password,
  }
  await page.goto('/login')
  await page.getByLabel('Email address').fill(credentials.email)
  // `exact` matters here: the field's own label is "Password", and the show/hide
  // button beside it is labelled "Show password".
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(url => new URL(url).pathname === (home ?? account.home))
  return page
}

export { expect }
