import { readFile } from 'node:fs/promises'
import {
  atLightestLoad,
  backup,
  exerciseCard,
  expect,
  expectConfirm,
  historyRows,
  logASession,
  logSets,
  restore,
  setUpFromTemplate,
  tab,
  test,
} from './support'

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

test('a fail at the lightest load links to the exercise’s form', async ({ page }) => {
  await restore(page, atLightestLoad)

  await tab(page, 'Today').click()
  const raise = exerciseCard(page, 'Cable Lateral Raise')
  await expect(raise.getByText(/^You're at the lightest load and still missing the minimums\./)).toBeVisible()
  const bench = exerciseCard(page, 'Bench Press')
  await expect(bench.getByRole('button', { name: 'Edit exercise' })).toHaveCount(0)
  await raise.getByRole('button', { name: 'Edit exercise' }).click()
  await expect(tab(page, 'Program')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Edit Cable Lateral Raise' })).toBeInViewport()

  // Coming back to the Program tab later doesn't reopen the form.
  await tab(page, 'Today').click()
  await tab(page, 'Program').click()
  await expect(page.getByRole('heading', { name: 'Edit Cable Lateral Raise' })).toHaveCount(0)
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

test('sets an exercise to Linear and logs it with no effort, which then fixes its scheme', async ({
  page,
}) => {
  await setUpFromTemplate(page)
  await tab(page, 'Program').click()
  await page.getByRole('button', { name: /^Bench Press/ }).click()
  await page.getByRole('button', { name: 'Linear', exact: true }).click()
  await expect(page.getByLabel('Target RPE on the first set')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('Primary · Linear +5 lb · 3 × 7 · Barbell')).toBeVisible()

  await tab(page, 'Today').click()
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  await expect(exerciseCard(page, 'Bench Press').getByRole('group', { name: /\(optional\)$/ })).toBeVisible()
  await logSets(page, 'Bench Press', 3)
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expectConfirm(page, /^Only 3 of \d+ sets logged\. Finish anyway\?/)
  await expect(page.getByRole('button', { name: 'Start Lower A' })).toBeVisible()

  await tab(page, 'Program').click()
  await page.getByRole('button', { name: /^Bench Press/ }).click()
  await expect(page.getByText(/^Fixed once it's been logged/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adaptive', exact: true })).toHaveCount(0)
})
