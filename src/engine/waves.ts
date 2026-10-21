import { runningE1rm, windowStart } from './e1rm'
import { availableLoads, snapDown } from './loads'
import { countedSets } from './sets'
import type {
  ExerciseConfig,
  ExerciseSession,
  LoggedSet,
  SessionOutcome,
  Suggestion,
  WavesReason,
  WavesSet,
} from './types'

// Waves (SPEC §6.11): 5/3/1-style four-week waves of percentages of a training max (TM).

/** One prescribed set of a week: a share of the TM and its reps (the AMRAP set's minimum). */
interface WeekSet {
  pct: number
  reps: number
}

/** The four weeks, by index; set 3 of weeks 1-3 is the AMRAP set, and week 4 is the deload (SPEC §6.11). */
const WEEKS: WeekSet[][] = [
  [
    { pct: 0.65, reps: 5 },
    { pct: 0.75, reps: 5 },
    { pct: 0.85, reps: 5 },
  ],
  [
    { pct: 0.7, reps: 3 },
    { pct: 0.8, reps: 3 },
    { pct: 0.9, reps: 3 },
  ],
  [
    { pct: 0.75, reps: 5 },
    { pct: 0.85, reps: 3 },
    { pct: 0.95, reps: 1 },
  ],
  [
    { pct: 0.4, reps: 5 },
    { pct: 0.5, reps: 5 },
    { pct: 0.6, reps: 5 },
  ],
]
const DELOAD = 3
const AMRAP = 2
const START_FACTOR = 0.9
const DROP_FACTOR = 0.9
/** Floating-point slack when comparing weights to loads (a tie is exact in decimal). */
const EPSILON = 1e-9

/** The exercise's increment. Waves is only reached through schemeFor, for an exercise set to it. */
function incrementOf(config: ExerciseConfig): number {
  if (config.progression?.scheme !== 'waves') throw new Error(`${config.name} isn't set to Waves`)
  return config.progression.increment
}

/** The nearest available load, an exact tie rounding up, never below the lightest; exact with no loads. */
function nearest(weight: number, loads: number[]): number {
  if (loads.length === 0) return weight
  let best = loads[0]
  for (const load of loads) {
    if (Math.abs(load - weight) <= Math.abs(best - weight) + EPSILON) best = load
  }
  return best
}

/** Snapped down to an available load, never below the lightest; exact with no loads. */
function snappedDown(weight: number, loads: number[]): number {
  return loads.length > 0 ? snapDown(weight + EPSILON, loads) : weight
}

/** The TM after a met cycle: the first load at or above TM + increment, else the heaviest (SPEC §6.11). */
function raised(tm: number, increment: number, loads: number[]): number {
  if (loads.length === 0) return tm + increment
  return loads.find((l) => l >= tm + increment - EPSILON) ?? loads[loads.length - 1]
}

/** The TM after a missed AMRAP or a break: 10% lighter, snapped down (SPEC §6.11). */
const lowered = (tm: number, loads: number[]) => snappedDown(tm * DROP_FACTOR, loads)

interface WavesState {
  /** The next session's week, 0-3 (week 1-4). */
  week: number
  /** The TM, once known (it needs `startTm`). */
  tm?: number
  /** An AMRAP in the cycle so far was missed. */
  missed: boolean
  /** The last counted session: when, its week and whether it was met (a deload week is). */
  last?: { time: number; week: number; met: boolean }
  /** Why the next session has this week and TM. */
  reason: WavesReason
}

/**
 * Replay an exercise history, oldest first: the state, and the history with the deload weeks marked
 * and the AMRAP set named as the one feeding the e1RM. Replaced sessions and sessions with no
 * prescribed sets are skipped (SPEC §5.2). Any extra fields on the sessions are passed through.
 * `startTm` gives the TM at the first counted session (the lift's e1RM then, SPEC §6.11); without it
 * the replay tracks weeks and misses only, which is all `replay` and `evaluate` need.
 */
function replayState<S extends ExerciseSession>(
  config: ExerciseConfig,
  history: S[],
  startTm?: (date: Date) => number | undefined,
) {
  const loads = availableLoads(config)
  const sorted = [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  let state: WavesState = { week: 0, missed: false, reason: { kind: 'start' } }
  const sessions: S[] = []

  for (const session of sorted) {
    const counted = countedSets(session.sets)
    if (session.replaced || counted.length === 0) {
      sessions.push(session)
      continue
    }
    const date = new Date(session.date)
    const time = date.getTime()
    if (!state.last) {
      state = { ...state, tm: startTm?.(date) }
    } else if (state.last.time < windowStart(date)) {
      // A break lowers the TM, clears the cycle's misses and restarts the wave (SPEC §6.11).
      const tm = state.tm === undefined ? undefined : lowered(state.tm, loads)
      state = { ...state, tm, week: 0, missed: false, reason: { kind: 'break' } }
    }

    const { week } = state
    const amrap = week < DELOAD ? counted[AMRAP] : undefined
    const met = week === DELOAD || (amrap !== undefined && amrap.reps >= WEEKS[week][AMRAP].reps)
    const last = { time, week, met }
    const missed = state.missed || !met

    if (week < DELOAD) {
      state = { ...state, week: week + 1, missed, last, reason: { kind: 'continue' } }
    } else if (missed) {
      const tm = state.tm === undefined ? undefined : lowered(state.tm, loads)
      state = { week: 0, tm, missed: false, last, reason: { kind: 'drop' } }
    } else {
      const tm = state.tm === undefined ? undefined : raised(state.tm, incrementOf(config), loads)
      const increment = tm === undefined || state.tm === undefined ? incrementOf(config) : tm - state.tm
      state = { week: 0, tm, missed: false, last, reason: { kind: 'increase', increment } }
    }
    sessions.push({
      ...session,
      isDeload: week === DELOAD,
      // Waves prescribes at most 5 reps and no reps in reserve (SPEC §6.4).
      highReps: false,
      ...(week < DELOAD ? { e1rmSet: AMRAP } : {}),
    })
  }
  return { state, sessions }
}

export function replayWaves<S extends ExerciseSession>(config: ExerciseConfig, history: S[]): S[] {
  return replayState(config, history).sessions
}

/** The TM at the first Waves session: 90% of the lift's running e1RM then, else of the seed's (SPEC §6.11). */
function startingTm(config: ExerciseConfig, lift: ExerciseSession[], date: Date): number | undefined {
  const e1rm = runningE1rm(lift, config.seed, date)
  return e1rm && snappedDown(e1rm.value * START_FACTOR, availableLoads(config))
}

/** Next session's suggestion (SPEC §6.11). */
export function suggestWaves(
  config: ExerciseConfig,
  history: ExerciseSession[],
  asOf: Date,
  lift: ExerciseSession[] = [],
): Suggestion {
  const loads = availableLoads(config)
  // Later sessions of the lift never move the TM: only those before the first Waves session count.
  const before = (date: Date) => lift.filter((s) => Date.parse(s.date) < date.getTime())
  const { state } = replayState(config, history, (date) => startingTm(config, before(date), date))

  let tm = state.tm
  let week = state.week
  let reason = state.reason
  if (!state.last) {
    tm = startingTm(config, lift, asOf)
    reason = { kind: 'start' }
  } else if (state.last.time < windowStart(asOf)) {
    tm = tm === undefined ? undefined : lowered(tm, loads)
    week = 0
    reason = { kind: 'break' }
  }
  if (tm === undefined) return { kind: 'needsSeed' }

  const setPlan: WavesSet[] = WEEKS[week].map((s, i) => ({
    weight: nearest(s.pct * tm, loads),
    reps: s.reps,
    ...(week < DELOAD && i === AMRAP ? { amrap: true } : {}),
  }))
  return {
    kind: 'suggestion',
    scheme: 'waves',
    weight: setPlan[0].weight,
    reps: setPlan[0].reps,
    sets: setPlan.length,
    week: (week + 1) as 1 | 2 | 3 | 4,
    tm,
    setPlan,
    reason,
  }
}

/**
 * A session's outcome: success when its AMRAP set met its minimum, fail when it didn't or wasn't
 * logged, deload in week 4 (SPEC §6.11). It's judged as the replay will judge it: `history`, then
 * the session itself on `date`. No state: the replay needs none.
 */
export function evaluateWaves(
  config: ExerciseConfig,
  history: ExerciseSession[],
  sets: LoggedSet[],
  date: Date,
): SessionOutcome {
  const session = { date: date.toISOString(), sets, repRange: config.repRange }
  const { last } = replayState(config, [...history, session]).state
  // With no prescribed set logged, the replay skips it, so `last` is an earlier session.
  if (countedSets(sets).length === 0 || last?.time !== date.getTime()) return { result: 'fail' }
  if (last.week === DELOAD) return { result: 'deload' }
  return { result: last.met ? 'success' : 'fail' }
}
