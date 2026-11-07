import { expect, test } from '@playwright/test'
import type { Api } from '../../src/preload/api'
import { launchApp } from './launch'

test('packaged app opens and the renderer talks to main', async () => {
  const app = await launchApp()
  try {
    const page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    // The window opened and React rendered (not just the splash).
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check for updates' })).toBeVisible()

    // Preload exposed the API, and an IPC round trip through main works.
    const result = await page.evaluate(async () => {
      const api = (window as unknown as { api: Api }).api
      return { platform: api.platform, settings: await api.getSettings() }
    })
    expect(result.platform).toBe(process.platform)
    expect(result.settings).toEqual({ updateChannel: 'latest' })

    // Switching the channel is saved by main and reported back.
    await page.getByRole('button', { name: /Update channel/ }).click()
    await expect(page.getByText('Update channel: beta')).toBeVisible()

    // The window has a real size and the app is the packaged one.
    const size = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBounds()
    )
    expect(size.width).toBeGreaterThan(400)
    expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true)

    expect(errors).toEqual([])
  } finally {
    await app.close()
  }
})
