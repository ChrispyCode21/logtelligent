import type { ExerciseConfig } from '../engine'

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
}
