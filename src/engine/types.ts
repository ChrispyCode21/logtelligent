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
}

/** One exercise's sets within one session, as the engine sees it. */
export interface ExerciseSession {
  /** ISO 8601 timestamp of the session. */
  date: string
  sets: LoggedSet[]
  /** Deload sessions are excluded from e1RM and progression (SPEC §6.7). */
  isDeload?: boolean
  /** A substitute was logged instead; its sets don't count for this exercise (SPEC §5.2). */
  replaced?: boolean
}

export type E1rmBasis = 'history' | 'returningFromBreak' | 'seed'

export interface RunningE1rm {
  value: number
  basis: E1rmBasis
}

export type Suggestion =
  | { kind: 'needsSeed' }
  | {
      kind: 'suggestion'
      weight: number
      reps: number
      sets: number
      targetRpe: number
      /** Reps the engine predicts at `weight` and `targetRpe`. */
      predictedReps: number
      e1rm: RunningE1rm
    }
