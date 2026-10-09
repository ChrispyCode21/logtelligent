# Testing notes

## Playwright (automated, in CI)

`npm run test:e2e` runs `e2e/` against the production build (`vite preview`, under the production headers) in WebKit, the iPhone's engine, and Chromium, each at 375×812 and 320×640. CI runs it as the "Playwright" check.

- **`layout.spec.ts`** walks every screen and state: the empty tabs; each step of the starting-numbers walkthrough, and "Starting numbers needed"; Today, with a note from last time and with a day out of rotation; a live session on each effort scale, with all sets logged, a set being edited, the extra-set form, the exercise menu, the Replace form, and a replaced and a skipped exercise; History (a chart, a substitute, an extra set, a note) and a finished session being edited; the Program tab, the exercise form (editing, from the bank, custom) and picker (browsing, searching), and the Program tab after changing programs. Each check first waits for something only that screen shows. On each it runs the two checks below: sideways scrolling (naming the elements that stick out) and clipped button labels.
- **`smoke.spec.ts`** runs the main flows: template → starting numbers → log a session → the next day comes up and History shows it; restoring a backup; exporting what was restored.
- **Dialogs:** `confirm()` is accepted, but a test must expect each one (`expectConfirm`); one it didn't expect fails the test.
- **No retries:** a test that fails once fails the run, so timing races show up instead of passing as "flaky".
- **Adding a screen:** add the state to `layout.spec.ts` (the helpers in `support.ts` set up a program, log a session, or restore the fixture backup).
- **Running it locally:** `npx playwright install chromium webkit` once, then `npm run test:e2e` (it builds the app first, on port 4173). A failure keeps a trace in `test-results/`; open it with `npx playwright show-trace <path>/trace.zip`.

It doesn't replace the phone: real touch, the home-screen install, offline, and native `confirm()` dialogs stay on the on-device checklist below. The in-app preview is still useful for poking at a change by hand, with the quirks that follow.

## The in-app preview

Known quirks when verifying the app in the Claude desktop app's Browser pane (the in-app preview). Not app bugs, but they shape how results should be read.

### Preview clicks land in the wrong place at phone size

When the pane emulates a phone viewport (the `mobile` preset, 375×812), the pane reports a different viewport (e.g. 424×919) and clicks by element ref are scaled to the wrong coordinates. Seen in slices 1–3:

- A "Log set" click missed and hit the gap above the button.
- A "Move Upper A up" click hit a different day's move button, reordering the wrong day.

**Workaround:** test at the pane's own (desktop) size. The layout is capped at 480 px, so it renders the same. Check results through the DOM (`javascript_tool` reading `main.innerText` or IndexedDB), not by trusting the click report or a page-text read, which can lag a render behind.

**Checking phone-width layout without clicks:** (this is what `expectFitsScreen` in `e2e/support.ts` automates; use it by hand for a quick look) set a custom viewport (e.g. 375×812 and 320×640), drive the UI with DOM `.click()` calls, and compare `document.documentElement.scrollWidth` to `clientWidth` on each screen. Any difference is sideways scrolling; list the elements whose `getBoundingClientRect().right` exceeds the viewport to find the culprit. This is how the "forms widen the page" bug (an input's default width forcing a grid column wider) was found and verified.

**Phone layout on a real device:** done for v1.0.0 (see the checklist below). The preview still can't be trusted at phone size, so new screens go in `e2e/layout.spec.ts` and get a pass on the phone.

**Clipped labels:** besides page overflow, check that no button's text overflows its own box (`button.scrollWidth > button.clientWidth`). Long labels in narrow grids (three across, or five effort buttons) show up this way before they show up as sideways scrolling.

## On-device checklist (after the first deploy)

The preview can't stand in for these; check them on the iPhone. Re-run the relevant items for any release that touches them.

Results for **v1.0.0** (iPhone, 2026-10-04): all pass. The first run found sideways scrolling on the Program tab, fixed in PR #2 and re-checked on the phone.

- [x] Layout at phone width: tabs fit, steppers and RPE buttons are easy to hit one-handed, nothing scrolls sideways.
- [x] Add to Home Screen: icon, name "Logtelligent", opens full screen.
- [x] Offline: turn on Airplane Mode, open the app from the home screen, log a set, finish a session.
- [x] Real `confirm()` dialogs: Finish anyway?, Switch day?, Skip today?, Discard?, Restore backup?
- [x] Export data saves a `.json` file (Files app), and Restore from file… reads it back.
Results for **v1.1.0 and v1.2.0** (iPhone, 2026-10-06, on v1.2.0): the items below pass, except two parts not yet checked. The pass found two bugs and three ideas, handled in v1.2.1 (SPEC §9.3) or parked (SPEC §11):

- **Bug:** the effort question showed on every set and on accessories. It's now asked only on a primary's first set.
- **Bug:** logged-set rows had their text at the top.
- **Idea:** the Effort scale card changed height; it's now fixed.
- **Idea:** a way to change programs mid-cycle (parked).
- **Idea:** the walkthrough's Next moving with the card (parked).

- [x] **v1.1.0:** each effort scale is easy to tap one-handed during a set, including the stacked Perceived effort buttons.
- [ ] **v1.1.0:** the upgrade keeps an existing program on RPE. *(Not yet checked.)*
- [x] **v1.1.0:** the template's "Replace your program…?" `confirm()`, and the seed walkthrough one-handed (stack quick picks, Next, Finish later and resuming from Today).
- [x] **v1.2.0 slice 0:** the larger weight and reps fields in a session are easy to read and tap one-handed, and the program and exercise-list summary lines (e.g. "Accessory · 3 × 10–12 per side · Dumbbell") read well where they wrap.
- [x] **v1.2.0 slice 1:** the real "Delete Upper A on …?" `confirm()` when deleting a finished session, and editing a set in History one-handed (the Edit button, the set form, Done).
- [x] **v1.2.0 slice 2:** "+ Add set" and an extra set one-handed mid-workout (the extra form has no effort buttons), and the "Extra: …" line in History.
- [x] **v1.2.0 slice 3:** typing a note one-handed (the on-screen keyboard over the note field, then Finish), and "Last time: …" on Today the next time that day comes up.
- [ ] **v1.2.0 slice 3:** the real "Finish anyway? (No note for next time.)" `confirm()`, and keeping a note when tapping History with the keyboard still up. *(Not yet checked.)*
- [ ] **v1.2.1:** effort is asked only on a primary's first set (not on later sets, accessories or substitutes); logged-set rows have their text centred; the Effort scale card keeps its height when switching scales.
- [ ] **v1.3.0 slice 0:** the warm-up ✕ and the Program tab's ↑ ↓ ✕ buttons are easy to hit one-handed, and long exercise names still read well beside them at phone width; the real "Delete Upper A? Its open session has nothing logged yet…" `confirm()`.
- [ ] **v1.3.0 slice 1:** after the update, existing history and today's suggestions are unchanged (the database upgrades to v6). Finish a session, then edit it from History: its header reads "3 of 3 sets". Change an exercise's rep range on the Program tab and check Today's suggestion starts fresh in the new range.
- [ ] **v1.3.0 slice 2:** with the same lift on two days, History lists it once with both days' sessions (each tagged with its day) and a hollow chart point for a high-rep session.
- [ ] **v1.3.0 slice 3:** the real "Change your program? …" `confirm()`, including "Your open session (4 sets logged) will be discarded." with a session open; afterwards the template options show and Today starts at the new program's first day.
- [x] An update (push a change) appears after reopening the app. (Close it fully, open, close, and open again; the update downloads on one open and applies on the next.)

## Preview techniques

Patterns that worked while building v1.1.0 and v1.2.0. All run in the page via `javascript_tool`.

- **Writing to IndexedDB directly bypasses Dexie.** The app's live query only hears about writes made through Dexie, so after a raw `indexedDB` write (clearing a store, restoring data), **reload the page** before reading the UI. IndexedDB reports Dexie's schema version × 10 (Dexie v3 shows as 30).
- **Back up the preview's data before destructive flows** (replacing the program with a template, deleting or editing sessions): read every object store into `localStorage`, run the test, then clear the stores, put the rows back, reload, and compare the JSON with the backup to confirm an exact restore.
- **A fresh install:** the in-app preview holds test data. To see first-run behavior, back up and clear the stores (above), or open the PR's Cloudflare preview URL, which is a separate origin with an empty database.
- **Proving "no visual change" refactors:** script a fixed set of screens (Today, a session, the ⋯ menu, a logged set, History, Program, the exercise form…) and, on each, record the position, size and key computed styles (color, background, border, radius, padding, margin, gap, font size and weight, min sizes) of every element that has its own text, is a control, or draws a box. Save it to `localStorage`, make the change, record again and diff. Run it in light and dark, at the **same viewport width** (set a custom size: the pane's own width can change between turns). Expect harmless diffs when JSX splits text differently (`{value} lb` vs `${value} lb`).
- **Light and dark:** the pane can follow the desktop app's theme, so set `colorScheme` explicitly with `resize_window` rather than assuming light.

- **Typing into React inputs and textareas:** set the value with the native setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`, or `HTMLTextAreaElement` for a textarea), then dispatch an `input` event. Assigning `.value` alone doesn't reach React's state.
- **A programmatic `.click()` doesn't move focus**, so it reproduces iOS keeping the keyboard (and the focused field) up while another button is tapped. Useful for checking that something saves without a blur.
- **The app going to the background:** `Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })`, dispatch `visibilitychange` on `document`, then `delete document.visibilityState`.
- **A clean fixture per check:** the preview's database is usually left empty between slices. Assert it's empty before writing a fixture, and clear both stores afterwards (and reload).
- **Proving a no-visual-change refactor against `main`:** take the snapshot (above) on the branch, `git switch main` (with a clean tree), reload, snapshot again, switch back, and diff. Remove the snapshot keys from `localStorage` when done.

## Other caveats

- **Screenshots time out** when the desktop app window is behind another window; the pane stops drawing. Use DOM reads instead, or bring the window forward.
- **`confirm()` dialogs block automation.** Tests stub `window.confirm` in the page (recording the messages) to get past "Finish anyway?", "Switch day?" and "Discard?" prompts. The real dialogs still need a manual check on a device.
- **Vite hot reload can get stuck** on a half-written file (seen when files were written by shell heredocs), leaving a stale broken module. Restart the dev server (`preview_stop` / `preview_start`).
- **Test fixtures written straight to IndexedDB** (a failed session in slice 2, a Squat on Lower A in slice 3) skip the UI. Note which steps used them when reporting results.
- **The console keeps errors from before a reload or a dev-server restart.** An error that names a module with an old `?t=` timestamp, or one fixed since, is stale. Check the current module with `fetch('/src/…')` before chasing it.
- **Worktrees inside the repo:** a background task the desktop app starts gets a git worktree under `.claude/worktrees/` (git-ignored). `npm test` runs only `src/`, so its copy isn't picked up. Git refuses to read such a folder ("dubious ownership") on Windows; pass `-c safe.directory=<path>` to a single command rather than changing global config. After its PR merges, `git worktree remove` it; an empty folder left behind is held by that session until it's archived.
- **The preview's IndexedDB keeps old data** across slices: slice 1–2 bench sessions (no day, old exercise id) are still there and are ignored by the program.
