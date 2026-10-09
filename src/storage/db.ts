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
// v4: logged sets may be marked `extra` (SPEC §9.2, slice 2). No index change and no upgrade:
// a set without the mark is a counted one, as every set before this was.
db.version(4).stores({
  sessions: '++id, startedAt',
  programs: 'id',
})
// v5: sessions may carry a `note` for next time (SPEC §9.2, slice 3). No index change, no upgrade.
db.version(5).stores({
  sessions: '++id, startedAt',
  programs: 'id',
})
// v6: a finished session's exercises may carry a `prescription` (rep range and set count), saved on
// Finish (SPEC §9.4 slice 1). No index change and no upgrade: one without it is judged by the
// exercise's current settings, as every session was before.
db.version(6).stores({
  sessions: '++id, startedAt',
  programs: 'id',
})
