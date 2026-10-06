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
  /** Logged beyond the prescribed sets: recorded, but not counted by the engine (SPEC §9.2, slice 2). */
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
}

export type E1rmBasis = 'history' | 'returningFromBreak' | 'seed'

export interface RunningE1rm {
  value: number
  basis: E1rmBasis
}

/** A weight and rep target. `top` is the effective top of the rep range (accessories, SPEC §6.2). */
export interface Numbers {
  weight: number
  reps: number
  top: number
}

/**
 * What the next session should be (SPEC §6.6–6.7).
 * - normal: primary lifts use the e1RM rule; accessories use double progression (`numbers`).
 * - revert: last successful numbers after a fail. retry: the heavier numbers that failed.
 * - deload: one lighter week. resume: last successful numbers after a deload.
 */
export type Plan =
  { kind: 'normal'; numbers?: Numbers } | { kind: 'revert' | 'retry' | 'deload' | 'resume'; numbers: Numbers }

export type PlanKind = Plan['kind']

/** Per-exercise progression state, derived by replaying that exercise's history. */
export interface ProgressionState {
  stacks: number
  lastSuccess?: Numbers
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
