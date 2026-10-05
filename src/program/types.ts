import type { ExerciseConfig } from '../engine'
import type { EffortScale } from './effort'

/** Archived items are hidden from the program but keep their history (SPEC §6.1). */
export interface ProgramExercise extends ExerciseConfig {
  archived?: boolean
}

export interface ProgramDay {
  id: string
  name: string
  archived?: boolean
  /** In session order. */
  exercises: ProgramExercise[]
}

/** The training program: days in rotation order (SPEC §5.1). There is one. */
export interface Program {
  id: 'main'
  days: ProgramDay[]
  /** How effort is entered and shown; always stored as RPE (SPEC §9.1, slice 1). */
  effortScale: EffortScale
}
