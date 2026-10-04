import Dexie, { type EntityTable } from 'dexie'
import type { LoggedSet } from '../engine'
import type { Program } from '../program/types'

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
}

export const db = new Dexie('logtelligent') as Dexie & {
  sessions: EntityTable<Session, 'id'>
  programs: EntityTable<Program, 'id'>
}

// Only indexed fields are listed; the rest of each record is stored as-is.
// Each schema change is a new version; Dexie upgrades existing databases in place.
db.version(1).stores({
  sessions: '++id, startedAt',
})
db.version(2).stores({
  sessions: '++id, startedAt',
  programs: 'id',
})
