import { test as base, expect, type Locator, type Page } from '@playwright/test'
import type { Backup } from '../src/storage/backup'

// Native confirm() dialogs are accepted and recorded. A test must expect each one (expectConfirm);
// any left over fail it, so a confirm a flow didn't plan for (e.g. "Only 1 of 3 sets logged") shows.
const dialogs = new WeakMap<Page, string[]>()

/** Every test opens the app on an empty database. */
export const test = base.extend<{ app: void }>({
  app: [
    async ({ page }, use) => {
      const seen: string[] = []
      dialogs.set(page, seen)
      page.on('dialog', (dialog) => {
        seen.push(dialog.message())
        void dialog.accept()
      })
      await page.goto('/')
      await use()
      expect(seen, 'confirm() dialogs no step expected').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

/** The next confirm() shown matches `message`; it was accepted. */
export async function expectConfirm(page: Page, message: RegExp) {
  const seen = dialogs.get(page)!
  await expect.poll(() => seen.length, `a confirm() matching ${message}`).toBeGreaterThan(0)
  expect(seen.shift()).toMatch(message)
}

export function tab(page: Page, name: 'Today' | 'History' | 'Program') {
  return page.getByRole('navigation').getByRole('button', { name, exact: true })
}

/** The session card for one exercise (its heading starts with the exercise's name). */
export function exerciseCard(page: Page, name: string) {
  return page.locator('.card').filter({ has: page.getByRole('heading', { name: new RegExp(`^${name}`) }) })
}

/**
 * TESTING.md's phone-width checks, run once `ready` (something only that screen shows) is visible:
 * the page doesn't scroll sideways (and if it does, which elements stick out), and no button's label
 * overflows the button.
 */
export async function expectFitsScreen(page: Page, screen: string, ready: Locator) {
  await expect(ready, `${screen} is showing`).toBeVisible()
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

/** Apply the 4-day template and step through its starting numbers (see finishWalkthrough). */
export async function setUpFromTemplate(page: Page, onStep?: (exercise: Locator) => Promise<void>) {
  await tab(page, 'Program').click()
  await page.getByRole('button', { name: 'Use 4-day Upper/Lower' }).click()
  await finishWalkthrough(page, onStep)
  await expect(page.getByRole('button', { name: 'Start Upper A' })).toBeVisible()
}

/**
 * Step through the open starting-numbers walkthrough to the end, keeping each pre-fill. `onStep`
 * runs on every step, with the step's heading (the exercise).
 */
export async function finishWalkthrough(page: Page, onStep?: (exercise: Locator) => Promise<void>) {
  const progress = page.getByText(/^Starting numbers · \d+ of \d+/)
  await expect(progress).toBeVisible()
  while ((await progress.count()) > 0) {
    const at = await progress.innerText()
    await onStep?.(page.getByRole('heading', { level: 2 }))
    await page.getByRole('button', { name: /^(Next|Done)$/ }).click()
    await expect(page.getByText(at, { exact: true })).toHaveCount(0)
  }
}

/** Answer the effort question shown (any scale), picking its first option. */
export async function pickEffort(page: Page) {
  await page
    .getByRole('group', { name: /\(required\)$/ })
    .first()
    .getByRole('button')
    .first()
    .click()
}

/** Log an exercise's prescribed sets at the pre-filled numbers, waiting for each to save. */
export async function logSets(page: Page, exercise: string, count: number) {
  const card = exerciseCard(page, exercise)
  for (let set = 1; set <= count; set++) {
    await card.getByRole('button', { name: 'Log set' }).click()
    await expect(card.locator('.set-list li')).toHaveCount(set)
  }
}

/** Start Upper A, log Bench Press's 3 sets, and finish (confirming that the rest weren't logged). */
export async function logASession(page: Page) {
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  await pickEffort(page)
  await logSets(page, 'Bench Press', 3)
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expectConfirm(page, /^Only 3 of \d+ sets logged\. Finish anyway\?/)
  await expect(page.getByRole('button', { name: 'Start Lower A' })).toBeVisible()
}

const prescribed = (min: number, max: number) => ({ repRange: { min, max }, sets: 3 })

/**
 * A small backup on the RPE scale: one day with a primary and a cable accessory, and two finished
 * sessions between them showing a substitute, an extra set and a note.
 */
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
  sessions: [
    {
      id: 1,
      dayId: 'upper-a',
      startedAt: '2026-10-02T10:00:00.000Z',
      finishedAt: '2026-10-02T11:00:00.000Z',
      exercises: [
        {
          exerciseId: 'bench',
          sets: [1, 2, 3].map(() => ({ weight: 230, reps: 4, rpe: 8 })),
          prescription: prescribed(3, 5),
        },
        {
          exerciseId: 'raise',
          sets: [],
          substitute: { name: 'Dumbbell Lateral Raise', sets: [{ weight: 20, reps: 12 }] },
          prescription: prescribed(12, 15),
        },
      ],
    },
    {
      id: 2,
      dayId: 'upper-a',
      startedAt: '2026-10-04T10:00:00.000Z',
      finishedAt: '2026-10-04T11:00:00.000Z',
      note: 'Bench felt strong; try a longer rest before the last set',
      exercises: [
        {
          exerciseId: 'bench',
          sets: [
            ...[1, 2, 3].map(() => ({ weight: 235, reps: 4, rpe: 8 })),
            { weight: 185, reps: 8, extra: true as const },
          ],
          prescription: prescribed(3, 5),
        },
        {
          exerciseId: 'raise',
          sets: [1, 2, 3].map(() => ({ weight: 15, reps: 13 })),
          prescription: prescribed(12, 15),
        },
      ],
    },
  ],
} satisfies Backup

/** Restore a backup through the Program tab's "Restore from file…". */
export async function restore(page: Page, data: Backup = backup) {
  await tab(page, 'Program').click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'logtelligent-2026-10-05.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  await expectConfirm(page, /^Replace ALL current data with this backup/)
  await expect(page.getByRole('status')).toContainText('Restored the backup')
}

/** History's rows, one per session (each has an Edit button). */
export function historyRows(page: Page) {
  return page.getByRole('button', { name: /^Edit the session on/ })
}
