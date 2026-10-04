import Dexie, { type EntityTable } from 'dexie'
import type { LoggedSet } from '../engine'
import type { Program } from '../program/types'

export interface ExerciseLog {
  exerciseId: string
  sets: LoggedSet[]
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
