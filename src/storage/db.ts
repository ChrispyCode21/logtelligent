import Dexie, { type EntityTable } from 'dexie'
import { LEGACY_EFFORT_SCALE } from '../program/effort'
import type { Program } from '../program/types'
import type { Session } from '../session/types'

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
// v3: programs gain `effortScale`. One saved before it existed used RPE (SPEC §9.1, slice 1).
db.version(3)
  .stores({
    sessions: '++id, startedAt',
    programs: 'id',
  })
  .upgrade((tx) =>
    tx
      .table('programs')
      .toCollection()
      .modify((program: Partial<Program>) => {
        program.effortScale ??= LEGACY_EFFORT_SCALE
      }),
  )
