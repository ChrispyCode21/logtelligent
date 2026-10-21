import { isHighRepRange, runningE1rm, SEED_RPE, windowStart } from './e1rm'
import { availableLoads, snapDown } from './loads'
import { countedSets } from './sets'
import { pickWeight } from './suggest'
import type {
  ExerciseConfig,
  ExerciseSession,
  LinearReason,
  LoggedSet,
  RepRange,
  SessionOutcome,
  Suggestion,
} from './types'

// Linear (SPEC §6.10): a fixed increase each successful session, with its own failure rule.

const MISSES_TO_RESET = 3
const LIGHTER_FACTOR = 0.9

/** The exercise's increment. Linear is only reached through schemeFor, for an exercise set to it. */
function incrementOf(config: ExerciseConfig): number {
  if (!config.progression) throw new Error(`${config.name} isn't set to Linear`)
  return config.progression.increment
}

/** Every prescribed set is logged and reaches the rep target (SPEC §6.10). */
function succeeded(config: ExerciseConfig, target: number, counted: LoggedSet[]): boolean {
  return counted.length >= config.sets && counted.every((s) => s.reps >= target)
}

/** The rep target: the top of `range`, plus the reps added at the top of the loads (SPEC §6.10). */
function repTarget(range: RepRange, added: number): number {
  return range.max + added
}

function sameRange(a: RepRange, b: RepRange): boolean {
  return a.min === b.min && a.max === b.max
}

/**
 * The weight after a success at `weight` (SPEC §6.10): the first available load at or above it plus
 * the increment, else the heaviest load; the exact sum with no loads to snap to. Undefined at or
 * above the heaviest load, the top of the loads, where a rep is added instead.
 */
function increased(weight: number, increment: number, loads: number[]): number | undefined {
  if (loads.length === 0) return weight + increment
  const heaviest = loads[loads.length - 1]
  if (weight >= heaviest - 1e-9) return undefined
  return loads.find((l) => l >= weight + increment - 1e-9) ?? heaviest
}

/** 10% lighter, snapped down to an available load, never below the lightest (SPEC §6.10). */
function tenPercentLighter(weight: number, loads: number[]): number {
  const lighter = weight * LIGHTER_FACTOR
  return loads.length > 0 ? snapDown(lighter, loads) : lighter
}

interface LinearState {
  /** The last counted session: when, at what weight, whether it succeeded, and the next session's weight and why. */
  last?: { time: number; weight: number; succeeded: boolean; next: { weight: number; reason: LinearReason } }
  /** The rep range the last counted session was judged by. */
  range?: RepRange
  /** Misses in a row at `missWeight`. */
  misses: number
  missWeight?: number
  lastSuccess?: number
  /** Reps added to the rep target at the top of the loads (SPEC §6.10 says when they go). */
  added: number
  /** The last session ended in a reset, so the next one is marked as a deload. */
  reset: boolean
}

/**
 * Judge one session and advance the state (SPEC §6.10). The session's weight is its first set's;
 * `range` is the one it's judged by: its own saved rep range, if it has one (SPEC §6.8).
 */
function step(
  config: ExerciseConfig,
  loads: number[],
  state: LinearState,
  session: ExerciseSession,
  range: RepRange,
  counted: LoggedSet[],
): LinearState {
  const weight = counted[0].weight
  const time = Date.parse(session.date)

  if (succeeded(config, repTarget(range, state.added), counted)) {
    const heavier = increased(weight, incrementOf(config), loads)
    const next =
      heavier === undefined
        ? { weight, reason: { kind: 'topOfLoads' } as const }
        : { weight: heavier, reason: { kind: 'increase', increment: heavier - weight } as const }
    return {
      last: { time, weight, succeeded: true, next },
      range,
      misses: 0,
      lastSuccess: weight,
      added: heavier === undefined ? state.added + 1 : 0,
      reset: false,
    }
  }

  const misses = (state.missWeight === weight ? state.misses : 0) + 1
  const missed = { lastSuccess: state.lastSuccess, missWeight: weight, range }
  if (misses >= MISSES_TO_RESET) {
    const next = { weight: tenPercentLighter(weight, loads), reason: { kind: 'reset' } as const }
    return { ...missed, last: { time, weight, succeeded: false, next }, misses: 0, added: 0, reset: true }
  }
  const next = { weight, reason: { kind: 'repeat' } as const }
  return {
    ...missed,
    last: { time, weight, succeeded: false, next },
    misses,
    added: state.added,
    reset: false,
  }
}

/**
 * Replay an exercise history, oldest first: the state, and the history with the first session after
 * each reset marked as a deload, and each session marked high-rep when its rep target is over 10
 * (no reps in reserve, SPEC §6.4, §6.10). Replaced sessions and sessions with no prescribed sets
 * are skipped (SPEC §5.2). Any extra fields on the sessions are passed through untouched.
 */
function replayState<S extends ExerciseSession>(config: ExerciseConfig, history: S[]) {
  const loads = availableLoads(config)
  const sorted = [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  let state: LinearState = { misses: 0, added: 0, reset: false }
  const sessions: S[] = []

  for (const session of sorted) {
    const counted = countedSets(session.sets)
    if (session.replaced || counted.length === 0) {
      sessions.push(session)
      continue
    }
    // A break clears the miss count and the added reps; a range change, the added reps (SPEC §6.10).
    if (state.last && state.last.time < windowStart(new Date(session.date))) {
      state = { ...state, misses: 0, missWeight: undefined, added: 0 }
    }
    const range = session.repRange ?? config.repRange
    if (state.range && !sameRange(state.range, range)) state = { ...state, added: 0 }
    const isDeload = state.reset
    // The rep target at RPE 10, since Linear prescribes no reps in reserve.
    const highReps = isHighRepRange({ ...range, max: repTarget(range, state.added) }, 10)
    state = step(config, loads, state, session, range, counted)
    sessions.push({ ...session, isDeload, highReps })
  }
  return { state, sessions }
}

export function replayLinear<S extends ExerciseSession>(config: ExerciseConfig, history: S[]): S[] {
  return replayState(config, history).sessions
}

/**
 * The first weight (SPEC §6.10): for a primary whose lift has an e1RM from a real session (`lift`,
 * SPEC §6.9), the heaviest load for the rep target at RPE 7; otherwise the seed's weight.
 */
function startingWeight(config: ExerciseConfig, lift: ExerciseSession[], asOf: Date): number | undefined {
  const loads = availableLoads(config)
  const e1rm = config.tier === 'primary' && loads.length > 0 ? runningE1rm(lift, undefined, asOf) : undefined
  if (e1rm) return pickWeight(e1rm.value, config.repRange.max, SEED_RPE, loads).weight
  return config.seed?.weight
}

/** Next session's suggestion (SPEC §6.10). */
export function suggestLinear(
  config: ExerciseConfig,
  history: ExerciseSession[],
  asOf: Date,
  lift: ExerciseSession[] = [],
): Suggestion {
  const { state } = replayState(config, history)
  const shape = {
    kind: 'suggestion',
    scheme: 'linear',
    reps: config.repRange.max,
    sets: config.sets,
  } as const
  const { last } = state

  if (!last) {
    const weight = startingWeight(config, lift, asOf)
    if (weight === undefined) return { kind: 'needsSeed' }
    return { ...shape, weight, reason: { kind: 'start' } }
  }
  // A break lowers the weight and takes off any reps added at the top of the loads.
  if (last.time < windowStart(asOf)) {
    const weight = tenPercentLighter(state.lastSuccess ?? last.weight, availableLoads(config))
    return { ...shape, weight, reason: { kind: 'break' } }
  }
  // A range change takes them off too, and a rep that would have been added gets no reason.
  if (state.range && !sameRange(state.range, config.repRange)) {
    const { reason } = last.next
    return {
      ...shape,
      weight: last.next.weight,
      reason: reason.kind === 'topOfLoads' ? { kind: 'start' } : reason,
    }
  }
  return { ...shape, reps: repTarget(config.repRange, state.added), ...last.next }
}

/**
 * A session's outcome: a success or a miss, with no message (SPEC §6.10). It's judged as the replay
 * will judge it: `history`, then the session itself on `date` at the current range, through `step`.
 */
export function evaluateLinear(
  config: ExerciseConfig,
  history: ExerciseSession[],
  sets: LoggedSet[],
  date: Date,
): SessionOutcome {
  const session = { date: date.toISOString(), sets, repRange: config.repRange }
  const { last } = replayState(config, [...history, session]).state
  // With no prescribed set logged, the replay skips it, so `last` is an earlier session.
  const judged = countedSets(sets).length > 0 && last?.time === date.getTime()
  return { result: judged && last.succeeded ? 'success' : 'fail' }
}
