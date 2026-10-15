import { windowStart } from './e1rm'
import { availableLoads, snapDown } from './loads'
import { countedSets } from './sets'
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

/** Every prescribed set is logged and reaches the rep target, the top of `range` (SPEC §6.10). */
function succeeded(config: ExerciseConfig, range: RepRange, counted: LoggedSet[]): boolean {
  return counted.length >= config.sets && counted.every((s) => s.reps >= range.max)
}

/** The first available load at or above `weight`; the weight itself when there's none to snap to. */
function loadAtLeast(weight: number, loads: number[]): number {
  return loads.find((l) => l >= weight - 1e-9) ?? weight
}

/** 10% lighter, snapped down to an available load, never below the lightest (SPEC §6.10). */
function tenPercentLighter(weight: number, loads: number[]): number {
  const lighter = weight * LIGHTER_FACTOR
  return loads.length > 0 ? snapDown(lighter, loads) : lighter
}

interface LinearState {
  /** The last counted session: when, at what weight, and the next session's weight and why. */
  last?: { time: number; weight: number; next: { weight: number; reason: LinearReason } }
  /** Misses in a row at `missWeight`. */
  misses: number
  missWeight?: number
  lastSuccess?: number
  /** The last session ended in a reset, so the next one is marked as a deload. */
  reset: boolean
}

/**
 * Judge one session and advance the state (SPEC §6.10). The session's weight is its first set's;
 * it's judged by its own saved rep range, if it has one (SPEC §6.8).
 */
function step(
  config: ExerciseConfig,
  loads: number[],
  state: LinearState,
  session: ExerciseSession,
  counted: LoggedSet[],
): LinearState {
  const weight = counted[0].weight
  const time = Date.parse(session.date)
  const range = session.repRange ?? config.repRange

  if (succeeded(config, range, counted)) {
    const next = loadAtLeast(weight + incrementOf(config), loads)
    const reason: LinearReason = { kind: 'increase', increment: next - weight }
    return {
      last: { time, weight, next: { weight: next, reason } },
      misses: 0,
      lastSuccess: weight,
      reset: false,
    }
  }

  const misses = (state.missWeight === weight ? state.misses : 0) + 1
  const missed = { lastSuccess: state.lastSuccess, missWeight: weight }
  if (misses >= MISSES_TO_RESET) {
    const next = { weight: tenPercentLighter(weight, loads), reason: { kind: 'reset' } as const }
    return { ...missed, last: { time, weight, next }, misses: 0, reset: true }
  }
  const next = { weight, reason: { kind: 'repeat' } as const }
  return { ...missed, last: { time, weight, next }, misses, reset: false }
}

/**
 * Replay an exercise history, oldest first: the state, and the history with the first session after
 * each reset marked as a deload (SPEC §6.10). Replaced sessions and sessions with no prescribed sets
 * are skipped (SPEC §5.2). Any extra fields on the sessions are passed through untouched.
 */
function replayState<S extends ExerciseSession>(config: ExerciseConfig, history: S[]) {
  const loads = availableLoads(config)
  const sorted = [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  let state: LinearState = { misses: 0, reset: false }
  const sessions: S[] = []

  for (const session of sorted) {
    const counted = countedSets(session.sets)
    if (session.replaced || counted.length === 0) {
      sessions.push(session)
      continue
    }
    // A break clears the miss count (SPEC §6.10).
    if (state.last && state.last.time < windowStart(new Date(session.date))) {
      state = { ...state, misses: 0, missWeight: undefined }
    }
    const isDeload = state.reset
    state = step(config, loads, state, session, counted)
    sessions.push(isDeload ? { ...session, isDeload } : session)
  }
  return { state, sessions }
}

export function replayLinear<S extends ExerciseSession>(config: ExerciseConfig, history: S[]): S[] {
  return replayState(config, history).sessions
}

/** Next session's suggestion (SPEC §6.10). */
export function suggestLinear(config: ExerciseConfig, history: ExerciseSession[], asOf: Date): Suggestion {
  const { state } = replayState(config, history)
  const shape = {
    kind: 'suggestion',
    scheme: 'linear',
    reps: config.repRange.max,
    sets: config.sets,
  } as const
  const { last } = state

  if (!last) {
    if (!config.seed) return { kind: 'needsSeed' }
    return { ...shape, weight: config.seed.weight, reason: { kind: 'start' } }
  }
  if (last.time < windowStart(asOf)) {
    const weight = tenPercentLighter(state.lastSuccess ?? last.weight, availableLoads(config))
    return { ...shape, weight, reason: { kind: 'break' } }
  }
  return { ...shape, ...last.next }
}

/** A session's outcome, judged by the current settings: a success or a miss, with no message (SPEC §6.10). */
export function evaluateLinear(
  config: ExerciseConfig,
  _history: ExerciseSession[],
  sets: LoggedSet[],
): SessionOutcome {
  return {
    result: succeeded(config, config.repRange, countedSets(sets)) ? 'success' : 'fail',
    state: { stacks: 0, next: { kind: 'normal' } },
  }
}
