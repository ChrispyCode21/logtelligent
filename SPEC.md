# Lifting Log — Design Spec

> Status: **v1.0.0 — built and live** (2026-10-04). All six slices in §9 are done. **v1.1.0 — released** (2026-10-04): all four slices in §9.1. **v1.2.0 is being built** (§9.2, decided 2026-10-04; slice 0 added 2026-10-05): slices 0 and 1 are built.
> Purpose of this doc: the source of truth for what the app does and why. Anything built should trace back to a section here. The README will eventually be derived from it.

Legend used throughout:
- **Decided** — settled; build to it.
- **Proposed** — suggested during design, not yet confirmed.
- **Open** — needs a decision before the related slice is built.

---

## 1. Problem

Hand-typed workout notes (e.g. in Apple Notes) record what happened but don't tell me what to do next. Working out next week's weights means scrolling back, comparing, and guessing — and RPE / targets usually never get written down at all.

**The app is an intelligent logger:** I log my sets in the gym, and it uses my own history to suggest next session's weights and reps. "Intelligent" means a deterministic progression algorithm — **no LLM/AI service**.

## 2. Platform & architecture (Decided)

- **PWA** (installable web app, added to the iPhone home screen). No App Store.
- **React + TypeScript**, built with **Vite**.
- **Local-only data** in the browser's IndexedDB, via **Dexie**. No backend, no accounts.
- **Offline-capable** (service worker via `vite-plugin-pwa`) — gym signal is unreliable.
- **Free static hosting** (GitHub Pages or Cloudflare Pages). **Decided:** Cloudflare Pages, built from the GitHub repo on every push to `main` (moved from GitHub Pages so the app has its own origin; other `*.github.io` sites on the account shared it). Security headers in `public/_headers`.
- **JSON export** from day one as the backup mechanism. **Decided:** export downloads `logtelligent-YYYY-MM-DD.json` (program + all sessions, with a format version); **import** restores a backup file, replacing all data after a confirm.
- **Progression engine is pure TypeScript** — no React, no database access — so it can be unit-tested in isolation (Vitest).

## 3. Definition of done (MVP)

The MVP is done when I can, for a full training cycle, using only the app (features below are built and verified in v1.0.0; **the full-training-cycle use itself is still to be done**):

- [x] Define my program: training days in rotation, exercises per day, and per-exercise settings (tier, rep range / intent, set count, equipment type, progression profile).
- [x] Open the app and see **today's session** (next day in rotation) with a **suggested weight and rep target** for each exercise.
- [x] Log every working set (weight, reps, and RPE where applicable) quickly on my phone.
- [x] See the result of the session's validation (e.g. "Failed to hit minimums, next week's weight will be lowered") and any deload notice.
- [x] View history per exercise.
- [x] Export all data to JSON.
- [x] All progression rules in §6 are covered by passing unit tests built from the worked examples in §7.

## 4. Non-goals (MVP)

Explicitly **out of scope** until the MVP is done:

- Rest timer (rest is self-judged).
- Push notifications / reminders.
- Apple Watch or Apple Health integration.
- Cloud sync, accounts, or any backend.
- LLM / AI coaching.
- Native iOS app or App Store distribution.
- Logging warm-up sets.
- Visual polish beyond "clear and fast to use one-handed."

See §11 for ideas parked until after the MVP.

## 5. Core user flows

### 5.1 Set up a program
1. Create training days in rotation order (e.g. Upper A, Lower A, Upper B, Lower B for a ULRUL split).
2. Add exercises to each day, in order.
3. Configure each exercise (see §6.1).
4. **Seed starting numbers (Decided — required gate for v1):** the app cannot start a session until every exercise has a seed.
   - **Primary lifts:** enter a weight × reps you could do confidently — with effort, but no risk of failing. Prompt along the lines of: *"Enter a weight and reps you're confident you could do: hard, but you wouldn't fail."* This is recorded as a set at **RPE 7** and produces the seed e1RM (§6.4).
   - **Accessory lifts (Decided):** the prompt asks for a weight at the **bottom of the configured rep range**, e.g. *"What's a weight you can do 15 lateral raises (per side) with that would be hard, but achievable?"* The form shows a placeholder value as a suggestion. The answer is recorded as weight × bottom-of-range reps at **RPE 8**. Accessories don't use e1RM, so the RPE is informational; the first suggestion is that weight at the bottom of the range.
   - The seed is an estimate. If it's off, the progression rules correct it: at worst, one easy (or failed) week, and the next is accurate.
   - Opting out of e1RMs entirely is a v2+ idea (§11).

**Decided:** each day has a fixed set of exercises. Upper A and Upper B use different exercises; swapping exercises within the same day from week to week is discouraged, because it breaks tracking.

**Rotation (Decided):**
- The rotation contains **training days only**; rest days are not slots.
- The next day is the one after the last day logged, wrapping from the final day back to the first (`(lastIndex + 1) % days.length`). After Lower B comes Upper A.
- **Days with no exercises are skipped** by the rotation and the Today screen (Decided, slice 3).
- **If the last day logged has since been archived**, the rotation starts again at the first day (Decided, slice 3).
- One full pass through the rotation = one **week** (cycle). "Last week's numbers" means the previous pass.

### 5.2 Run a session (the main flow)
1. App opens to the **next day in the rotation** (Decided).
2. I can choose a different day, but only after an explicit acknowledgement (Decided). Example: I did Lower A but forgot to log it; I can still log Upper B. A skipped day is simply not logged, and the rotation continues from the day I *did* log.
3. A **warm-up reminder banner** appears at the top with a short suggestion (one sentence or 2–3 bullets). Warm-up sets are not logged (Decided).
   - **Decided:** shown at the top of an active session, dismissible for that session. It ramps to the day's first exercise at its suggested weight: *"Warm up for Bench Press (225): 5–10 min easy cardio, then ramp: 45 × 10, 110 × 5, 155 × 3, 190 × 1."* Ramp weights are the lightest load, then ~50%, ~70% and ~85% of the working weight, snapped down to available loads (duplicates dropped). With no working weight to ramp to (e.g. unweighted bodyweight), only the cardio line shows.
4. Each exercise shows its suggested weight and rep target. Exercises in a deload week are marked as such (§6.7).
5. I log each working set. The next set **pre-fills** from the previous set's values, so a repeat set is one tap (Decided).
6. When the last set of an exercise is entered, validation runs (see §6.6) and any message is shown.
7. Finish the session.
   - **Short sessions (Decided):** finishing with fewer sets than configured asks for confirmation ("Only 2 of 3 sets logged. Finish anyway?"). The session is then treated as normal: validation runs on the logged sets only, and a missing set is not a fail. (Leaving early or feeling unwell shouldn't count against progression.)
   - **Set count in the UI (Decided):** once the configured number of sets is logged, the form for a new set is hidden; logged sets stay editable until the session is finished.

**Exercise menu (⋯) — Decided:** each exercise in a session has a menu with options such as **replace** and **delete**.
- Replacing shows a notice along the lines of: *"This will be tracked as volume only and not used for estimates."*
- A substitute's sets are kept out of the original exercise's progression data.
- **Substitute (Decided):** a free-text name; its sets are logged as weight × reps (RPE optional), with no suggestion, floor rule or stacks. Any sets already logged for the original that day stay recorded, but the whole session is kept out of the original's progression (A6).
- **Delete (Decided):** skips the exercise **for today only**, discarding any sets logged for it today. The program is unchanged, and progression treats it as not done (no fail, no stack).
- **Undo (Decided):** while the session is open, a replaced exercise can be un-replaced (discarding the substitute's sets) and a skipped one restored. After Finish, both are read-only.
- **History (Decided):** a replaced session shows under the original exercise as "Replaced with …" with the substitute's sets, and no e1RM or chart point.

### 5.3 Review history
1. Pick an exercise.
2. See past sessions: date, every set (weight × reps, RPE where logged), and the estimated 1RM over time for primary lifts.

**Decided:**
- Each e1RM point is **that session's e1RM** (from its first set alone, §6.4), not the running average. Deload sessions are listed and tagged but get no e1RM point.
- Shown as a **small line chart** (inline SVG, no chart library) above the session list, with the e1RM also on each session row.
- The exercise picker includes **active exercises** (grouped by day) and **archived exercises that have history** (in an "Archived" group).

## 6. Domain rules

### 6.1 Exercise configuration
Per exercise, set at program-setup time:

| Setting | Notes | Status |
|---|---|---|
| Tier: **primary** or **accessory** | My call per exercise — "primary" means compound-like demands, not a fixed list of lifts | Decided |
| Rep range / intent | Configurable, never hard-coded. For primary lifts, ideally derived from data (§6.4) | Decided (configurable); mechanism Proposed |
| Number of working sets | | Decided |
| **Equipment type** | e.g. `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`. Supplies default load steps (§6.2) | Decided |
| **Progression profile** | How this exercise's load can change — see §6.2 | Decided (needed); values Proposed |
| Unilateral | Reps are always recorded **per side** (e.g. single-arm or alternating DB curls: 30×15 = 15 each side) | Decided |
| Target RPE (primary lifts) | First-set target, half steps, default 8 | Decided |
| Starting numbers (seed) | See §5.1 | Decided |

**Not in the setup form (Decided):** the max relative jump is a fixed 10% for every exercise (§6.2).

**Editing the program (Decided):** any setting can be changed at any time; progression replays history under the current settings. Deleting an exercise or day that has logged sessions **archives** it (hidden from the program, history kept); one with no sessions is deleted outright.

**Bodyweight (Decided):** bodyweight exercises can only be **accessories**. Their loads are **added weight** — 0, 5, 10, 15… lb (overridable). Every jump from 0 exceeds 10%, so they progress by reps up to the rep ceiling, then add 5 lb.

**Dumbbells (Decided):** dumbbell weights are **per hand** (incline press 70 = 70 lb in each hand).

### 6.2 Progression profile (load steps)
**Decided:** a fixed pound increment doesn't work across exercises. +5 lb on a 300 lb squat is under 2%; +2.5 lb on a 12.5 lb lateral raise is 20%. Each exercise needs its own description of how it progresses.

**Decided — three layers, combined:**
1. **Equipment-type defaults** supply the available loads:
   - Barbell: 5 lb total jumps (2.5 lb plate per side), starting at a 45 lb empty bar (Decided). A different bar uses the per-exercise override.
   - Dumbbell: a standard rack list (e.g. 10, 12.5, 15, 17.5, 20, 22.5, 25, 30…).
   - Cable / machine: a stack list I enter (e.g. …99, 110, 121…).
2. **Per-exercise override** of those loads for my gym's actual equipment (e.g. "this gym has 22.5s").
3. **Max relative jump** on top: if the next available load is a bigger jump than this, progress by **reps** instead of weight, extending the effective top of the rep range.

**Rep ceiling (Decided):** the rep extension in layer 3 is capped at **120% of the top of the configured range, rounded up** — `ceil(top × 1.2)`. Once the ceiling is reached, the engine takes the next load step anyway, even if it exceeds the max relative jump. This prevents getting stuck doing lateral raises for sets of 25+ because the next dumbbell is a big relative jump.
- Examples: 3–5 → ceiling 6; 8–12 → 15 (14.4 rounded up); 15–20 → 24.
- A percentage was chosen over a fixed "+5" because it scales with the range: +5 is huge on a 3–5 range and small on a 15–20 range.

**Max relative jump (Decided):** ≈ 10%.

**Rep extension step (Decided):** when the range is filled but the next load is too big a jump, the effective top of the range rises by **10% of the configured top, rounded up, minimum 1** — `Math.max(Math.ceil(top * 0.1), 1)`. When that new top is filled (same >50% rule), it rises again, capped at the ceiling.
- Examples: top 5 → step 1; top 7 → 1; top 12 → 2; top 20 → 2 (so 15–20 extends 20 → 22 → 24).
- Note: it's `Math.max`, not `Math.min` — `Math.min(x, 1)` would cap every step at 1.

When the ceiling is filled, take the load step and reset to the bottom of the configured range.

**Consequence worth knowing:** with standard dumbbells, *every* jump below ~70 lb exceeds 10% (15 → 17.5 is 16.7%; 20 → 22.5 is 12.5%; 25 → 30 is 20%). So light dumbbell accessories will effectively always progress via the rep ceiling. That's intended behavior, not a bug.

**Where this matters in practice:** mostly dumbbell and cable exercises (e.g. lateral raise 20 → 22.5 lb is a 12.5% jump). For barbell primaries, a 5 lb jump is usually well under 10% (225 → 230 ≈ 2%), and a set far above the range (e.g. 12 reps on a 3–5 range) is handled by the e1RM instead: the new estimate raises next session's weight to match (§6.4).

**Sets are never added by progression (Decided).** The working-set count is fixed in configuration; progression changes only reps and load.

### 6.3 Primary lifts
- **RPE is required on the first set only** (Decided). RPE is optional on other sets.
- **RPE is entered in half steps from 6 to 10** (6, 6.5 … 10) (Decided). From v1.1.0 this is one of three input modes chosen per program; the others map onto the same scale (§9.1, slice 1).
- **The first set is the source of truth** for progression: its weight, reps, and RPE drive next session's suggestion (Decided).
- **All sets use one working weight**; no changing weight from set to set (Decided).
- Sets 2+ are recorded in full. They don't steer the progression math, but they **feed validation** (§6.6) (Decided).

### 6.4 Estimated 1RM (primary lifts)
- Each first set produces an **estimated 1RM (e1RM)**, adjusted for RPE: reps in reserve are added to the reps performed. 225×7 @ RPE 7 (~3 in reserve) is estimated as a ~10-rep-max effort. Effective reps = `reps + (10 − RPE)` (Decided).
- **Formula (Decided):** the e1RM is the **average of Epley, Brzycki, and Lombardi**:
  - Epley `w × (1 + r/30)`
  - Brzycki `w × 36 / (37 − r)`
  - Lombardi `w × r^0.1`
  - Note: these are three curve-fits applied to the same set, not three independent measurements. Their agreement is a sanity check, not added confidence.
- **Running e1RM (Decided):** the average of the e1RMs from **up to the last 3 sessions within the last 4 weeks**.
  - Average over **however many sessions exist** (1, 2, or 3). Never pad missing sessions with 0 or any placeholder; divide by the actual count.
  - **Returning from a break** (no session in the 4-week window): use **90% of the most recent session's e1RM** and show a "returning from a break" note. The next real session then replaces it.
  - Layoff overshoot beyond that is caught by the fail/deload logic in §6.6.
- **No history yet (Decided):** a primary lift's first e1RM comes from its **setup seed** (§5.1): weight × reps treated as RPE 7. The seed is used **only until the first real session** — it is **not** averaged into the running e1RM afterward, so an optimistic or pessimistic guess can't linger for three sessions.
- **Data-driven targets (Decided as a goal; mechanism Proposed):** given the running e1RM and a weight, the engine predicts expected reps by inverting the formula (e.g. Epley inverted: reps to failure ≈ `30 × (e1RM / w − 1)`), minus the target reps in reserve. The program stores **intent** (e.g. "3 sets, first set ~RPE 8, 3–5 reps") and the engine chooses the weight.
- **Weight-selection rule (Decided):**
  1. Target reps = **midpoint of the rep range, rounded up** (3–5 → 4; 5–7 → 6). The midpoint leaves room on both sides: a good day lands above it, a bad day can still clear the floor.
  2. For each available load, predicted reps = reps to failure (the averaged formula, inverted numerically) − (10 − target RPE).
  3. Suggest the **heaviest available load whose predicted reps ≥ target reps**.
  - Progress is implicit: if I get stronger, the e1RM rises and the chosen load rises with it. If I don't, the load holds — which is honest.

### 6.5 Accessory lifts
- RPE is optional (Decided).
- **All sets use one working weight**, as for primary lifts (Decided).
- Progression by **double progression** (Decided): work up through the rep range at a fixed weight; once the range is filled, move up one load step (§6.2) and drop back to the bottom of the range.
- **"Range filled" (Decided): more than 50% of working sets reach the top of the range.** In practice: 2 sets → both; 3 sets → 2; 4 sets → 3.

### 6.6 Validation: floor rule and fatigue stacks
**Floor rule (Decided):** when the last set of an exercise is entered, check every working set against the **bottom of its rep range**. Any set below the floor = a **failed** session for that exercise.

(A total-volume comparison was considered and **rejected**: volume naturally drops when weight goes up and reps reset, so it would penalize successful progression.)

**Fatigue stacks (Decided):** each exercise carries its own fatigue-stack count.
- A **failed** session adds **one stack** and **reverts** next session to the last successful numbers.
  Message: *"Failed to hit minimums, next week's weight will be lowered."*
- If the reverted session **succeeds**, the next session retries the heavier numbers that failed.
- If the reverted session **also fails**, that is a second stack.
- **A stack clears only on success at the heavier numbers that originally failed.** Success at the reverted weight does *not* clear it — otherwise alternating A-success / B-fail would loop forever without ever triggering a deload.
- Reaching **two stacks on the same exercise** triggers a **deload** for that exercise (§6.7). Stacks never combine across exercises: one stack on bench plus one on lateral raises is not two stacks.
- Stacks **reset to 0 after a deload** (Decided).
- **While an exercise has stacks > 0, the stack logic decides next session's numbers, not the e1RM rule** (Decided). In shorthand: `stacks > 0 ? stackState.nextNumbers : e1rmPick`, where `nextNumbers` is either the **revert** (last successful numbers) or the **retry** (the exact numbers that failed) — not always "the previous weight."
- "Last successful numbers" = the weight and rep target of the most recent session for that exercise that passed the floor rule.
- **No successful session yet (Decided):** if a session fails before any session has succeeded (e.g. an optimistic seed), the stack is added as usual and the revert goes to **one load step below the failed weight** (accessories: at the bottom of the range). Those numbers then act as the last successful numbers.
- **Off-plan weight (Decided):** sessions are classified by the weight actually lifted. At or above the weight that failed counts as the **retry** (success clears the stack); below it counts as a revert-level session (success keeps the stack, a fail adds one).

Example:
| Week | Attempt | Result | Stacks after | Next week |
|---|---|---|---|---|
| 1 | Weight A | Hit top of range | 0 | Weight B (heavier) |
| 2 | Weight B | A later set below floor | 1 | Revert to A |
| 3 | Weight A | Success | 1 | Retry B |
| 4 | Weight B | Success | 0 | Progress normally from B |
| 3 (alt.) | Weight A | Fail | 2 | **Deload** |

**Scope (Decided): the floor rule and fatigue stacks apply to every exercise, primary and accessory.** Stacks are tracked **per exercise**, so fatigue on an accessory can never stall or deload a primary lift (or any other exercise). What differs by tier is the deload itself (§6.7).

### 6.7 Deload (Decided)
Triggered per exercise when that exercise reaches two fatigue stacks. Lasts **one week** (one pass through the rotation). Deload sessions are **excluded from e1RM and progression calculations** and are **not subject to the floor rule**. Afterward, stacks are at 0.

**Primary lifts:**
- **Volume:** about half the working sets (rounded up).
- **Load:** about 10% lighter than the last successful weight, **snapped down** to an available load (§6.2) (Decided). Target effort ~RPE 6. **Reps (Decided):** the last successful rep target (e.g. 225 × 4 → deload 2 × 4 @ 200). ("Intensity" in lifting means load relative to max, not perceived effort — halving it would be far too light.)
- **Afterward:** resume at the last successful numbers. *Flagged to revisit once there's real deload data* — whether this is too aggressive or too timid is best answered by a few actual cycles.

**Accessory lifts (Decided):**
- **Same load, about half the working sets (rounded up)**, at the last successful rep target, for one week — the same set-halving as primary lifts. Edge case: a 1-set exercise stays at 1 set (`ceil(0.5) = 1`).
- **Afterward:** resume at the last successful numbers.
- Rationale: accessories are mostly volume work; a lighter-touch deload is enough, and keeps this from blocking the rest of the app.

Note: deload conventions vary between coaches and programs; these values are a sensible starting point, not settled science.

## 7. Worked examples → test cases

Each example below becomes one unit test. IDs are stable so tests can reference them (e.g. `it('B3: ...')`). Numbers were computed with the formulas in §6.4, not estimated. Examples that depend on a **Proposed** rule say so; if that rule changes, update the example.

Shared assumptions unless stated: barbell loads in 5 lb steps; dumbbell rack 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35…; e1RM values rounded to 0.1 lb (tests should allow ±0.1).

### 7.A Estimated 1RM (§6.4)

| ID | Input | Expected |
|---|---|---|
| A1 | First set 225×4 @ RPE 8 | Effective reps 6. Epley 270.0, Brzycki 261.3, Lombardi 269.2 → **e1RM 266.8** |
| A2 | First set 225×4 @ RPE 10 | Effective reps 4 → **e1RM 253.0** (no reps in reserve added) |
| A3 | Last 3 sessions within 4 weeks: 225×4 @8, 225×5 @8, 230×4 @8 | Session e1RMs 266.8, 273.6, 272.7 → **running e1RM 271.1** |
| A4 | Most recent session 6 weeks ago (225×4 @8), none since | 266.8 × 0.9 → running e1RM **240.1** + **"returning from a break"** note. With 3–5 @ RPE 8 this suggests **200 × 4** (vs. 225 before the break) |
| A5 | Last 3 sessions, the middle one a deload | Deload session **ignored**; average uses the 3 most recent *non-deload* sessions in the window |
| A6 | Session where the exercise was **replaced** by a substitute | Substitute's sets **ignored** for the original exercise's e1RM (§5.2) |
| A7 | Only 2 sessions ever, both within 4 weeks: 225×4 @8, 225×5 @8 | (266.8 + 273.6) / **2** → **270.2**. Not divided by 3; no zero padding |
| A8 | Only 1 session ever, within 4 weeks: 225×4 @8 | Running e1RM **266.8** (divided by 1; no break penalty) |
| A9 | Primary lift, zero sessions, seed 225×5 (treated as RPE 7), range 3–5 @ RPE 8 | Seed e1RM **280.4** → **suggest 235 × 4** (predicted 4.2) |
| A10 | Seed 225×5, then one real session 225×4 @8 | Running e1RM **266.8** — the real session alone; the seed is **dropped**, not averaged |
| A11 | Accessory, zero sessions, seed 15 lb for 15 reps (recorded RPE 8), range 15–20 | **Suggest 15 × 15** (bottom of range) |
| A12 | Any exercise with no seed | App **blocks** starting a session and routes to setup |

### 7.B Primary-lift suggestions (§6.4 weight-selection rule)

| ID | Input | Expected |
|---|---|---|
| B1 | Running e1RM 271.1; intent 3–5 @ RPE 8 | Target reps 4. At 225, predicted 4.6 ✓; at 230, predicted 3.8 ✗ → **suggest 225 × 4** |
| B2 | Last first set 225×12 @ RPE 8 (far above 3–5 range); only session | e1RM 325.0 → **suggest 270 × 4** (predicted 4.6). The overshoot is corrected by the e1RM, not the rep ceiling |
| B3 | Last first set 225×7 @ RPE 7; intent 5–7 @ RPE 8; only session | e1RM 294.4; target 6 → **suggest 235 × 6** (predicted 6.2). This is the original "hit the top of the range with RPE to spare, so bump the weight" case |
| B4 | Primary exercise with stacks > 0 | Suggestion comes from stack state (see 7.D), **not** from B-rule |

### 7.C Accessory double progression (§6.2, §6.5)

Lateral raise: range 15–20, 3 sets, dumbbell, ceiling `ceil(20 × 1.2)` = 24.

| ID | Input | Expected |
|---|---|---|
| C1 | Incline DB press, range 6–8, 3 sets: 70×8, 70×8, 70×7 | 2 of 3 at top → filled. 70 → 75 is 7.1% (≤ 10%) → **suggest 75 × 6** |
| C2 | Same, but 70×8, 70×7, 70×6 | 1 of 3 at top → not filled → **suggest 70, target 8** |
| C3 | 2 sets: 70×8, 70×7 | 1 of 2 at top; more than 50% of 2 = both → not filled → **suggest 70, target 8** |
| C4 | Lateral raise 15×20, 15×20, 15×18 | Filled. 15 → 17.5 is 16.7% (> 10%) → step `max(ceil(20 × 0.1), 1)` = 2 → **suggest 15, effective top 22** |
| C5 | Lateral raise, effective top 22: 15×22, 15×22, 15×19 | Filled → 22 + 2 = **effective top 24** (the ceiling) |
| C6 | Lateral raise, effective top 24: 15×24, 15×24, 15×22 | Ceiling filled → take the jump anyway → **suggest 17.5 × 15** (reset to bottom) |
| C9 | Rep extension step sizes | top 5 → 1; top 7 → 1; top 12 → 2; top 20 → 2 |
| C7 | Lat pulldown, cable stack …110, 121, 132…, range 8–12: 121×12, 121×12, 121×10 | Filled. 121 → 132 is 9.1% (≤ 10%) → **suggest 132 × 8** |
| C8 | Ceiling values | 3–5 → 6; 5–7 → 9; 8–12 → 15; 15–20 → 24 |

### 7.D Floor rule and fatigue stacks (§6.6)

Bench, range 3–5, 3 sets. Weight A = 225, weight B = 235.

| ID | Starting state | Session | Expected |
|---|---|---|---|
| D1 | Stacks 0 | 225×5, 225×4, 225×3 | All ≥ 3 → **success**. Stacks 0. Next from e1RM rule |
| D2 | Stacks 0, last success 225 | 235×4, 235×3, 235×2 | Set 3 < 3 → **fail**. Stacks **1**. Next **225** (revert). Message: *"Failed to hit minimums, next week's weight will be lowered."* |
| D3 | Stacks 1, failed numbers 235 | 225×5, 225×4, 225×3 | Success at reverted weight → stacks **stay 1**. Next **235** (retry) |
| D4 | Stacks 1, retrying 235 | 235×4, 235×3, 235×3 | Success at the failed weight → stacks **0**. Next from e1RM rule |
| D5 | Stacks 1, reverted to 225 | 225×4, 225×3, 225×2 | Fail again → stacks **2** → **deload** next week |
| D6 | Bench stacks 1, lateral raise stacks 1 | — | **No deload** for either. Stacks never combine across exercises |
| D7 | Loop check. Stacks 0; then 235 ✗, 225 ✓, 235 ✗ | — | First 235 fail → stacks 1; 225 success → stays 1; second 235 fail → stacks **2** → **deload**. The A-success / B-fail loop cannot continue forever |
| D8 | Accessory (lateral raise, 15–20) | 15×20, 15×16, 15×14 | Set 3 < 15 → **fail**, stacks +1. Floor rule applies to accessories too |

### 7.E Deload (§6.7)

| ID | Input | Expected |
|---|---|---|
| E1 | Bench (primary), 3 sets, last success 225 × 4, stacks 2 | Deload: **2 sets** (`ceil(3/2)`), **200 lb** (225 × 0.9 = 202.5, snapped down), target RPE 6 |
| E2 | Lateral raise (accessory), 3 sets, last success 15, stacks 2 | Deload: **2 sets** (`ceil(3/2)`), **same load 15** |
| E2b | Accessory with 4 sets | Deload: **2 sets** (`ceil(4/2)`), same load |
| E2c | Accessory with 1 set | Deload: **1 set** (`ceil(1/2)` = 1), same load |
| E3 | Deload session with a set below the floor | **No fail**, no stack added (floor rule doesn't apply) |
| E4 | Week after the deload | Resume at **last successful numbers** (bench 225 × 4); stacks **0** |

### 7.F Rotation (§5.1)

Days: [Upper A, Lower A, Upper B, Lower B].

| ID | Input | Expected |
|---|---|---|
| F1 | No sessions logged yet | **Upper A** (index 0) |
| F2 | Last logged: Upper B (index 2) | **Lower B** |
| F3 | Last logged: Lower B (index 3) | **Upper A** (wraps: `(3 + 1) % 4 = 0`) — start of a new week |
| F4 | Last logged Upper A; user overrides to Upper B and logs it | Next is **Lower B** (rotation continues from the day actually logged) |

### 7.G Reference data

Upper A, logged 2026-10-01 (bench target range set to 3–5 for this example):

| Exercise | Sets |
|---|---|
| Bench | 225×4, 225×4, 225×3 |
| Incline DB Press | 70×6, 70×6 |
| Lat Pulldown | 121×12, 121×9, 121×8 |
| Seated Cable Row | 99 stack (2 plates below) ×12, same ×10 |
| DB Lateral Raise (single arm) | 12.5×20, 15×15 |
| DB Overhead Extension | 25×15, 25×12, 25×7 |
| DB Curl | 30×15 (per side), 30×9 (per side) |

Note: this log predates the app and has no RPE or explicit targets, so it's input for shaping examples, not a gold standard.

## 8. Contracts (Decided as a starting point — signatures are finalized in code, `src/engine/`)

The engine takes per-exercise history as dated sessions (not bare `LoggedSet[][]`), since the 4-week window, deload exclusion (A5) and substitute exclusion (A6) all need per-session data.


- TypeScript types for: `Program`, `TrainingDay`, `ExerciseConfig` (including equipment type and progression profile), `Session`, `LoggedSet`, and per-exercise `ProgressionState` (fatigue stacks, last successful numbers, failed heavier numbers, deload status).
- Progression engine entry point, roughly:
  `suggestNext(config: ExerciseConfig, history: LoggedSet[][], state: ProgressionState) => Suggestion`
- Validation entry point, roughly:
  `validateExercise(config: ExerciseConfig, sets: LoggedSet[], state: ProgressionState) => { result: ValidationResult, nextState: ProgressionState }`

## 9. Build plan (Done — v1.0.0)

Vertical slices, each usable on its own. All six are built, tested and live.

1. One hard-coded primary exercise → log sets → see next session's suggestion. Engine + tests first.
   - **Decided:** the exercise is barbell bench, 3 sets, 3–5 @ RPE 8, with a hard-coded seed of 225 × 5. The seed-entry gate (§5.1, A12 in the UI) arrives with program setup in slice 3.
   - **Decided:** sets can be edited or deleted until the session is finished; finished sessions are read-only for now (see §10 #2).
2. Floor-rule validation, fatigue stacks, revert message, and deload.
   - **Decided:** accessory double progression (§6.2, §6.5; C1–C9, A11) is built into the engine in this slice, since stacks and deloads apply to accessories. The UI stays bench-only until slice 3.
3. Program setup (days, exercises, configuration) and rotation.
4. History view per exercise.
5. Exercise ⋯ menu (replace / delete) with the volume-only notice.
6. Warm-up banner, JSON export, PWA install and offline polish.

## 9.1 v1.1.0 scope (Decided 2026-10-04 — released in v1.1.0)

Answers the three complaints from friends trying v1.0.0: RPE friction ("oh, this is that annoying RPE stuff, huh?"), having to build a program ("So, I have to create a program? I can't just pick one?"), and not knowing exercise names ("Is there an exercise bank? I don't really know the names of things."). All changes are additive (minor version). Built in this order, each slice a small PR or two, then a release PR.

**Slice 0: UI groundwork (Decided: trimmed version of the ARCHITECTURE.md strategy; built).** Design tokens (spacing, radius, tap target, type scale), the primitives the new screens need (`Button`, `Field`, `Card`), and shared formatters (`formatSet`, `formatDate`, `formatWeight`, one RPE scale constant). The other primitives come later, as they're needed. No user-facing change.

**Slice 1: Effort scale, chosen per program (Decided; built).**
- The program has an **effort scale** that sets how effort is entered. All three modes are stored as an **RPE number** (6–10), so the engine, logged sets and e1RM math (§6.4) don't change, and switching modes later loses nothing.
  | Mode | Input | Maps to RPE |
  |---|---|---|
  | **RPE** | Today's picker, half steps 6–10 | as entered |
  | **Reps left** | "How many more reps could you have done?" 0 · 1 · 2 · 3 · 4+ | 10 · 9 · 8 · 7 · 6 |
  | **Perceived effort** | 5 labeled buttons, stacked (the labels don't fit five across a phone): Easy · Moderate · Challenging · Very hard · Failed on the last rep | 6 · 7 · 8 · 9 · 10 |
- Chosen during program setup, with a one-line explanation that it estimates 1-rep maxes, which drive suggested weights. Editable later on the Program tab. **Until slice 3 adds a setup flow (Decided):** a card at the top of the Program tab.
- **Default for a new program: Reps left.** Existing programs (no stored value) and older backups mean **RPE**.
- The mode also sets the wording of the target-effort field (§6.1 Target RPE), the seed prompt (§5.1, which mentions no RPE and so is unchanged), the RPE input in a session (§6.3), and how history shows a set.
- **Showing a set (Decided):** RPE `225 × 4 @ 8` (as today); Reps left `225 × 4 · 2 left`; Perceived effort `225 × 4 · Challenging`.
- **Values between a mode's buttons (Decided):** a stored value that doesn't match a mode's buttons (e.g. 8.5 in Reps left) is shown as the nearest label, **rounding toward harder** on a tie (8.5 → "1 left" / "Very hard"). Only the display rounds; the stored value is unchanged unless re-entered.
- **Switching modes (Decided):** allowed at any time, including during a session. Nothing stored changes; the pickers and labels re-render in the new mode.
- Storage change: a new `effortScale` field on the program. Needs the ARCHITECTURE.md checklist (Dexie version, backup validator, round-trip test). `FORMAT` stays 1, since a missing field means RPE.

**Slice 2: Exercise bank (Decided; built).**
- About 50 common exercises **built into the app** (no network): name, tier, equipment, default rep range, sets, unilateral, a one-line description, and a placeholder starting weight for the seed prompt.
- "Add exercise" searches the bank, with a **Custom…** option for anything not listed. Picking a bank exercise **copies its defaults** into a normal exercise, which is then fully editable. No link to the bank is stored (no storage change).
- **Browsing (Decided):** the bank is grouped by body area (Chest, Back, Shoulders, Arms, Legs, Core), since not knowing exercise names was the complaint. Groups start collapsed, with a count, and a search opens every group with a match. Typing in the search box filters across all groups. The body area is a display label only, not the parked muscle-group store (§11).
- **Search (Decided):** matches the name and a few common nicknames per exercise (e.g. "RDL" → Romanian Deadlift, "OHP" → Overhead Press), ignoring case and punctuation; every word typed must match.
- **After picking (Decided):** the usual exercise form opens, prefilled with the bank's defaults, its description, and its placeholder starting weight. Review, enter starting numbers, Save. One flow for bank and custom exercises.
- **Text only, no images.**
- **The list and its defaults (Decided 2026-10-04):** the 57 exercises in `src/program/bank.ts`, approved as proposed in PR #8.

**Slice 3: Program templates and guided seeding (Decided; built).**
- One template ships: a **4-day Upper/Lower**, built from bank exercises with their bank defaults. **Days and exercises (Decided 2026-10-04):**
  - **Upper A:** Bench Press, Barbell Row, Dumbbell Shoulder Press, Lat Pulldown, Lateral Raise, Triceps Pushdown
  - **Lower A:** Back Squat, Romanian Deadlift, Leg Press, Lying Leg Curl, Standing Calf Raise
  - **Upper B:** Overhead Press, Pull-Up, Incline Dumbbell Press, Seated Cable Row, Dumbbell Curl, Face Pull
  - **Lower B:** Deadlift, Bulgarian Split Squat, Leg Extension, Seated Leg Curl, Hanging Leg Raise
- Offered when the program is empty (alongside "Build my own"), and from the Program tab, where picking one **replaces** the program after a confirm. A template produces a normal, fully editable program (no storage change). **Replacing (Decided):** days from the replaced program that have history are archived (history kept), and ones without history are deleted, as with any delete (§6.1). The effort scale is kept.
- **Guided seed walkthrough:** after picking a template, step through each exercise on its own screen to enter its seed, pre-filled with the bank's placeholder weight. The seed gate (§5.1) is unchanged; the walkthrough is just a faster way through it.
  - **Saves each step (Decided):** Next saves that exercise's starting numbers straight away. "Finish later" leaves; Today's seed gate resumes at the first exercise still missing numbers. There is no Back button (edit an exercise on the Program tab instead).
  - **Any program (Decided):** the seed gate offers the walkthrough for any program with exercises missing starting numbers, not only templates.
  - **Pre-fill (Decided):** an exercise whose name matches a bank exercise gets the bank's placeholder weight; primaries also get the **top of their rep range** as reps. Others start blank.
  - **Weight stacks (Decided):** a cable or machine exercise without a stack asks for one on its screen, with quick picks (5 lb steps, 10 lb steps) or the gym's own list typed in. The last pick is offered first on the next cable/machine exercise. Stacks stay per exercise (§6.2 unchanged).

**Not in v1.1.0:** editing finished sessions (§10 #2) and the "Earlier ideas" in §11.

## 9.2 v1.2.0 scope (Decided 2026-10-04 — not yet built)

Theme: **logging fidelity**. Fixes for things noticed in daily use, from the owner's own use rather than friends' feedback. All additive (minor version); no backend. Built in this order, each slice a small PR or two, then a release PR.

**Slice 0: Quality groundwork (Decided 2026-10-05; from the v1.2.0 quality pass).** Prepares the code the three feature slices build on, from an `architecture-reviewer` pass over all of `main`. One small PR per group, in this order. Groups 1–3 change no behavior; group 4 makes the visible changes listed.
1. **Pure-layer groundwork (built).**
   - Session types (`Session`, `ExerciseLog`, `Substitute`) and the pure history helpers (`exerciseHistory`, `lastLoggedDayId`, `exerciseHasHistory`, `dayHasHistory`) move out of `storage/` into the pure layer, so `session/` and `history/` stop importing from storage. `storage/db.ts` imports the types, as it already does for the program.
   - `exerciseHistory` can return history **before a given session**. Slice 1 needs this, so an edited session is judged against what came before it, not against itself and later sessions. **"Before" is replay order (Decided 2026-10-05):** by start time, then by id for sessions that started at the same moment, so editing sees exactly the history the replay used.
   - The backup validator fails to compile if a stored field is left out, so slices 2 and 3 can't silently drop their new fields on restore.
   - History rows carry their session id (slices 1 and 3).
2. **Session rules in `src/session/`, with tests (built).** The set target (deload-halved for originals, configured for substitutes), the "Only X of Y" tally, set pre-fill (§5.2), set-form validation, and the "set 1 of a primary has effort" check, which slice 1 also needs since editing has no Finish step. These were inline in the session components.
3. **One starting-numbers entry (built).** `ExerciseForm` and `SeedWalkthrough` share one seed-entry component and pure, tested seed and exercise-form helpers in `src/program/`.
   - Both show the §5.1 wording ("Enter a weight and reps you're confident you could do…"); the walkthrough's hint had drifted.
   - The exercise form's bank placeholder weight snaps onto the exercise's typed loads, as the walkthrough's pre-fill does. Otherwise the two flows keep their Decided differences: the form shows a placeholder, the walkthrough fills in a value (§9.1 slices 2 and 3), and stack quick picks stay walkthrough-only.
4. **Fixes and CSS/format cleanup (built).**
   - **Stepper font (fix):** the weight and reps inputs go back to the large text size they were built with. A later global input rule has overridden it since before v1.0.0 shipped.
   - **One exercise summary line:** the "Primary · 3 × 5–7 · Barbell" line, built three ways today, comes from one shared formatter. Equipment is shown by its label everywhere, "per side" wherever it applies, and the effort target only on the Program tab.
   - **No visible change:**
     - The History picker's grouping (§5.3) moves into `src/history/` with tests.
     - `EffortPicker` uses the `Field` primitive.
     - The pressed-button style and the duplicate list-button styles are each defined once.

**Slice 1: Edit finished sessions (Decided; resolves §10 #2; built).**
- **Any finished session** can be edited, however old. Progression state is derived by replaying history (ARCHITECTURE.md), so an edit recomputes everything after it, and no cut-off is needed.
- **What can change:** a set's weight, reps and effort; **delete a set**; **delete the whole session** (with a confirm). Adding sets, and undoing a replace or skip, stay closed once a session is finished.
- **Same rules as during a session:** one working weight per exercise; set 1 of a primary keeps its effort. Deleting every set of an exercise makes it "not done" for that session (no fail, no stack), as with a skip (§5.2).
- **Deleting a session** removes it entirely; the rotation then continues from the session before it (§5.1).
- **Where (Decided 2026-10-05):** each History row has an **Edit** button that opens that whole session for editing: every exercise in it, with the same set list and set form as a live session. There's no form for a new set, no ⋯ menu, no warm-up banner and no Finish. **Done** closes it. Each change saves as it's made, as during a session. Validation messages are judged against the history before that session (§9.2 slice 0, group 1).
- **Deleting a session (Decided 2026-10-05):** from the editor, after a confirm that names the day and date and says every exercise's sets in it are deleted, not just the one whose History row was tapped.
- **Deleting set 1 of a primary (Decided 2026-10-05):** if the set that would become set 1 has no effort, the delete asks for one. That set opens in the form with effort required, and the delete and the effort are saved together; Cancel keeps set 1. The same applies during a live session, since it shares the set editor; before this, Finish was silently disabled instead.
- **An emptied session (Decided 2026-10-05):** a finished session whose sets are all deleted, but which is kept, still counts as that day's session for the rotation (§5.1). Only deleting the session moves the rotation back. **Deleting the last set (Decided 2026-10-05):** an emptied session drops out of History, so deleting the last set in a finished session asks whether to delete the whole session; No keeps it, empty, as above.
- **Outcome messages (Decided 2026-10-05):** a finished session shows each exercise's validation message whenever it has sets, not only when all its target sets are in, since the replay judged it however many there were.

**Slice 2: Add a set on the fly (Decided).**
- Once the configured (or deload) number of sets is logged, an exercise offers **+ Add set**, for originals and substitutes alike.
- **Extra sets are recorded, not counted:** shown in the session and History, tagged "extra", but excluded from validation (the floor rule and "range filled", §6.5–6.6) and from e1RM. The configured sets are the only ones that steer suggestions, so "sets are never added by progression" (§6.2) still holds.
- Storage change: extra sets are marked as such, since the configured count can change later. Needs the ARCHITECTURE.md checklist.

**Slice 3: Session notes (Decided).**
- An optional **note for next time** above Finish on every session; the "Finish anyway?" confirm mentions it. Plain text, up to 200 characters.
- **Shown** on the Today screen the next time that training day comes up ("Last time: …"), and on History rows for that session.
- Editable with the session (slice 1). Storage change: a note on the session. Needs the ARCHITECTURE.md checklist.

**Not in v1.2.0:** the rest of §11, and the primary-lift deload "resume" rule, which waits for real deload data (§10).

## 10. Open questions (summary)

Ask the project owner before building anything each one affects:

1. ~~**Incomplete sessions**~~ — **Decided:** validation runs on the logged sets only; a missing set is not a fail (§5.2).
2. ~~**Editing / undoing a logged set**~~ — **Decided (v1.2.0, §9.2 slice 1):** any finished session can be edited (set numbers, delete a set, delete the session), and later state recomputes by replay.
3. ~~**Units**~~ — **Decided:** pounds only for v1.
4. ~~**Dumbbell weight convention**~~ — **Decided:** per hand (§6.1).
5. ~~**Barbell minimum load**~~ — **Decided:** 45 lb empty bar, 5 lb steps (§6.2).
6. ~~**No load reaches the target reps**~~ — **Decided:** if even the lightest available load predicts fewer than the target reps (only possible with a very low e1RM), the engine suggests the lightest load (as built in v1.0.0).

Flagged to revisit after real use (not blocking):
- Primary-lift deload: resuming at the last successful numbers (§6.7).

## 11. Post-MVP ideas (parked)

### Earlier ideas

- **e1RM confidence measure:** the spread between recent session e1RMs (max − min, or standard deviation). Tight spread = stable estimate; wide spread = noisy. Formula agreement within one set is *not* a confidence signal (§6.4).
- Rest timer, possibly with push notifications via a small serverless function.
- Cloud sync / backup (natural first cloud project).
- ~~Option to run primary lifts **without e1RMs**~~ — **superseded:** the effort scales (§9.1 slice 1) remove the RPE friction behind it, and an exercise can already be set as an accessory to use plain double progression.
- **Muscle-group-aware substitutes** (v2/v3): when replacing an exercise, offer exercises tagged with the same primary muscle and tier (e.g. replacing Bench suggests other pec-primary lifts). Needs a muscle-group store: exercise ↔ muscle group is **many-to-many** (a join table with a primary/secondary role).
- ~~**Add a set on the fly**~~ — **scoped for v1.2.0** (§9.2 slice 2).
- ~~**Session notes**~~ — **scoped for v1.2.0** (§9.2 slice 3). Still parked: sending notes to an LLM for evaluation (v2/v3; needs a CSP change and breaks "data never leaves the device").
- **Keep history for same-named lifts when a template replaces a program:** today a template creates new exercises, so an existing Bench Press starts fresh and its history stays under "Archived" (§9.1 slice 3). Matching by name could carry history and starting numbers over.
