import { progressAccessory, startingNumbers } from './accessory'
import { availableLoads, stepDown } from './loads'
import { countedSets } from './sets'
import type {
  ExerciseConfig,
  ExerciseSession,
  LoggedSet,
  Numbers,
  Plan,
  ProgressionState,
  RepRange,
  SessionOutcome,
} from './types'

export const FAIL_MESSAGE = "Failed to hit minimums, next week's weight will be lowered."

export function deloadMessage(name: string): string {
  return `Failed to hit minimums again. Next week is a deload for ${name}.`
}

/** Midpoint of the rep range, rounded up (SPEC §6.4). */
export function targetReps(range: RepRange): number {
  return Math.ceil((range.min + range.max) / 2)
}

/** Floor rule (SPEC §6.6): any logged set below the bottom of the range fails the session. */
export function failsFloor(config: ExerciseConfig, sets: LoggedSet[]): boolean {
  return sets.some((s) => s.reps < config.repRange.min)
}

export function initialState(config: ExerciseConfig): ProgressionState {
  const numbers =
    config.tier === 'accessory' && config.seed ? startingNumbers(config, config.seed.weight) : undefined
  return { stacks: 0, next: { kind: 'normal', numbers } }
}

/** The rep target a session was aiming for when it had no fixed numbers. */
function defaultReps(config: ExerciseConfig): number {
  return config.tier === 'primary' ? targetReps(config.repRange) : config.repRange.min
}

function normalAfter(config: ExerciseConfig, loads: number[], done: Numbers, sets: LoggedSet[]): Plan {
  if (config.tier === 'primary') return { kind: 'normal' }
  return { kind: 'normal', numbers: progressAccessory(config, loads, done, sets) }
}

/** Validate one session and advance the state (SPEC §6.6–6.7). */
export function step(
  config: ExerciseConfig,
  loads: number[],
  state: ProgressionState,
  sets: LoggedSet[],
): SessionOutcome {
  const plan = state.next

  // Deloads skip the floor rule; afterward stacks are 0 and we resume (SPEC §6.7).
  if (plan.kind === 'deload') {
    return {
      result: 'deload',
      state: {
        stacks: 0,
        lastSuccess: state.lastSuccess,
        next: { kind: 'resume', numbers: plan.numbers },
      },
    }
  }

  // Sessions are classified by the weight actually lifted (SPEC §6.6).
  const weight = sets[0].weight
  const planned = plan.numbers ?? { weight, reps: defaultReps(config), top: config.repRange.max }
  const done: Numbers = { ...planned, weight }

  if (!failsFloor(config, sets)) {
    // A stack clears only on success at (or above) the heavier numbers that failed.
    const clears = state.stacks === 0 || !state.failed || weight >= state.failed.weight
    if (clears) {
      return {
        result: 'success',
        state: { stacks: 0, lastSuccess: done, next: normalAfter(config, loads, done, sets) },
      }
    }
    return {
      result: 'success',
      state: {
        stacks: state.stacks,
        lastSuccess: done,
        failed: state.failed,
        next: { kind: 'retry', numbers: state.failed! },
      },
    }
  }

  const stacks = state.stacks + 1
  const failed = state.failed && weight < state.failed.weight ? state.failed : done
  // No success yet: revert one load step below the failed weight (SPEC §6.6).
  const lastSuccess = state.lastSuccess ?? {
    weight: stepDown(weight, loads),
    reps: defaultReps(config),
    top: config.repRange.max,
  }

  if (stacks >= 2) {
    return {
      result: 'fail',
      state: { stacks, lastSuccess, failed, next: { kind: 'deload', numbers: lastSuccess } },
      message: deloadMessage(config.name),
    }
  }
  return {
    result: 'fail',
    state: { stacks, lastSuccess, failed, next: { kind: 'revert', numbers: lastSuccess } },
    message: FAIL_MESSAGE,
  }
}

/** The settings a session is judged by: its stored rep range, or the current one (SPEC §9.4 slice 1). */
function judgedBy(config: ExerciseConfig, session: ExerciseSession): ExerciseConfig {
  return session.repRange ? { ...config, repRange: session.repRange } : config
}

function sameRange(a: RepRange, b: RepRange): boolean {
  return a.min === b.min && a.max === b.max
}

/**
 * A rep-range change is a fresh start (SPEC §9.4 slice 1): stacks, the last successful numbers and
 * any pending revert, retry or deload are cleared. Primary lifts go back to the e1RM rule;
 * accessories restart at the bottom of the new range, at the weight they'd have been suggested.
 */
export function freshStart(config: ExerciseConfig, state: ProgressionState): ProgressionState {
  const weight = state.next.numbers?.weight
  const numbers =
    config.tier === 'accessory' && weight !== undefined ? startingNumbers(config, weight) : undefined
  return { stacks: 0, next: { kind: 'normal', numbers } }
}

/**
 * Replay an exercise history, oldest first, to get its current state under `config`.
 * Each session is judged by its own stored rep range, if it has one, and a change of range between
 * sessions, or from the last session to `config`, is a fresh start (SPEC §9.4 slice 1).
 * Also returns the history annotated with which sessions were deloads.
 * Replaced sessions (a substitute was logged) are skipped (SPEC §5.2).
 * Any extra fields on the sessions are passed through untouched.
 */
export function deriveState<S extends ExerciseSession>(config: ExerciseConfig, history: S[]) {
  const loads = availableLoads(config)
  const sorted = [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  // Starts from the first judged session's range, so its seed numbers are in that range's terms.
  let state: ProgressionState | undefined
  let range: RepRange | undefined
  const sessions: S[] = []

  for (const session of sorted) {
    // Only prescribed sets count; a session with none (only extras) is "not done", like a skip.
    const counted = countedSets(session.sets)
    if (session.replaced || counted.length === 0) {
      sessions.push(session)
      continue
    }
    const judged = judgedBy(config, session)
    state ??= initialState(judged)
    if (range && !sameRange(range, judged.repRange)) state = freshStart(judged, state)
    range = judged.repRange
    const isDeload = state.next.kind === 'deload'
    state = step(judged, loads, state, counted).state
    sessions.push({ ...session, isDeload })
  }

  if (!state) return { state: initialState(config), sessions }
  if (range && !sameRange(range, config.repRange)) state = freshStart(config, state)
  return { state, sessions }
}

/**
 * Validate a session's sets against the finished history of its exercise. Only the prescribed
 * sets are judged (SPEC §9.2, slice 2); at least one must be logged.
 */
export function evaluateSession(
  config: ExerciseConfig,
  history: ExerciseSession[],
  sets: LoggedSet[],
): SessionOutcome {
  const { state } = deriveState(config, history)
  return step(config, availableLoads(config), state, countedSets(sets))
}
