# Testing

Three layers check the app:

1. **Unit tests** (`npm test`, run by CI): the progression engine and every pure rule, including each SPEC §7 worked example.
2. **Preview checks** while building a slice: the flows driven by DOM in the Claude desktop app's Browser pane, plus sideways scrolling and clipped labels at 375 and 320 px. How, and the pane's quirks, are under "In the preview" below.
3. **Phone checks** after a release deploys: what only a real iPhone can show. Two lists: **every release**, which stays as it is, and **the current release**, which is replaced with each release.

## On the phone

### Every release

Lean on purpose: the things any release could break that only the phone shows. Run them once the release is live.

- [ ] **The update arrives:** close the app fully, open it, close it, open it again. The update downloads on one open and applies on the next; the release's changes are there.
- [ ] **Your data survives:** program, History and Today's suggestions are as they were before the update, including after any database upgrade the release notes mention.
- [ ] **A session, one-handed:** start Today's session, log sets with the steppers and the effort buttons (asked on a primary's first set only), and finish. Finishing short shows the real "Only X of Y sets logged. Finish anyway?" `confirm()`.
- [ ] **Phone width:** nothing scrolls sideways and no label is cut off on Today, a session, History and Program, and the tabs fit.
- [ ] **Offline:** turn on Airplane Mode, open the app from the home screen, log a set and finish the session.
- [ ] **Backup:** Export data saves a `.json` file to the Files app.

**When a release touches them,** the current release's list adds:

- Add to Home Screen (icon, name "Logtelligent", opens full screen): when the manifest or icons change.
- Restore from file… reads an export back: when what's stored changes.
- Any real `confirm()` the release adds or rewords.

### Current release: v1.3.0

Replaced at each release with checks drawn from that release's CHANGELOG notes (see "Keeping these lists" below). Anything still unticked when the next release comes is carried over once, then dropped or turned into an issue.

- [ ] **Change your program:** the card at the bottom of the Program tab, its note, and the real "Change your program? …" `confirm()`. With a session open it adds "Your open session (N sets logged) will be discarded." Afterwards the template options show, and Today starts at the new program's first day.
- [ ] **One history per lift:** with the same lift on two days, History lists it once, with both days' sessions tagged by day, and a high-rep session's chart point is hollow.
- [ ] **Adding a lift you already do:** a primary needs no starting numbers (the form says they're optional); an accessory picked from the exercise list copies your equipment and weight stack and suggests the lift's latest weight.
- [ ] **Sessions remember their prescription:** finish a session, then edit it from History: its header reads "3 of 3 sets". Change an exercise's rep range and check Today's suggestion starts fresh in the new range.
- [ ] **Removing a day mid-session:** the real "Delete Upper A? Its open session has nothing logged yet…" `confirm()`.
- [ ] **Bigger tap targets:** the warm-up ✕ and the Program tab's ↑ ↓ ✕ buttons are easy to hit one-handed, and long exercise names still read well beside them.
- [ ] **Database upgrade (v6):** covered by "Your data survives" above.

Carried over from earlier releases:

- [ ] **v1.2.0:** the real "Finish anyway? (No note for next time.)" `confirm()`, and a note is kept when you tap History with the keyboard still up.
- [ ] **v1.2.1:** logged-set rows have their text centred, and the Effort scale card keeps its height when switching scales.

### Keeping these lists

- **At each release,** the release PR replaces "Current release" with checks drawn from the CHANGELOG notes it moves under the new version: one check per Added, Changed or Fixed entry that the phone can show, skipping what "Every release" or the unit tests already cover. A stored-data change adds Restore from file…; a manifest or icon change adds Add to Home Screen.
- **Results:** tick items here as they pass. A bug or idea found goes into SPEC (a fix in the next version, or §11); the release's results otherwise live in git history, not as a running log in this file.
- **"Every release"** changes only when something new can break on every release (e.g. a new tab).

## In the preview

Known quirks of verifying the app in the Claude desktop app's Browser pane. Not app bugs, but they shape how results should be read.

### Clicks land in the wrong place at phone size

When the pane emulates a phone viewport (the `mobile` preset, 375×812), it reports a different viewport (e.g. 424×919) and clicks by element ref are scaled to the wrong coordinates: a "Log set" click once hit the gap above the button, and a "Move Upper A up" click reordered a different day.

- **Workaround:** test at the pane's own (desktop) size. The layout is capped at 480 px, so it renders the same. Check results through the DOM (`javascript_tool` reading `main.innerText` or IndexedDB), not by trusting the click report or a page-text read, which can lag a render behind.
- **Phone-width layout without clicks:** set a custom viewport (375×812 and 320×640), drive the UI with DOM `.click()` calls, and compare `document.documentElement.scrollWidth` to `clientWidth` on each screen. Any difference is sideways scrolling; list the elements whose `getBoundingClientRect().right` exceeds the viewport to find the culprit. This is how the "forms widen the page" bug (an input's default width forcing a grid column wider) was found.
- **Clipped labels:** also check that no button's text overflows its own box (`button.scrollWidth > button.clientWidth`). Long labels in narrow grids (three across, or five effort buttons) show up this way before they show up as sideways scrolling.
- The preview can't stand in for a phone, so new screens get these DOM checks here and a pass on the phone (the lists above).

### Techniques

All run in the page via `javascript_tool`.

- **A clean fixture per check:** the preview's database is left empty between slices. Assert it's empty before writing a fixture, and clear both stores afterwards (and reload).
- **Writing to IndexedDB directly bypasses Dexie.** The app's live query only hears about writes made through Dexie, so after a raw `indexedDB` write (a fixture, clearing a store), **reload the page** before reading the UI. IndexedDB reports Dexie's schema version × 10 (Dexie v6 shows as 60).
- **If the database isn't empty,** back it up before destructive flows: read every object store into `localStorage`, run the test, then clear the stores, put the rows back, reload, and compare the JSON with the backup to confirm an exact restore.
- **A fresh install:** clear the stores, or open the PR's Cloudflare preview URL, which is a separate origin with an empty database.
- **Typing into React inputs, textareas and selects:** set the value with the native setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`, or `HTMLTextAreaElement` / `HTMLSelectElement`), then dispatch an `input` (or `change`) event. Assigning `.value` alone doesn't reach React's state.
- **`confirm()` dialogs block automation.** Stub `window.confirm` in the page, recording the messages (and returning `false` to check Cancel). The real dialogs are a phone check.
- **A programmatic `.click()` doesn't move focus**, so it reproduces iOS keeping the keyboard (and the focused field) up while another button is tapped. Useful for checking that something saves without a blur.
- **The app going to the background:** `Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })`, dispatch `visibilitychange` on `document`, then `delete document.visibilityState`.
- **Light and dark:** the pane can follow the desktop app's theme, so set `colorScheme` explicitly with `resize_window` rather than assuming light.
- **Proving "no visual change" refactors:** script a fixed set of screens (Today, a session, the ⋯ menu, a logged set, History, Program, the exercise form…) and, on each, record the position, size and key computed styles (color, background, border, radius, padding, margin, gap, font size and weight, min sizes) of every element that has its own text, is a control, or draws a box. Save it to `localStorage`, make the change, record again and diff. Run it in light and dark, at the **same viewport width** (set a custom size: the pane's own width can change between turns). Expect harmless diffs when JSX splits text differently (`{value} lb` vs `${value} lb`).
- **Against `main`:** take the snapshot on the branch, `git switch main` (with a clean tree), reload, snapshot again, switch back, and diff. Remove the snapshot keys from `localStorage` when done.

### Other caveats

- **Vite hot reload can get stuck** on a half-written file, or after switching or pulling branches under a running dev server, leaving a stale broken module (e.g. "does not provide an export named …"). Restart the dev server (`preview_stop` / `preview_start`).
- **The console keeps errors from before a reload or a dev-server restart.** An error that names a module with an old `?t=` timestamp, or one fixed since, is stale. Check the current module with `fetch('/src/…')` before chasing it.
- **Screenshots time out** when the desktop app window is behind another window; the pane stops drawing. Use DOM reads instead, or bring the window forward.
- **Fixtures written straight to IndexedDB** skip the UI. Say which steps used them when reporting results.
- **Worktrees inside the repo:** a background task the desktop app starts gets a git worktree under `.claude/worktrees/` (git-ignored). `npm test` runs only `src/`, so its copy isn't picked up. Git refuses to read such a folder ("dubious ownership") on Windows; pass `-c safe.directory=<path>` to a single command rather than changing global config. After its PR merges, `git worktree remove` it; an empty folder left behind is held by that session until it's archived.
