import { expect, test } from '@playwright/test'
import { expectFitsScreen, logASession, openApp, restore, setUpFromTemplate, tab } from './support'

// Every screen at phone widths: no sideways scrolling, no clipped button labels (TESTING.md).
// The projects in playwright.config.ts run these at 375px and 320px.

test.beforeEach(async ({ page }) => openApp(page))

test('first run: each tab with no program', async ({ page }) => {
  for (const name of ['Today', 'History', 'Program'] as const) {
    await tab(page, name).click()
    await expectFitsScreen(page, `${name}, empty`)
  }
})

test('every step of the starting-numbers walkthrough', async ({ page }) => {
  await setUpFromTemplate(page, (progress) => expectFitsScreen(page, `walkthrough (${progress})`))
  await expectFitsScreen(page, 'Today, ready to start')
})

test('a live session, its exercise menu and the effort picker', async ({ page }) => {
  await setUpFromTemplate(page)
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  await expectFitsScreen(page, 'live session')
  await page.getByRole('button', { name: 'Options for Bench Press' }).click()
  await expectFitsScreen(page, 'exercise menu')
})

test('History, and a finished session opened for editing', async ({ page }) => {
  await setUpFromTemplate(page)
  await logASession(page)
  await tab(page, 'History').click()
  await expectFitsScreen(page, 'History after one session')

  await restore(page)
  await tab(page, 'History').click()
  await expectFitsScreen(page, 'History with a chart')
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  await expectFitsScreen(page, 'finished session, editing')
})

test('Program: days, the exercise picker and form, and changing programs', async ({ page }) => {
  await setUpFromTemplate(page)
  await tab(page, 'Program').click()
  await expectFitsScreen(page, 'Program with a template')

  await page.getByRole('button', { name: /^Bench Press/ }).click()
  await expectFitsScreen(page, 'exercise form, editing')
  await tab(page, 'Program').click()

  await page.getByRole('button', { name: '+ Add exercise' }).first().click()
  await expectFitsScreen(page, 'exercise picker')
  await tab(page, 'Program').click()

  await page.getByRole('button', { name: 'Change your program…' }).click()
  await expectFitsScreen(page, 'change your program')
})
