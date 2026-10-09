# Lifting Log — Design Spec

> What the app does now, and why: the source of truth for its behavior. Anything built traces back to a section here; behavior it doesn't cover is asked about before it's built (CLAUDE.md). Open questions and ideas are GitHub issues (§9).

---

## 1. Problem

Hand-typed workout notes (e.g. in Apple Notes) record what happened but don't tell me what to do next. Working out next week's weights means scrolling back, comparing, and guessing — and RPE / targets usually never get written down at all.

**The app is an intelligent logger:** I log my sets in the gym, and it uses my own history to suggest next session's weights and reps. "Intelligent" means a deterministic progression algorithm — **no LLM/AI service**.

## 2. Platform & architecture

- **PWA** (installable web app, added to the iPhone home screen). No App Store.
- **React + TypeScript**, built with **Vite**.
- **Local-only data** in the browser's IndexedDB, via **Dexie**. No backend, no accounts. Data never leaves the device except through a backup the user exports.
- **Offline-capable** (service worker via `vite-plugin-pwa`) — gym signal is unreliable.
- **Free static hosting:** Cloudflare, deployed from `main` on every push, on the app's own origin (ARCHITECTURE.md, "Hosting and security"). Security headers in `public/_headers`.
- **Pounds only.**
- **Backup:** export downloads `logtelligent-YYYY-MM-DD.json` (program + all sessions, with a format version); **import** restores a backup file, replacing all data after a confirm.
- **Progression engine is pure TypeScript** — no React, no database access — so it can be unit-tested in isolation (Vitest).

## 3. Non-goals

Not part of the app; adding one is a scoping decision for the owner:

- Rest timer (rest is self-judged).
- Push notifications / reminders.
- Apple Watch or Apple Health integration.
- Cloud sync, accounts, or any backend.
- LLM / AI coaching.
- Native iOS app or App Store distribution.
- Logging warm-up sets.
- Visual polish beyond "clear and fast to use one-handed."

## 4. Screens and UI conventions

- Three tabs: **Today** (the next session, or the one in progress), **History** (§5.3) and **Program** (§5.1, §5.5, §5.6, backup).
- Built for one hand on a phone: every tap target is at least 44 px (the warm-up banner's ✕ and the Program tab's move and remove buttons included), and no screen scrolls sideways or clips a button label at 375 px or 320 px wide.
- The weight and reps inputs use a large text size. A logged-set row's text ("Set 1 · 225 × 5") is centred vertically in its row.
- Confirms for destructive or unusual actions are the browser's native `confirm()`, so their buttons are OK and Cancel.

## 5. Core user flows

### 5.1 Set up a program
1. Create training days in rotation order (e.g. Upper A, Lower A, Upper B, Lower B for a ULRUL split).
2. Add exercises to each day, in order, from the exercise bank or as custom exercises.
3. Configure each exercise (§6.1).
4. Enter each exercise's starting numbers (below).

Each day has a fixed set of exercises. Upper A and Upper B use different exercises; swapping exercises within the same day from week to week is discouraged, because it breaks tracking.

**The Program tab**, top to bottom: the effort scale card (§5.6); while there are no active days, the templates (below); the days and their exercises; while there are active days, the "Change your program" card (§5.5); backup. Each exercise shows one summary line, the same format everywhere ("Primary · 3 × 5–7 · Barbell"): equipment by its label, "per side" wherever it applies, and the effort target only on the Program tab.

**Exercise bank:** the 57 exercises in `src/program/bank.ts`, built into the app (no network), text only, no images. Each has a name, tier, equipment, default rep range, sets, unilateral, a one-line description, and a placeholder starting weight.
- "Add exercise" opens the bank grouped by body area (Chest, Back, Shoulders, Arms, Legs, Core). Groups start collapsed, with a count. Typing in the search box filters across all groups and opens every group with a match. The body area is a display label only, not a muscle-group model.
- **Search** matches the name and a few common nicknames per exercise (e.g. "RDL" → Romanian Deadlift, "OHP" → Overhead Press), ignoring case and punctuation; every word typed must match.
- **Custom…** covers anything not listed.
- **After picking,** the usual exercise form opens, prefilled with the bank's defaults, its description and its placeholder starting weight: review, enter starting numbers, Save. One flow for bank and custom exercises. The defaults are copied into a normal, fully editable exercise; no link to the bank is stored. An exercise joining a lift with history copies some setup from it instead (§6.9).

**Starting numbers (seed):** the app cannot start a session until every exercise has them (a primary joining a lift with history is the exception, §6.9).
- **Primary lifts:** enter a weight × reps you could do confidently — with effort, but no risk of failing. Prompt along the lines of: *"Enter a weight and reps you're confident you could do: hard, but you wouldn't fail."* This is recorded as a set at **RPE 7** and produces the seed e1RM (§6.4).
- **Accessory lifts:** the prompt asks for a weight at the **bottom of the configured rep range**, e.g. *"What's a weight you can do 15 lateral raises (per side) with that would be hard, but achievable?"* The answer is recorded as weight × bottom-of-range reps at **RPE 8**. Accessories don't use e1RM, so the RPE is informational; the first suggestion is that weight at the bottom of the range.
- The seed is an estimate. If it's off, the progression rules correct it: at worst, one easy (or failed) week, and the next is accurate.
- The exercise form and the walkthrough (below) share one starting-numbers entry with this wording. The form shows a **placeholder** weight as a suggestion: the bank's, snapped down onto the exercise's typed loads. The walkthrough fills in a value instead, and only it offers stack quick picks.

**Templates:** one ships, a **4-day Upper/Lower**, built from bank exercises with their bank defaults:
- **Upper A:** Bench Press, Barbell Row, Dumbbell Shoulder Press, Lat Pulldown, Lateral Raise, Triceps Pushdown
- **Lower A:** Back Squat, Romanian Deadlift, Leg Press, Lying Leg Curl, Standing Calf Raise
- **Upper B:** Overhead Press, Pull-Up, Incline Dumbbell Press, Seated Cable Row, Dumbbell Curl, Face Pull
- **Lower B:** Deadlift, Bulgarian Split Squat, Leg Extension, Seated Leg Curl, Hanging Leg Raise

Templates are offered while the program has no active days, with building your own as the alternative; switching from another program is "Change your program" first (§5.5). Applying one needs no confirm. It produces a normal, fully editable program, its days added after any archived ones; the effort scale is kept. Each template exercise joins the lift of the same name (§6.9).

**Guided starting-numbers walkthrough:** after picking a template, and from Today's seed gate for any program with exercises missing starting numbers. One screen per exercise still missing them; the seed gate's rules are unchanged, this is just a faster way through it.
- **Next** saves that exercise's starting numbers straight away. **Finish later** leaves; the seed gate resumes at the first exercise still missing numbers. There is no Back button (edit an exercise on the Program tab instead).
- **Pre-fill:** the lift's latest weight when it has history (§6.9), else the bank's placeholder weight for an exercise whose name matches a bank exercise, snapped down onto its stack; primaries also get the **top of their rep range** as reps. Others start blank.
- **Weight stacks:** a cable or machine exercise without a stack asks for one on its screen, with quick picks (5 lb steps, 10 lb steps) or the gym's own list typed in. The last pick is offered first on the next cable/machine exercise. Stacks stay per exercise (§6.2).

**Rotation:**
- The rotation contains **training days only**; rest days are not slots.
- The next day is the one after the last day logged, wrapping from the final day back to the first (`(lastIndex + 1) % days.length`). After Lower B comes Upper A.
- **Days with no exercises are skipped** by the rotation and the Today screen.
- **If the last day logged has since been archived** (e.g. after changing programs), the rotation starts again at the first day.
- "The last day logged" is the latest finished session's day, even if all its sets were deleted afterwards; deleting a session moves the rotation back to the session before it (§5.4).
- One full pass through the rotation = one **week** (cycle). "Last week's numbers" means the previous pass.

### 5.2 Run a session (the main flow)
1. The app opens to the **next day in the rotation**, with the day's "Last time: …" note under its name (below).
2. I can choose a different day, but only after an explicit acknowledgement. Example: I did Lower A but forgot to log it; I can still log Upper B. A skipped day is simply not logged, and the rotation continues from the day I *did* log.
3. A **warm-up reminder banner** at the top of the session, dismissible for that session. It ramps to the day's first exercise at its suggested weight: *"Warm up for Bench Press (225): 5–10 min easy cardio, then ramp: 45 × 10, 110 × 5, 155 × 3, 190 × 1."* Ramp weights are the lightest load, then ~50%, ~70% and ~85% of the working weight, snapped down to available loads (duplicates dropped). With no working weight to ramp to (e.g. unweighted bodyweight), only the cardio line shows. Warm-up sets are not logged.
4. Each exercise shows its suggested weight and rep target. Exercises in a deload week are marked as such (§6.7).
5. I log each working set. The next set **pre-fills** from the previous set's weight and reps (never its effort), so a repeat set is one tap.
6. When the last set of an exercise is entered, validation runs (§6.6) and any message is shown.
7. Finish the session (below), or discard it ("Discard this session? Its logged sets will be deleted."), which also discards its note.

**Sets:**
- **Set target:** the configured count, halved (rounded up) in a deload week (§6.7); a substitute's is the configured count. The exercise's header shows "2 of 3 sets", and "3 of 3 sets + 1 extra" with extras.
- Once the target is logged, the form for a new set is hidden and **+ Add set** offers an extra set (below), for originals and substitutes alike.
- Logged sets stay editable (weight, reps, effort where it's asked) and deletable until the session is finished, and afterwards in the finished-session editor (§5.4).
- **One working weight** among the prescribed sets: changing one changes the others (§6.3). Effort is asked on a primary's first set only (§6.3).
- **Deleting set 1 of a primary:** if the set that would become set 1 has no effort, the delete asks for one: that set opens in the form with effort required, and the delete and the effort are saved together; Cancel keeps set 1. Deleting a later set never asks.
- **Deleting every prescribed set** of an exercise makes it "not done" for that session (no fail, no stack), as with a skip.

**Extra sets** (beyond the prescribed ones):
- **Recorded, not counted:** shown in the session and in History, tagged "extra", but left out of validation (the floor rule and "range filled", §6.5–6.6) and of the e1RM. The prescribed sets are the only ones that steer suggestions, so "sets are never added by progression" (§6.2) still holds. They're stored marked as extra, since the configured count can change later.
- **Own weight,** so an extra can be a lighter back-off set: changing a prescribed set's weight never changes an extra, and changing an extra changes only that extra.
- **No effort asked:** weight × reps only. An extra pre-fills from the set before it (without effort).
- **Extras stay extras:** deleting a prescribed set reopens the form for a prescribed set rather than promoting an extra.
- No limit beyond the backup's 100 sets per exercise. A substitute's extras are tagged the same way.
- If every prescribed set of an exercise is deleted but extras are kept, the session can still finish, and that exercise is "not done" (no fail, no stack).

**Finishing:**
- **Short sessions:** finishing with fewer prescribed sets than the target asks for confirmation: "Only 2 of 3 sets logged. Finish anyway?" Only prescribed sets count, so 2 prescribed sets plus 1 extra out of 3 still asks "Only 2 of 3". With no note, it adds "(No note for next time.)"; with a note, or when no confirm shows, nothing changes. The session is then treated as normal: validation runs on the logged sets only, and a missing set is not a fail. (Leaving early or feeling unwell shouldn't count against progression.)
- Finishing saves each exercise's prescription (§6.8).

**Note for next time:**
- An optional note above Finish on every session. Plain text, up to 200 characters, with a counter near the limit; whitespace only counts as no note.
- It saves when the field is left (leaving the session screen, or the app going to the background, counts) and on Finish. Discarding a session discards its note. It's editable with the session (§5.4).
- **"Last time: …"** shows under the day's name on Today before starting, and at the top of the live session: the note from the last finished session of that same training day. If that one has none, nothing shows.
- History shows it on every exercise's row for that session.

**Exercise menu (⋯):** each exercise in a live session has a menu with **replace** and **delete**.
- **Replace** shows a notice along the lines of: *"This will be tracked as volume only and not used for estimates."* The substitute is a free-text name; its sets are logged as weight × reps (no effort asked), with no suggestion, floor rule or stacks, and with one working weight, as for any exercise (§6.3). Its sets are kept out of the original exercise's progression data: any sets already logged for the original that day (extras included) stay recorded, but the whole session is kept out of the original's progression (A6). They're shown tagged: "Logged before replacing: 225 × 5 @ 8 · 225 × 4 · Extra: 185 × 8".
- **Delete** skips the exercise **for today only**, discarding any sets logged for it today. The program is unchanged, and progression treats it as not done (no fail, no stack).
- **Undo:** while the session is open, a replaced exercise can be un-replaced (discarding the substitute's sets) and a skipped one restored. After Finish, both are read-only.
- **History:** a replaced session shows under the original exercise as "Replaced with …" with the substitute's sets, and no e1RM or chart point.

### 5.3 Review history
1. Pick a **lift** (exercises with the same name, §6.9).
2. See every finished session of that lift from every day, newest first, each tagged with its day: date, every set (weight × reps, effort where logged, §5.6), the extras on their own line ("Extra: 185 × 8 · 185 × 7"), the note (§5.2), and the estimated 1RM over time for primary lifts. Each row has **Edit** (§5.4).

- **The picker** lists each lift once, under the first day it's on: **active lifts** grouped by day, and lifts with no active exercise that have history in an **"Archived"** group. Only finished sessions count as history, so an exercise archived mid-session appears once a finished session has it, never with "No sessions logged yet."
- **e1RM:** each point is **that session's e1RM** (from its first set alone, §6.4), not the running average. Deload sessions are listed and tagged but get no e1RM point. It's shown as a **small line chart** (inline SVG, no chart library) above the session list, and on each session row. Sessions over 10 effective reps are marked on the chart (drawn hollow), since they count toward the running e1RM only when nothing lower does (§6.4).
- A session whose sets were all deleted drops out of History (§5.4).

### 5.4 Edit a finished session
- **Any finished session** can be edited, however old: each History row's **Edit** opens that whole session, every exercise in it, with the same set list and set form as a live session. There's no form for a new set, no ⋯ menu, no warm-up banner and no Finish; **Done** closes it. Each change saves as it's made.
- **What can change:** a set's weight, reps and effort; deleting a set (extras included); the note; deleting the whole session. Adding sets (extras too), and undoing a replace or skip, stay closed.
- **Same rules as a live session:** one working weight among the prescribed sets; set 1 of a primary keeps its effort (deleting set 1, §5.2); deleting every prescribed set makes the exercise "not done" (no fail, no stack).
- **Progression recomputes:** state is derived by replaying history (§6.6), so an edit recomputes everything after it, and no cut-off is needed. The session's validation messages are judged against the sessions before it in **replay order**: by start time, then by id for sessions that started at the same moment. It's judged by its saved prescription (§6.8); editing doesn't change that prescription.
- **Outcome messages:** each exercise's validation message shows whenever it has sets, not only when all its target sets are in, since the replay judged it however many there were.
- **Set counts:** a session with a saved prescription shows "2 of 3 sets" (the target halved for a deload week), as when live. One without (finished before v1.3.0) shows the sets logged, "3 sets" or "1 set + 2 extras", since today's program may differ from what was prescribed then.
- **Deleting the session:** from the editor, after a confirm that names the day and date and says every exercise's sets in it are deleted, not just the one whose History row was tapped. It's removed entirely, and the rotation continues from the session before it (§5.1).
- **Deleting the last set** asks whether to delete the whole session. No keeps it, empty: it drops out of History but still counts as that day's session for the rotation.

### 5.5 Change your program
Abandons the current program entirely, to pick a template or build your own.
- **Where:** with active days, a **"Change your program"** card at the bottom of the Program tab: the note *"Consistency beats novelty: most programs work if you stick with them."* and a **Change your program…** button. With no active days, the templates show instead, at the top (§5.1). There's no direct "replace with a template": switching to one is Change your program, then the template.
- **The confirm:** *"Change your program? Days with logged sessions are archived and their history kept; the rest are deleted."*, then the lifts with history among the active exercises (up to 3 names, then "and 4 more"): *"Bench Press, Back Squat and Deadlift keep their history for your next program."* ("keeps its" for one), then the open session, if any: with sets, *"Your open session (4 sets logged) will be discarded."* (it may have started on an earlier day), like losing unsaved progress; with none, *"Your open session has nothing logged yet, so it will be discarded."*
- **OK:** days with finished history are archived and their history kept, as with any delete (§6.1); the rest are deleted. Every open session is discarded; its sets aren't history, so they don't decide whether a day is archived. Same-named lifts pick their history up in the next program (§6.9). The rotation starts at the new program's first day (§5.1). The effort scale is kept.

### 5.6 Effort scales
The program has an **effort scale** that sets how effort is entered and shown. All three are stored as an **RPE number** (6–10), so the engine, logged sets and e1RM math (§6.4) are the same for each, and switching loses nothing.

| Scale | Input | Maps to RPE |
|---|---|---|
| **RPE** | A picker, half steps 6–10 | as entered |
| **Reps left** | "How many more reps could you have done?" 0 · 1 · 2 · 3 · 4+ | 10 · 9 · 8 · 7 · 6 |
| **Perceived effort** | 5 labeled buttons, stacked (the labels don't fit five across a phone): Easy · Moderate · Challenging · Very hard · Failed on the last rep | 6 · 7 · 8 · 9 · 10 |

- Chosen on a card at the top of the Program tab, with a one-line explanation that it estimates 1-rep maxes, which drive suggested weights. The card's description area is always as tall as the longest of the three descriptions, so switching scales doesn't move the rest of the tab.
- **Default for a new program: Reps left.** A program (or backup) with no stored scale means **RPE**.
- The scale sets the wording of the target-effort field (§6.1), the effort input in a session (§6.3) and how a set is shown. The seed prompt (§5.1) mentions no effort, so it's the same on every scale.
- **Showing a set:** RPE `225 × 4 @ 8`; Reps left `225 × 4 · 2 left`; Perceived effort `225 × 4 · Challenging`.
- **Values between a scale's buttons:** a stored value that doesn't match a scale's buttons (e.g. 8.5 in Reps left) is shown as the nearest label, **rounding toward harder** on a tie (8.5 → "1 left" / "Very hard"). Only the display rounds; the stored value is unchanged unless re-entered.
- **Switching** is allowed at any time, including during a session. Nothing stored changes; the pickers and labels re-render in the new scale.

## 6. Domain rules

### 6.1 Exercise configuration
Per exercise, set at program-setup time:

| Setting | Notes |
|---|---|
| Tier: **primary** or **accessory** | My call per exercise — "primary" means compound-like demands, not a fixed list of lifts |
| Rep range / intent | Configurable, never hard-coded |
| Number of working sets | |
| **Equipment type** | e.g. `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`. Supplies default load steps (§6.2) |
| **Progression profile** | How this exercise's load can change — see §6.2 |
| Unilateral | Reps are always recorded **per side** (e.g. single-arm or alternating DB curls: 30×15 = 15 each side) |
| Target RPE (primary lifts) | First-set target, half steps, default 8; worded in the program's effort scale (§5.6) |
| Starting numbers (seed) | See §5.1 |

**Not in the setup form:** the max relative jump is a fixed 10% for every exercise (§6.2).

**Editing the program:** any setting can be changed at any time; progression replays history under the current settings, except that each finished session keeps its own saved rep range (§6.8). Deleting an exercise or day that has history **archives** it (hidden from the program, history kept); one with none is deleted outright.
- **History** here means finished sessions, plus the open session if it has sets for that exercise or day.
- **Removing the open session's day:** if the open session is on that day and has no sets, it's discarded along with the day, and the confirm says so. (Changing programs discards every open session, §5.5.)

**Bodyweight:** bodyweight exercises can only be **accessories**. Their loads are **added weight** — 0, 5, 10, 15… lb (overridable). Every jump from 0 exceeds 10%, so they progress by reps up to the rep ceiling, then add 5 lb.

**Dumbbells:** dumbbell weights are **per hand** (incline press 70 = 70 lb in each hand).

### 6.2 Progression profile (load steps)
A fixed pound increment doesn't work across exercises. +5 lb on a 300 lb squat is under 2%; +2.5 lb on a 12.5 lb lateral raise is 20%. Each exercise needs its own description of how it progresses.

**Three layers, combined:**
1. **Equipment-type defaults** supply the available loads:
   - Barbell: 5 lb total jumps (2.5 lb plate per side), starting at a 45 lb empty bar. A different bar uses the per-exercise override.
   - Dumbbell: a standard rack list (e.g. 10, 12.5, 15, 17.5, 20, 22.5, 25, 30…).
   - Cable / machine: a stack list I enter (e.g. …99, 110, 121…).
2. **Per-exercise override** of those loads for my gym's actual equipment (e.g. "this gym has 22.5s").
3. **Max relative jump** on top: if the next available load is a bigger jump than this, progress by **reps** instead of weight, extending the effective top of the rep range.

**Rep ceiling:** the rep extension in layer 3 is capped at **120% of the top of the configured range, rounded up** — `ceil(top × 1.2)`. Once the ceiling is reached, the engine takes the next load step anyway, even if it exceeds the max relative jump. This prevents getting stuck doing lateral raises for sets of 25+ because the next dumbbell is a big relative jump.
- Examples: 3–5 → ceiling 6; 8–12 → 15 (14.4 rounded up); 15–20 → 24.
- A percentage, not a fixed "+5", because it scales with the range: +5 is huge on a 3–5 range and small on a 15–20 range.

**Max relative jump:** ≈ 10%.

**Rep extension step:** when the range is filled but the next load is too big a jump, the effective top of the range rises by **10% of the configured top, rounded up, minimum 1** — `Math.max(Math.ceil(top * 0.1), 1)`. When that new top is filled (same >50% rule), it rises again, capped at the ceiling.
- Examples: top 5 → step 1; top 7 → 1; top 12 → 2; top 20 → 2 (so 15–20 extends 20 → 22 → 24).
- Note: it's `Math.max`, not `Math.min` — `Math.min(x, 1)` would cap every step at 1.

When the ceiling is filled, take the load step and reset to the bottom of the configured range.

**Consequence worth knowing:** with standard dumbbells, *every* jump below ~70 lb exceeds 10% (15 → 17.5 is 16.7%; 20 → 22.5 is 12.5%; 25 → 30 is 20%). So light dumbbell accessories will effectively always progress via the rep ceiling. That's intended behavior, not a bug.

**Where this matters in practice:** mostly dumbbell and cable exercises (e.g. lateral raise 20 → 22.5 lb is a 12.5% jump). For barbell primaries, a 5 lb jump is usually well under 10% (225 → 230 ≈ 2%), and a set far above the range (e.g. 12 reps on a 3–5 range) is handled by the e1RM instead: the new estimate raises next session's weight to match (§6.4).

**Sets are never added by progression.** The working-set count is fixed in configuration; progression changes only reps and load. (Extra sets are the lifter's, and aren't counted, §5.2.)

### 6.3 Primary lifts
- **Effort is asked on the first set only, and required there.** Later sets don't ask for it: only the first set's effort is ever used (§6.4). Efforts already stored on later sets are kept and shown.
- **Effort is RPE in half steps from 6 to 10** (6, 6.5 … 10), entered in the program's effort scale (§5.6).
- **The first set is the source of truth** for progression: its weight, reps, and RPE drive next session's suggestion.
- **All sets use one working weight**; no changing weight from set to set (extra sets aside, §5.2).
- Sets 2+ are recorded in full. They don't steer the progression math, but they **feed validation** (§6.6).

### 6.4 Estimated 1RM (primary lifts)
- Each first set produces an **estimated 1RM (e1RM)**, adjusted for RPE: reps in reserve are added to the reps performed. 225×7 @ RPE 7 (~3 in reserve) is estimated as a ~10-rep-max effort. Effective reps = `reps + (10 − RPE)`.
- **Formula:** the e1RM is the **average of Epley, Brzycki, and Lombardi**:
  - Epley `w × (1 + r/30)`
  - Brzycki `w × 36 / (37 − r)`
  - Lombardi `w × r^0.1`
  - Note: these are three curve-fits applied to the same set, not three independent measurements. Their agreement is a sanity check, not added confidence.
- **Shared by the lift:** the running e1RM below is the lift's (§6.9), from the first sets of all its sessions on every day.
- **Lower-rep sessions first:** a session counts toward the running e1RM only if it was prescribed for **10 or fewer effective reps** (the top of its rep range plus the reps in reserve its target effort leaves, `max + (10 − target RPE)`), unless none in the window were; then the higher-rep ones are used. Rep-max formulas are least reliable at high reps, and people differ in how many reps they manage at a given load.
  - **Judged by the prescription, not the reps done,** so a great day on a 6–8 range (9 reps @ 8) never drops out (I9). The range is the session's saved one (§6.8), else today's; the target RPE is today's (it isn't saved).
- **Running e1RM:** the average of the e1RMs from **up to the last 3 sessions within the last 4 weeks**.
  - Average over **however many sessions exist** (1, 2, or 3). Never pad missing sessions with 0 or any placeholder; divide by the actual count.
  - **Returning from a break** (no session in the 4-week window): use **90% of the most recent session's e1RM** and show a "returning from a break" note. The next real session then replaces it. The session is picked with the same lower-rep preference, so the most recent lower-rep session is used however old it is, even over a more recent higher-rep one (I8).
  - Layoff overshoot beyond that is caught by the fail/deload logic in §6.6.
- **No history yet:** a primary lift's first e1RM comes from its **setup seed** (§5.1): weight × reps treated as RPE 7. The seed is used **only until the lift's first real session** (on any day) — it is **not** averaged into the running e1RM afterward, so an optimistic or pessimistic guess can't linger for three sessions.
- **Data-driven targets:** given the running e1RM and a weight, the engine predicts expected reps by inverting the formula (e.g. Epley inverted: reps to failure ≈ `30 × (e1RM / w − 1)`), minus the target reps in reserve. The program stores **intent** (e.g. "3 sets, first set ~RPE 8, 3–5 reps") and the engine chooses the weight.
- **Weight-selection rule:**
  1. Target reps = **midpoint of the rep range, rounded up** (3–5 → 4; 5–7 → 6). The midpoint leaves room on both sides: a good day lands above it, a bad day can still clear the floor.
  2. For each available load, predicted reps = reps to failure (the averaged formula, inverted numerically) − (10 − target RPE).
  3. Suggest the **heaviest available load whose predicted reps ≥ target reps**. If none does (only possible with a very low e1RM), suggest the lightest load.
  - Progress is implicit: if I get stronger, the e1RM rises and the chosen load rises with it. If I don't, the load holds — which is honest.

### 6.5 Accessory lifts
- Effort is not asked. Accessories don't use e1RM, so it would be informational only. Efforts already stored are kept and shown.
- **All sets use one working weight**, as for primary lifts.
- Progression by **double progression**: work up through the rep range at a fixed weight; once the range is filled, move up one load step (§6.2) and drop back to the bottom of the range.
- **"Range filled": more than 50% of working sets reach the top of the range.** In practice: 2 sets → both; 3 sets → 2; 4 sets → 3.

### 6.6 Validation: floor rule and fatigue stacks
Progression state (stacks, the last successful numbers, deloads, rep extensions) is never stored: it's derived by replaying each exercise's finished sessions, oldest first, under the rules below.

**Floor rule:** when the last set of an exercise is entered, check every working set against the **bottom of its rep range**. Any set below the floor = a **failed** session for that exercise.

(Not a total-volume comparison: volume naturally drops when weight goes up and reps reset, so it would penalize successful progression.)

**Fatigue stacks:** each exercise carries its own fatigue-stack count.
- A **failed** session adds **one stack** and **reverts** next session to the last successful numbers.
  Message: *"Failed to hit minimums, next week's weight will be lowered."*
- If the reverted session **succeeds**, the next session retries the heavier numbers that failed.
- If the reverted session **also fails**, that is a second stack.
- **A stack clears only on success at the heavier numbers that originally failed.** Success at the reverted weight does *not* clear it — otherwise alternating A-success / B-fail would loop forever without ever triggering a deload.
- Reaching **two stacks on the same exercise** triggers a **deload** for that exercise (§6.7). Stacks never combine across exercises: one stack on bench plus one on lateral raises is not two stacks.
- Stacks **reset to 0 after a deload**.
- **While an exercise has stacks > 0, the stack logic decides next session's numbers, not the e1RM rule.** In shorthand: `stacks > 0 ? stackState.nextNumbers : e1rmPick`, where `nextNumbers` is either the **revert** (last successful numbers) or the **retry** (the exact numbers that failed) — not always "the previous weight."
- "Last successful numbers" = the weight and rep target of the most recent session for that exercise that passed the floor rule.
- **No successful session yet:** if a session fails before any session has succeeded (e.g. an optimistic seed), the stack is added as usual and the revert goes to **one load step below the failed weight** (accessories: at the bottom of the range). Those numbers then act as the last successful numbers.
- **Off-plan weight:** sessions are classified by the weight actually lifted. At or above the weight that failed counts as the **retry** (success clears the stack); below it counts as a revert-level session (success keeps the stack, a fail adds one).

Example:
| Week | Attempt | Result | Stacks after | Next week |
|---|---|---|---|---|
| 1 | Weight A | Hit top of range | 0 | Weight B (heavier) |
| 2 | Weight B | A later set below floor | 1 | Revert to A |
| 3 | Weight A | Success | 1 | Retry B |
| 4 | Weight B | Success | 0 | Progress normally from B |
| 3 (alt.) | Weight A | Fail | 2 | **Deload** |

**Scope: the floor rule and fatigue stacks apply to every exercise, primary and accessory.** Stacks are tracked **per exercise**, so fatigue on an accessory can never stall or deload a primary lift (or any other exercise). What differs by tier is the deload itself (§6.7).

### 6.7 Deload
Triggered per exercise when that exercise reaches two fatigue stacks. Lasts **one week** (one pass through the rotation). Deload sessions are **excluded from e1RM and progression calculations** and are **not subject to the floor rule**. Afterward, stacks are at 0.

**Primary lifts:**
- **Volume:** about half the working sets (rounded up).
- **Load:** about 10% lighter than the last successful weight, **snapped down** to an available load (§6.2). Target effort ~RPE 6. **Reps:** the last successful rep target (e.g. 225 × 4 → deload 2 × 4 @ 200). ("Intensity" in lifting means load relative to max, not perceived effort — halving it would be far too light.)
- **Afterward:** resume at the last successful numbers (under review: #58).

**Accessory lifts:**
- **Same load, about half the working sets (rounded up)**, at the last successful rep target, for one week — the same set-halving as primary lifts. Edge case: a 1-set exercise stays at 1 set (`ceil(0.5) = 1`).
- **Afterward:** resume at the last successful numbers.
- Rationale: accessories are mostly volume work; a lighter-touch deload is enough.

Note: deload conventions vary between coaches and programs; these values are a sensible starting point, not settled science.

### 6.8 Stored prescriptions
- **What's saved:** each exercise's **rep range and set count**, on **Finish**, from the program's settings at that moment. Not the target RPE (the e1RM uses the effort logged, not the target), tier, or loads (the gym's equipment, not a prescription). An open session uses the current settings, so a range fixed mid-session applies to it. Editing a finished session doesn't change its prescription.
- **Judging:** the progression replay and the finished-session editor judge each session by its own rep range (floor rule, "range filled", rep ceiling and extension, §6.2–6.6). Sessions finished before v1.3.0 have none and use the exercise's current settings everywhere they're judged (History, Today and the finished-session editor alike), so a range change can still re-judge them, even when saved ones follow. The rep range is the only stored setting the replay reads; the set count is for display (§5.4).
- **A rep-range change is a fresh start:** when a session's range differs from the one before it, or the current range differs from the last session's, progression starts afresh from there. Fatigue stacks, the last successful numbers and any pending revert, retry or deload are cleared. Primary lifts go back to the e1RM rule (§6.4), which doesn't depend on the range; accessories restart at the bottom of the new range at the weight they'd have been suggested. A fail before the next success reverts one load step below, as with no success yet (§6.6). Examples H1–H5 (§7.H).

### 6.9 Lifts
Bench is bench, whether it's 3 × 3–5 on a heavy day or 3 × 12–15 on a light one.
- **A lift is a name:** exercises with the same name, ignoring case and punctuation (as the bank search compares names), are one lift, wherever they are in the program. Nothing extra is stored: sessions belong to the exercise, so renaming one ("Bench" → "Bench Press") brings its sessions into that lift, and renaming one to something new ("Paused Bench") makes it a lift of its own, with its sessions.
- **Whatever the equipment:** a custom dumbbell "Bench Press" shares its e1RM with a barbell one. To keep them apart, name them differently ("DB Bench Press"). Bank and template additions copy the lift's equipment, so they match.
- **Shared:** History (§5.3) and the running e1RM, with lower-rep sessions first (§6.4). Each exercise's deload weeks, worked out by its own replay, stay out of the e1RM (§6.7). The seed is dropped once the lift has a real session on any day (§6.4).
- **Per exercise:** the prescription, floor rule, stacks, reverts, retries, deloads and rep extension (§6.2–6.8). A failed heavy day never reverts or deloads the light day.
- **A new exercise joining a lift with history** (added, or from a template):
  - a **primary** needs no starting numbers, since the lift's e1RM picks its weight; the exercise form shows them as optional: "Optional: Bench Press already has an estimated 1RM from your history.";
  - an **accessory** is still asked, since its range may differ, pre-filled with the lift's latest weight (skipping deload weeks);
  - a **bank or template** exercise copies **equipment, loads and one-sided** from the lift's most recently logged exercise (your gym), and keeps the bank's rep range, sets and target RPE (the programming). A custom exercise is entered by hand.
- **Templates** need no matching: a template exercise joins the lift of the same name, so its history is simply there. Examples I1–I9 (§7.I).

## 7. Worked examples → test cases

Each example is one unit test named with its stable ID (e.g. `it('B3: ...')`). Numbers come from the formulas in §6.4, not estimates. If a rule changes, update its examples.

Unless stated: barbell loads in 5 lb steps; dumbbell rack 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35…; e1RM values rounded to 0.1 lb (tests allow ±0.1). `225×4 @8` is 225 lb for 4 reps at RPE 8.

### 7.A Estimated 1RM (§6.4)

| ID | Given | Expected |
|---|---|---|
| A1 | First set 225×4 @8 | Effective reps 6. Epley 270.0, Brzycki 261.3, Lombardi 269.2 → **e1RM 266.8** |
| A2 | First set 225×4 @10 | Effective reps 4 (no reps in reserve added) → **e1RM 253.0** |
| A3 | Last 3 sessions within 4 weeks: 225×4 @8, 225×5 @8, 230×4 @8 | Session e1RMs 266.8, 273.6, 272.7 → **running e1RM 271.1** |
| A4 | Most recent session 6 weeks ago (225×4 @8), none since | 266.8 × 0.9 → running e1RM **240.1** + **"returning from a break"** note. At 3–5 @8 this suggests **200 × 4** (225 before the break) |
| A5 | Last 3 sessions, the middle one a deload | Deload **ignored**: the average uses the 3 most recent *non-deload* sessions in the window |
| A6 | A session where the exercise was **replaced** by a substitute | Substitute's sets **ignored** for the original exercise's e1RM (§5.2) |
| A7 | Only 2 sessions ever, both within 4 weeks: 225×4 @8, 225×5 @8 | (266.8 + 273.6) / **2** → **270.2**. Not divided by 3; no zero padding |
| A8 | Only 1 session ever, within 4 weeks: 225×4 @8 | Running e1RM **266.8** (divided by 1; no break penalty) |
| A9 | Primary, no sessions, seed 225×5 (treated as RPE 7), range 3–5 @8 | Seed e1RM **280.4** → **suggest 235 × 4** (predicted 4.2) |
| A10 | Seed 225×5, then one real session 225×4 @8 | Running e1RM **266.8**: the real session alone; the seed is **dropped**, not averaged |
| A11 | Accessory, no sessions, seed 15 lb × 15 (recorded RPE 8), range 15–20 | **Suggest 15 × 15** (bottom of range) |
| A12 | Any exercise with no seed | App **blocks** starting a session and routes to setup |

### 7.B Primary-lift suggestions (§6.4 weight-selection rule)

| ID | Given | Expected |
|---|---|---|
| B1 | Running e1RM 271.1; 3–5 @8 | Target 4. At 225 predicted 4.6 ✓; at 230 predicted 3.8 ✗ → **suggest 225 × 4** |
| B2 | Only session: first set 225×12 @8 (far above 3–5) | e1RM 325.0 → **suggest 270 × 4** (predicted 4.6). The e1RM corrects the overshoot, not the rep ceiling |
| B3 | Only session: first set 225×7 @7; 5–7 @8 | e1RM 294.4; target 6 → **suggest 235 × 6** (predicted 6.2) |
| B4 | Primary with stacks > 0 | From stack state (7.D), **not** the B rule |

### 7.C Accessory double progression (§6.2, §6.5)

Incline DB press: range 6–8, 3 sets. Lateral raise: range 15–20, 3 sets, dumbbell, ceiling `ceil(20 × 1.2)` = 24.

| ID | Given | Expected |
|---|---|---|
| C1 | Incline: 70×8, 70×8, 70×7 | 2 of 3 at top → filled. 70 → 75 is 7.1% (≤ 10%) → **suggest 75 × 6** |
| C2 | Incline: 70×8, 70×7, 70×6 | 1 of 3 at top → not filled → **suggest 70, target 8** |
| C3 | Incline, 2 sets: 70×8, 70×7 | 1 of 2 at top; more than 50% of 2 = both → not filled → **suggest 70, target 8** |
| C4 | Lateral raise: 15×20, 15×20, 15×18 | Filled. 15 → 17.5 is 16.7% (> 10%) → step `max(ceil(20 × 0.1), 1)` = 2 → **suggest 15, effective top 22** |
| C5 | Lateral raise, effective top 22: 15×22, 15×22, 15×19 | Filled → 22 + 2 = **effective top 24** (the ceiling) |
| C6 | Lateral raise, effective top 24: 15×24, 15×24, 15×22 | Ceiling filled → take the jump anyway → **suggest 17.5 × 15** (reset to bottom) |
| C7 | Lat pulldown, cable stack …110, 121, 132…, range 8–12: 121×12, 121×12, 121×10 | Filled. 121 → 132 is 9.1% (≤ 10%) → **suggest 132 × 8** |
| C8 | Ceilings | 3–5 → 6; 5–7 → 9; 8–12 → 15; 15–20 → 24 |
| C9 | Rep extension steps | Top 5 → 1; top 7 → 1; top 12 → 2; top 20 → 2 |

### 7.D Floor rule and fatigue stacks (§6.6)

Bench, range 3–5, 3 sets. Given is the state before the session, then the session.

| ID | Given | Expected |
|---|---|---|
| D1 | Stacks 0; 225×5, 225×4, 225×3 | All ≥ 3 → **success**. Stacks 0. Next from the e1RM rule |
| D2 | Stacks 0, last success 225; 235×4, 235×3, 235×2 | Set 3 < 3 → **fail**. Stacks **1**. Next **225** (revert). Message: *"Failed to hit minimums, next week's weight will be lowered."* |
| D3 | Stacks 1, failed numbers 235; 225×5, 225×4, 225×3 | Success at the reverted weight → stacks **stay 1**. Next **235** (retry) |
| D4 | Stacks 1, retrying 235; 235×4, 235×3, 235×3 | Success at the failed weight → stacks **0**. Next from the e1RM rule |
| D5 | Stacks 1, reverted to 225; 225×4, 225×3, 225×2 | Fail again → stacks **2** → **deload** next week |
| D6 | Bench stacks 1, lateral raise stacks 1 | **No deload** for either. Stacks never combine across exercises |
| D7 | Stacks 0; then 235 ✗, 225 ✓, 235 ✗ | Stacks 1, stays 1, then **2** → **deload**. The 225-success / 235-fail loop cannot continue forever |
| D8 | Accessory (lateral raise, 15–20): 15×20, 15×16, 15×14 | Set 3 < 15 → **fail**, stacks +1. The floor rule applies to accessories too |

### 7.E Deload (§6.7)

E1–E2c give the deload session.

| ID | Given | Expected |
|---|---|---|
| E1 | Bench (primary), 3 sets, last success 225 × 4, stacks 2 | **2 sets** (`ceil(3/2)`), **200 lb** (225 × 0.9 = 202.5, snapped down), target RPE 6 |
| E2 | Lateral raise (accessory), 3 sets, last success 15, stacks 2 | **2 sets** (`ceil(3/2)`), **same load 15** |
| E2b | Accessory, 4 sets | **2 sets** (`ceil(4/2)`), same load |
| E2c | Accessory, 1 set | **1 set** (`ceil(1/2)` = 1), same load |
| E3 | Deload session with a set below the floor | **No fail**, no stack added (the floor rule doesn't apply) |
| E4 | The week after the deload | Resume at the **last successful numbers** (bench 225 × 4); stacks **0** |

### 7.F Rotation (§5.1)

Days: [Upper A, Lower A, Upper B, Lower B].

| ID | Given | Expected |
|---|---|---|
| F1 | No sessions logged yet | **Upper A** (index 0) |
| F2 | Last logged Upper B (index 2) | **Lower B** |
| F3 | Last logged Lower B (index 3) | **Upper A** (wraps: `(3 + 1) % 4 = 0`), the start of a new week |
| F4 | Last logged Upper A; the user overrides to Upper B and logs it | **Lower B** (rotation continues from the day actually logged) |

### 7.G Reference data

Upper A, logged 2026-10-01 (bench target range set to 3–5 for this example). This log predates the app and has no RPE or explicit targets, so it's input for shaping examples, not a gold standard.

| Exercise | Sets |
|---|---|
| Bench | 225×4, 225×4, 225×3 |
| Incline DB Press | 70×6, 70×6 |
| Lat Pulldown | 121×12, 121×9, 121×8 |
| Seated Cable Row | 99 stack (2 plates below) ×12, same ×10 |
| DB Lateral Raise (single arm) | 12.5×20, 15×15 |
| DB Overhead Extension | 25×15, 25×12, 25×7 |
| DB Curl | 30×15 (per side), 30×9 (per side) |

### 7.H Stored prescriptions (§6.8)

Bench: primary, 3 sets. Lateral raise: accessory, 3 sets, dumbbell rack as above. "Stored" means the session saved that rep range on Finish.

| ID | Given | Expected |
|---|---|---|
| H1 | Bench session stored at 3–5: 225×4, 225×4, 225×3. Range now 8–12 | Judged at 3–5 → **success**, stacks 0. The range changed since, so a fresh start: **next from the e1RM rule** |
| H2 | The same session with no stored range (logged before v1.3.0); range now 8–12 | Judged at today's 8–12 → **fail**, stacks 1 (the current settings, as before v1.3.0) |
| H3 | Lateral raise at 15–20, stored: seed 15, then 15×20, 15×20, 15×18 (plan: 15, effective top 22, C4). Range now 10–12 | Fresh start → **suggest 15 × 10, effective top 12**, stacks 0 |
| H4 | Bench at 3–5, stored: 225×5 @8, 225×5, 225×4 ✓, then 235×4 @8, 235×3, 235×2 ✗ (stacks 1, revert to 225). Range now 5–7 | Fresh start → stacks **0**, **no revert**: next from the e1RM rule |
| H5 | H3, then a session stored at 10–12: 15×9, 15×8, 15×8 | Below 10 → **fail**, stacks 1. No success since the fresh start → **revert to 12.5 × 10** (one step below) |

### 7.I Lifts (§6.9)

Bench Press on two days: Upper A at 3–5 @8 and Upper B at 10–12 @8, both primary, barbell. Sessions within 4 weeks unless stated.

| ID | Given | Expected |
|---|---|---|
| I1 | Upper A: 225×5 @8 (e1RM 273.6). Upper B: 185×12 @8 (e1RM 267.3) | Upper B's 10–12 @8 is high-rep (12 + 2 > 10), so with a lower-rep session in the window it's skipped: lift e1RM **273.6**. Upper A suggests **230 × 4** (predicted 4.1); Upper B (target 11) suggests **190 × 11** (predicted 11.9) |
| I2 | Only Upper B's 185×12 @8 in the window | No lower-rep session, so the high-rep one counts: lift e1RM **267.3**. Upper A suggests **225 × 4** (predicted 4.1) |
| I3 | Upper A: 225×5, 225×4, 225×3 ✓, then 235×4, 235×3, 235×2 ✗. Upper B: one success | Upper A: stacks **1**, revert to 225. Upper B: stacks **0**, plan normal. Stacks never cross exercises, even within a lift |
| I4 | A new primary Bench Press, no starting numbers, joins the lift from I1 (range 3–5) | **Not blocked** by the seed gate (A12 doesn't apply): suggests **230 × 4** from the lift's 273.6 |
| I5 | Upper A: seed 225×5, no sessions. Upper B: one real session 225×4 @8 | Upper A's running e1RM is **266.8**: the lift has a real session, so the seed is dropped (A10 across days) |
| I6 | Upper B's deload week (its own replay says deload) logs 205×5 @6 | **Ignored** in the lift's e1RM, as A5 |
| I7 | Names "Bench Press", "bench-press" and "BENCH  PRESS"; and "Paused Bench" | The first three are **one lift**; "Paused Bench" is another |
| I8 | No session in 4 weeks; Upper A's 225×5 @8 six weeks ago, Upper B's 185×12 @8 five weeks ago | Returning from a break from the most recent **lower-rep** session: 273.6 × 0.9 = **246.2**; Upper A suggests **205 × 4** (predicted 4.5) |
| I9 | A 6–8 @8 primary: 225×7 @8, then a great day 225×9 @8 (9 + 2 = 11 effective reps) | 6–8 @8 isn't high-rep (8 + 2 = 10), so **both count**: (287.4 + 301.7) / 2 = **294.5** |

## 8. Contracts (signatures are in code, `src/engine/`)

The engine takes per-exercise history as dated sessions (not bare `LoggedSet[][]`), since the 4-week window, deload exclusion (A5) and substitute exclusion (A6) all need per-session data.

- **Types** live in code: `engine/types.ts` (`ExerciseConfig`, `LoggedSet`, `ExerciseSession`, `ProgressionState`, `Suggestion`), `program/types.ts` (`Program`, `ProgramDay`, `ProgramExercise`) and `session/types.ts` (`Session`, `ExerciseLog`, `Substitute`, `Prescription`).
- **Suggestions:** `suggestNext(config, history, asOf, lift = []) => Suggestion`. `lift` holds the other same-named exercises' sessions, each marked by its own replay; they feed only the e1RM (§6.9).
- **Validation:** `evaluateSession(config, history, sets) => SessionOutcome`.
- **State is never passed in or stored:** both replay `history` with `deriveState(config, history)` (ARCHITECTURE.md, "Progression state is derived").

## 9. Open questions and ideas

They're GitHub issues, labeled `question` (undecided behavior) or `enhancement` (ideas for later versions), not kept here.
