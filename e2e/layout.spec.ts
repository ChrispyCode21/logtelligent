import {
  exerciseCard,
  expectConfirm,
  expectFitsScreen,
  finishWalkthrough,
  historyRows,
  logASession,
  logSets,
  pickEffort,
  restore,
  setUpFromTemplate,
  tab,
  test,
} from './support'

// Every screen and state at phone widths: no sideways scrolling, no clipped button labels
// (TESTING.md). The projects in playwright.config.ts run these at 375px and 320px. Each check names
// something only that screen shows, so it measures the screen it says it does.

test('first run: each tab with no program', async ({ page }) => {
  await expectFitsScreen(page, 'Today, empty', page.getByText('No program yet'))
  await tab(page, 'History').click()
  await expectFitsScreen(page, 'History, empty', page.getByText('No exercises yet'))
  await tab(page, 'Program').click()
  await expectFitsScreen(page, 'Program, empty', page.getByRole('button', { name: 'Use 4-day Upper/Lower' }))
})

test('every step of the starting-numbers walkthrough, and Today once it is done', async ({ page }) => {
  await setUpFromTemplate(page, (exercise) => expectFitsScreen(page, 'walkthrough step', exercise))
  await expectFitsScreen(page, 'Today, ready to start', page.getByRole('button', { name: 'Start Upper A' }))
})

test('Today: starting numbers still needed, and a day out of rotation', async ({ page }) => {
  await tab(page, 'Program').click()
  await page.getByRole('button', { name: 'Use 4-day Upper/Lower' }).click()
  await page.getByRole('button', { name: 'Finish later' }).click()
  await expectFitsScreen(
    page,
    'starting numbers needed',
    page.getByRole('heading', { name: 'Starting numbers needed' }),
  )

  await page.getByRole('button', { name: 'Enter starting numbers' }).click()
  await finishWalkthrough(page)
  await page.getByRole('combobox').selectOption({ label: 'Lower A' })
  await expectConfirm(page, /^Lower A isn't next in the rotation/)
  await expectFitsScreen(page, 'a day out of rotation', page.getByRole('button', { name: 'Start Lower A' }))
})

test('a live session on Reps left, and the exercise menu', async ({ page }) => {
  await setUpFromTemplate(page)
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  await expectFitsScreen(
    page,
    'live session (Reps left)',
    page.getByRole('button', { name: 'Finish session' }),
  )
  await page.getByRole('button', { name: 'Options for Bench Press' }).click()
  await expectFitsScreen(page, 'exercise menu', page.getByRole('button', { name: 'Replace…' }))
})

test('a live session on RPE: set states, extra sets, replace and skip', async ({ page }) => {
  await restore(page)
  await tab(page, 'Today').click()
  await expectFitsScreen(page, 'Today with a note from last time', page.getByText(/^Last time:/))
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  await expectFitsScreen(page, 'live session (RPE)', page.getByRole('group', { name: /\(required\)$/ }))

  await pickEffort(page)
  await logSets(page, 'Bench Press', 3)
  const bench = exerciseCard(page, 'Bench Press')
  await expectFitsScreen(page, 'all sets logged', bench.getByRole('button', { name: '+ Add set' }))

  await bench.locator('.set-row').first().click()
  await expectFitsScreen(page, 'editing a logged set', bench.getByRole('button', { name: 'Delete set' }))
  await bench.getByRole('button', { name: 'Cancel' }).click()

  await bench.getByRole('button', { name: '+ Add set' }).click()
  await expectFitsScreen(page, 'extra set form', bench.getByRole('button', { name: 'Cancel' }))
  await bench.getByRole('button', { name: 'Cancel' }).click()

  const raise = exerciseCard(page, 'Cable Lateral Raise')
  await page.getByRole('button', { name: 'Options for Cable Lateral Raise' }).click()
  await raise.getByRole('button', { name: 'Replace…' }).click()
  await expectFitsScreen(page, 'replace form', raise.getByPlaceholder('e.g. Machine chest press'))
  await raise
    .getByPlaceholder('e.g. Machine chest press')
    .fill('Dumbbell Lateral Raise, seated, slow negatives')
  await raise.getByRole('button', { name: 'Replace', exact: true }).click()
  await expectFitsScreen(page, 'a replaced exercise', raise.getByText('Dumbbell Lateral Raise, seated'))

  await page.getByRole('button', { name: 'Options for Cable Lateral Raise' }).click()
  await raise.getByRole('button', { name: 'Undo replace' }).click()
  await page.getByRole('button', { name: 'Options for Cable Lateral Raise' }).click()
  await raise.getByRole('button', { name: 'Skip today' }).click()
  await expectFitsScreen(page, 'a skipped exercise', raise.getByRole('heading', { name: /skipped today$/ }))
})

test('a live session on Perceived effort', async ({ page }) => {
  await restore(page)
  await page.getByRole('button', { name: 'Perceived effort' }).click()
  await tab(page, 'Today').click()
  await page.getByRole('button', { name: 'Start Upper A' }).click()
  await expectFitsScreen(page, 'live session (Perceived)', page.getByRole('group', { name: /\(required\)$/ }))
})

test('History, and a finished session opened for editing', async ({ page }) => {
  await setUpFromTemplate(page)
  await logASession(page)
  await tab(page, 'History').click()
  await expectFitsScreen(page, 'History after one session', historyRows(page))

  await restore(page)
  await tab(page, 'History').click()
  await expectFitsScreen(
    page,
    'History with a chart, substitute, extra set and note',
    page.locator('figure.chart'),
  )
  await historyRows(page).first().click()
  await expectFitsScreen(page, 'finished session, editing', page.getByRole('button', { name: 'Done' }))
})

test('Program: days, the exercise form and picker, and after changing programs', async ({ page }) => {
  await setUpFromTemplate(page)
  await tab(page, 'Program').click()
  const bench = page.getByRole('button', { name: /^Bench Press/ })
  await expectFitsScreen(page, 'Program with a template', bench)

  await bench.click()
  await expectFitsScreen(page, 'exercise form, editing', page.getByRole('heading', { name: /Bench Press/ }))
  await tab(page, 'Program').click()

  await page.getByRole('button', { name: '+ Add exercise' }).first().click()
  await expectFitsScreen(page, 'exercise picker', page.getByRole('button', { name: 'Custom exercise…' }))
  await page.getByRole('searchbox', { name: 'Search' }).fill('curl')
  await expectFitsScreen(page, 'exercise picker, searching', page.locator('.bank-item').first())
  await page.locator('.bank-item').first().click()
  await expectFitsScreen(page, 'exercise form, from the bank', page.getByRole('button', { name: 'Cancel' }))
  await tab(page, 'Program').click()

  await page.getByRole('button', { name: '+ Add exercise' }).first().click()
  await page.getByRole('button', { name: 'Custom exercise…' }).click()
  await expectFitsScreen(page, 'exercise form, custom', page.getByRole('button', { name: 'Cancel' }))
  await tab(page, 'Program').click()

  await page.getByRole('button', { name: 'Change your program…' }).click()
  await expectConfirm(page, /^Change your program\?/)
  await expectFitsScreen(
    page,
    'Program after changing programs',
    page.getByRole('button', { name: 'Use 4-day Upper/Lower' }),
  )
})
