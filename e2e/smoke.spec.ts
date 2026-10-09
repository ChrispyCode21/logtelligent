import { readFile } from 'node:fs/promises'
import { backup, expect, historyRows, logASession, restore, setUpFromTemplate, tab, test } from './support'

// The main flows end to end, in the production build (SPEC §5).

test('sets up from a template, logs a session, and moves on to the next day', async ({ page }) => {
  await setUpFromTemplate(page)
  await logASession(page)

  await tab(page, 'History').click()
  await expect(historyRows(page)).toHaveCount(1)
})

test('restores a backup and shows its history', async ({ page }) => {
  await restore(page)

  await tab(page, 'Today').click()
  await expect(page.getByRole('button', { name: 'Start Upper A' })).toBeVisible()
  await tab(page, 'History').click()
  await expect(historyRows(page)).toHaveCount(backup.sessions.length)
  await expect(page.locator('figure.chart')).toBeVisible()
  await expect(page.getByRole('img', { name: /^Estimated 1RM from \d+\.\d lb to \d+\.\d lb$/ })).toBeVisible()
})

test('exports the data it restored', async ({ page }) => {
  await restore(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^logtelligent-\d{4}-\d{2}-\d{2}\.json$/)
  const exported = JSON.parse(await readFile(await file.path(), 'utf8'))
  expect(exported.program).toEqual(backup.program)
  expect(exported.sessions).toEqual(backup.sessions)
})
