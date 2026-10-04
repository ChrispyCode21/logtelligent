import Dexie, { type EntityTable } from 'dexie'
import type { LoggedSet } from '../engine'

export interface ExerciseLog {
  exerciseId: string
  sets: LoggedSet[]
}

/** A training session. Unfinished sessions are still being logged and can be edited. */
export interface Session {
  id: number
  /** ISO 8601 timestamp. */
  startedAt: string
  finishedAt?: string
  exercises: ExerciseLog[]
}

export const db = new Dexie('logtelligent') as Dexie & {
  sessions: EntityTable<Session, 'id'>
}

// Only indexed fields are listed; the rest of each record is stored as-is.
db.version(1).stores({
  sessions: '++id, startedAt',
})
