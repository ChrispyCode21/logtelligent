import type { LoggedSet, RepRange } from '../engine'

/**
 * What an exercise was prescribed, saved with a session on Finish from the program's settings then
 * (SPEC §9.4 slice 1). The replay judges the session by its rep range; the set count is for display.
 */
export interface Prescription {
  repRange: RepRange
  sets: number
}

/** An ad-hoc replacement for a session's exercise, tracked as volume only (SPEC §5.2). */
export interface Substitute {
  name: string
  sets: LoggedSet[]
}

export interface ExerciseLog {
  exerciseId: string
  /** Sets of the original exercise. Kept, but out of progression, if it was replaced. */
  sets: LoggedSet[]
  substitute?: Substitute
  /** Deleted from this session only (SPEC §5.2). */
  skipped?: boolean
  /** Saved on Finish; missing on open sessions and on sessions finished before v1.3.0. */
  prescription?: Prescription
}

/** A training session. Unfinished sessions are still being logged and can be edited. */
export interface Session {
  id: number
  /** The training day this session was. Sessions from slice 1 have none. */
  dayId?: string
  /** ISO 8601 timestamp. */
  startedAt: string
  finishedAt?: string
  exercises: ExerciseLog[]
  /** The warm-up banner was dismissed for this session (SPEC §5.2). */
  warmupDismissed?: boolean
  /** A note for next time: plain text, trimmed, 1–200 characters (SPEC §9.2, slice 3). */
  note?: string
}
