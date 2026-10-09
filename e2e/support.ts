import { expect, type Page } from '@playwright/test'
import type { Backup } from '../src/storage/backup'

/** Open the app with an empty database. Native confirm() dialogs are accepted. */
export async function openApp(page: Page) {
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/')
}

export function tab(page: Page, name: 'Today' | 'History' | 'Program') {
  return page.getByRole('navigation').getByRole('button', { name, exact: true })
}

/**
 * TESTING.md's phone-width checks, run on whatever is on screen: the page doesn't scroll sideways
 * (and if it does, which elements stick out), and no button's label overflows the button.
 */
export async function expectFitsScreen(page: Page, screen: string) {
  const problems = await page.evaluate(() => {
    const name = (el: Element) => {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      const cls = el.getAttribute('class')
      return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}> "${text}"`
    }
    const found: string[] = []
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth) {
      found.push(`the page scrolls sideways (${doc.scrollWidth}px wide on a ${doc.clientWidth}px screen)`)
      const wide = [...document.querySelectorAll('body *')].filter(
        (el) => el.getBoundingClientRect().right > doc.clientWidth + 0.5,
      )
      for (const el of wide.slice(0, 8)) found.push(`  sticks out: ${name(el)}`)
    }
    for (const button of document.querySelectorAll('button')) {
      if (button.scrollWidth > button.clientWidth + 1) found.push(`clipped label: ${name(button)}`)
    }
    return found
  })
  expect(problems, `${screen} at ${page.viewportSize()?.width}px`).toEqual([])
}

/**
 * Apply the 4-day template and step through its starting numbers, keeping each pre-fill. `onStep`
 * runs on every step of the walkthrough.
 */
export async function setUpFromTemplate(page: Page, onStep?: (progress: string) => Promise<void>) {
  await tab(page, 'Program').click()
  await page.getByRole('button', { name: 'Use 4-day Upper/Lower' }).click()
  const step = page.locator('form.walkthrough')
  await expect(step).toBeVisible()
  while ((await step.count()) > 0) {
    const progress = await step.locator('p').first().innerText()
    await onStep?.(progress)
    await step.getByRole('button', { name: /^(Next|Done)$/ }).click()
    await expect(page.getByText(progress, { exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('button', { name: 'Start Upper A' })).toBeVisible()
}

/** Start Upper A, log Bench Press's prescribed sets at the pre-filled numbers, and finish. */
export async function logASession(page: Page) {
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  const effort = page.getByRole('group', { name: /How many more reps could you have done/ }).first()
  await effort.getByRole('button', { name: '2', exact: true }).click()
  for (let set = 1; set <= 3; set++) await page.getByRole('button', { name: 'Log set' }).first().click()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByRole('button', { name: 'Start Lower A' })).toBeVisible()
}

/** A small backup: one day with a primary and a cable accessory, and two finished sessions. */
export const backup = {
  app: 'logtelligent',
  format: 1,
  exportedAt: '2026-10-05T12:00:00.000Z',
  program: {
    id: 'main',
    effortScale: 'rpe',
    days: [
      {
        id: 'upper-a',
        name: 'Upper A',
        exercises: [
          {
            id: 'bench',
            name: 'Bench Press',
            tier: 'primary',
            repRange: { min: 3, max: 5 },
            targetRpe: 8,
            sets: 3,
            equipment: 'barbell',
            maxRelativeJump: 0.1,
            unilateral: false,
            seed: { weight: 225, reps: 5 },
          },
          {
            id: 'raise',
            name: 'Cable Lateral Raise',
            tier: 'accessory',
            repRange: { min: 12, max: 15 },
            targetRpe: 8,
            sets: 3,
            equipment: 'cable',
            loads: [10, 15, 20, 25],
            maxRelativeJump: 0.1,
            unilateral: true,
            seed: { weight: 15, reps: 12 },
          },
        ],
      },
    ],
  },
  sessions: [1, 2].map((n) => ({
    id: n,
    dayId: 'upper-a',
    startedAt: `2026-10-0${n * 2}T10:00:00.000Z`,
    finishedAt: `2026-10-0${n * 2}T11:00:00.000Z`,
    exercises: [
      {
        exerciseId: 'bench',
        sets: [1, 2, 3].map(() => ({ weight: 225 + n * 5, reps: 4, rpe: 8 })),
        prescription: { repRange: { min: 3, max: 5 }, sets: 3 },
      },
      {
        exerciseId: 'raise',
        sets: [1, 2, 3].map(() => ({ weight: 15, reps: 12 + n })),
        prescription: { repRange: { min: 12, max: 15 }, sets: 3 },
      },
    ],
  })),
} satisfies Backup

/** Restore a backup through the Program tab's "Restore from file…". */
export async function restore(page: Page, data: Backup = backup) {
  await tab(page, 'Program').click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'logtelligent-2026-10-05.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  await expect(page.getByRole('status')).toContainText('Restored the backup')
}
