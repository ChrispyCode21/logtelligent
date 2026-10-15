import { windowStart } from './e1rm'
import { availableLoads, snapDown } from './loads'
import { countedSets } from './sets'
import type {
  ExerciseConfig,
  ExerciseSession,
  LinearReason,
  LoggedSet,
  SessionOutcome,
  Suggestion,
} from './types'

// Linear (SPEC §6.10): a fixed increase each successful session, with its own failure rule.

const DEFAULT_INCREMENT = 5
const MISSES_TO_RESET = 3
const LIGHTER_FACTOR = 0.9

/** The exercise's increment; the default applies only if the exercise isn't set to Linear. */
const incrementOf = (config: ExerciseConfig) => config.progression?.increment ?? DEFAULT_INCREMENT

/** One number: the top of the rep range (SPEC §6.10). */
const repTarget = (config: ExerciseConfig) => config.repRange.max

/** Every prescribed set is logged and reaches the rep target (SPEC §6.10). */
function succeeded(config: ExerciseConfig, counted: LoggedSet[]): boolean {
  return counted.length >= config.sets && counted.every((s) => s.reps >= repTarget(config))
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
  /** The next session's weight and why; undefined before any counted session. */
  next?: { weight: number; reason: LinearReason }
  /** Misses in a row at `missWeight`. */
  misses: number
  missWeight?: number
  lastSuccess?: number
  lastAttempt?: number
  lastTime?: number
  /** The last session ended in a reset, so the next one is marked as a deload. */
  reset: boolean
}

/** Judge one session and advance the state (SPEC §6.10). The session's weight is its first set's. */
function step(
  config: ExerciseConfig,
  loads: number[],
  state: LinearState,
  counted: LoggedSet[],
): LinearState {
  const weight = counted[0].weight
  const base = { lastAttempt: weight, reset: false }

  if (succeeded(config, counted)) {
    const next = loadAtLeast(weight + incrementOf(config), loads)
    return {
      ...base,
      next: { weight: next, reason: { kind: 'increase', increment: next - weight } },
      misses: 0,
      lastSuccess: weight,
    }
  }

  const misses = (state.missWeight === weight ? state.misses : 0) + 1
  const missed = { ...base, lastSuccess: state.lastSuccess, missWeight: weight }
  if (misses >= MISSES_TO_RESET) {
    const lighter = tenPercentLighter(weight, loads)
    return { ...missed, next: { weight: lighter, reason: { kind: 'reset' } }, misses: 0, reset: true }
  }
  return { ...missed, next: { weight, reason: { kind: 'repeat' } }, misses }
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
    const isDeload = state.reset
    state = { ...step(config, loads, state, counted), lastTime: Date.parse(session.date) }
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
  const shape = { kind: 'suggestion', scheme: 'linear', reps: repTarget(config), sets: config.sets } as const

  if (!state.next || state.lastTime === undefined) {
    if (!config.seed) return { kind: 'needsSeed' }
    return { ...shape, weight: config.seed.weight, reason: { kind: 'start' } }
  }
  if (state.lastTime < windowStart(asOf)) {
    const last = state.lastSuccess ?? state.lastAttempt ?? state.next.weight
    const weight = tenPercentLighter(last, availableLoads(config))
    return { ...shape, weight, reason: { kind: 'break' } }
  }
  return { ...shape, ...state.next }
}

/** A session's outcome: a success or a miss, with no message (SPEC §6.10). */
export function evaluateLinear(
  config: ExerciseConfig,
  _history: ExerciseSession[],
  sets: LoggedSet[],
): SessionOutcome {
  return {
    result: succeeded(config, countedSets(sets)) ? 'success' : 'fail',
    state: { stacks: 0, next: { kind: 'normal' } },
  }
}
