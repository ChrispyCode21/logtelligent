# Testing notes

Known quirks when verifying the app in the Claude desktop app's Browser pane (the in-app preview). Not app bugs, but they shape how results should be read.

## Preview clicks land in the wrong place at phone size

When the pane emulates a phone viewport (the `mobile` preset, 375×812), the pane reports a different viewport (e.g. 424×919) and clicks by element ref are scaled to the wrong coordinates. Seen in slices 1–3:

- A "Log set" click missed and hit the gap above the button.
- A "Move Upper A up" click hit a different day's move button, reordering the wrong day.

**Workaround:** test at the pane's own (desktop) size. The layout is capped at 480 px, so it renders the same. Check results through the DOM (`javascript_tool` reading `main.innerText` or IndexedDB), not by trusting the click report or a page-text read, which can lag a render behind.

**Checking phone-width layout without clicks:** set a custom viewport (e.g. 375×812 and 320×640), drive the UI with DOM `.click()` calls, and compare `document.documentElement.scrollWidth` to `clientWidth` on each screen. Any difference is sideways scrolling; list the elements whose `getBoundingClientRect().right` exceeds the viewport to find the culprit. This is how the "forms widen the page" bug (an input's default width forcing a grid column wider) was found and verified.

**To revisit:** verify the real phone layout on an actual iPhone once the PWA is deployed (slice 6), since the preview can't be trusted at phone size.

## On-device checklist (after the first deploy)

The preview can't stand in for these; check them on the iPhone. Re-run the relevant items for any release that touches them.

Results for **v1.0.0** (iPhone, 2026-10-04): all pass. The first run found sideways scrolling on the Program tab, fixed in PR #2 and re-checked on the phone.

- [x] Layout at phone width: tabs fit, steppers and RPE buttons are easy to hit one-handed, nothing scrolls sideways.
- [x] Add to Home Screen: icon, name "Logtelligent", opens full screen.
- [x] Offline: turn on Airplane Mode, open the app from the home screen, log a set, finish a session.
- [x] Real `confirm()` dialogs: Finish anyway?, Switch day?, Skip today?, Discard?, Restore backup?
- [x] Export data saves a `.json` file (Files app), and Restore from file… reads it back.
- [ ] **v1.1.0:** each effort scale is easy to tap one-handed during a set, including the stacked Perceived effort buttons; the upgrade keeps an existing program on RPE.
- [ ] **v1.1.0:** the template's "Replace your program…?" `confirm()`, and the seed walkthrough one-handed (stack quick picks, Next, Finish later and resuming from Today).
- [x] An update (push a change) appears after reopening the app. (Close it fully, open, close, and open again; the update downloads on one open and applies on the next.)

## Other caveats

- **Screenshots time out** when the desktop app window is behind another window; the pane stops drawing. Use DOM reads instead, or bring the window forward.
- **`confirm()` dialogs block automation.** Tests stub `window.confirm` in the page (recording the messages) to get past "Finish anyway?", "Switch day?" and "Discard?" prompts. The real dialogs still need a manual check on a device.
- **Vite hot reload can get stuck** on a half-written file (seen when files were written by shell heredocs), leaving a stale broken module. Restart the dev server (`preview_stop` / `preview_start`).
- **Test fixtures written straight to IndexedDB** (a failed session in slice 2, a Squat on Lower A in slice 3) skip the UI. Note which steps used them when reporting results.
- **The preview's IndexedDB keeps old data** across slices: slice 1–2 bench sessions (no day, old exercise id) are still there and are ignored by the program.
