// Domain types for the progression engine (SPEC §8). All weights are in pounds.

export type Tier = 'primary' | 'accessory'

export type EquipmentType = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight'

export interface RepRange {
  min: number
  max: number
}

/** Starting numbers entered at setup (SPEC §5.1). RPE is implied by tier. */
export interface Seed {
  weight: number
  reps: number
}

export interface ExerciseConfig {
  id: string
  name: string
  tier: Tier
  repRange: RepRange
  /** Target RPE for the first working set (primary lifts). */
  targetRpe: number
  sets: number
  equipment: EquipmentType
  /** Per-exercise override of the equipment's available loads (SPEC §6.2 layer 2). */
  loads?: number[]
  /** Max relative load jump before progressing by reps instead (SPEC §6.2 layer 3). */
  maxRelativeJump: number
  /** Reps are recorded per side. */
  unilateral: boolean
  seed?: Seed
}

export interface LoggedSet {
  weight: number
  reps: number
  rpe?: number
  /** Logged beyond the prescribed sets: recorded, but not counted by the engine (SPEC §5.2). */
  extra?: boolean
}

/** One exercise's sets within one session, as the engine sees it. */
export interface ExerciseSession {
  /** ISO 8601 timestamp of the session. */
  date: string
  sets: LoggedSet[]
  /**
   * Deload sessions are excluded from e1RM and progression (SPEC §6.7).
   * The engine sets this itself when it replays history.
   */
  isDeload?: boolean
  /** A substitute was logged instead; its sets don't count for this exercise (SPEC §5.2). */
  replaced?: boolean
  /**
   * Prescribed for more than 10 effective reps (top of range + reps in reserve), so it counts toward
   * the running e1RM only when no lower-rep session does (SPEC §6.4). Set by the engine's replay.
   */
  highReps?: boolean
  /**
   * The rep range this session was prescribed, saved on Finish (SPEC §6.8). Missing for
   * sessions logged before v1.3.0, which are judged by the exercise's current range.
   */
  repRange?: RepRange
}

export type RunningE1rm =
  | { value: number; basis: 'history' | 'seed' }
  | {
      value: number
      basis: 'returningFromBreak'
      /** The share of the past session's e1RM kept, e.g. 0.85 (SPEC §6.4). */
      breakFactor: number
    }

export type E1rmBasis = RunningE1rm['basis']

/** A weight and rep target. `top` is the effective top of the rep range (accessories, SPEC §6.2). */
export interface Numbers {
  weight: number
  reps: number
  top: number
}

/**
 * What the next session should be (SPEC §6.6–6.7).
 * - normal: primary lifts use the e1RM rule; accessories use double progression (`numbers`).
 * - revert: last successful numbers after a fail, or, when there are none, reference numbers one
 *   load step below the failed weight (or the lightest load if there's none below), never lifted
 *   (`unlifted`). retry: the heavier numbers that failed.
 * - deload: one lighter week. resume: after a deload; accessories go back to the last successful
 *   (or reference) numbers, primary lifts use the e1RM rule at the last successful rep target.
 */
export type Plan =
  | { kind: 'normal'; numbers?: Numbers }
  | {
      kind: 'revert'
      numbers: Numbers
      /** The numbers were never lifted: no success to go back to (SPEC §6.6). */
      unlifted?: boolean
      /** Unlifted, and lighter than the weight that failed. */
      steppedDown?: boolean
      /** Unlifted, and the weight that failed was at or below the lightest load, so it couldn't drop. */
      atLightestLoad?: boolean
    }
  | { kind: 'resume'; numbers: Numbers; unlifted?: boolean }
  | { kind: 'retry' | 'deload'; numbers: Numbers }

export type PlanKind = Plan['kind']

/** Per-exercise progression state, derived by replaying that exercise's history. */
export interface ProgressionState {
  stacks: number
  lastSuccess?: Numbers
  /** `lastSuccess` holds reference numbers that were never lifted, from a fail with no success (SPEC §6.6). */
  unlifted?: boolean
  /** The heavier numbers that failed, while stacks > 0. */
  failed?: Numbers
  next: Plan
}

export type SessionResult = 'success' | 'fail' | 'deload'

export interface SessionOutcome {
  result: SessionResult
  /** State after this session. */
  state: ProgressionState
  message?: string
}

export type Suggestion =
  | { kind: 'needsSeed' }
  | {
      kind: 'suggestion'
      plan: PlanKind
      /** A revert or resume to numbers never lifted, not a real past success (SPEC §6.6–6.7). */
      unlifted?: boolean
      /** An unlifted revert lighter than the weight that failed. */
      steppedDown?: boolean
      /** An unlifted revert that couldn't drop: the failed weight was at or below the lightest load. */
      atLightestLoad?: boolean
      weight: number
      /** Rep target. */
      reps: number
      /** Accessories: the effective top of the rep range. */
      effectiveTop?: number
      sets: number
      /** Primary lifts: target RPE for the first set (6 in a deload). */
      targetRpe?: number
      /** Primary lifts on the e1RM rule: reps predicted at `weight` and `targetRpe`. */
      predictedReps?: number
      /** Primary lifts. */
      e1rm?: RunningE1rm
      stacks: number
    }
