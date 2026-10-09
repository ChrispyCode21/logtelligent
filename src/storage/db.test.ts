import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import type { Program } from '../program/types'
import type { Session } from '../session/types'
import { parseBackup, restoreBackup } from './backup'
import { db } from './db'

// Upgrade tests (ARCHITECTURE.md, "Changing the data model", step 5): a database saved by an older
// version of the app opens in this one with its data intact, and old backups still restore.
// fake-indexeddb stands in for the browser's IndexedDB.

const SCHEMA = { sessions: '++id, startedAt', programs: 'id' }

/** Write rows as an older app version would have: its schema version, and its record shapes. */
async function saveAtVersion(version: number, rows: { programs?: object[]; sessions?: object[] }) {
  const old = new Dexie('logtelligent')
  old.version(version).stores(version === 1 ? { sessions: SCHEMA.sessions } : SCHEMA)
  if (rows.programs) await old.table('programs').bulkPut(rows.programs)
  if (rows.sessions) await old.table('sessions').bulkPut(rows.sessions)
  old.close()
}

const session: Session = {
  id: 1,
  dayId: 'upper-a',
  startedAt: '2026-10-01T10:00:00Z',
  finishedAt: '2026-10-01T11:00:00Z',
  exercises: [{ exerciseId: 'bench', sets: [{ weight: 225, reps: 4, rpe: 8 }] }],
}
/** A program as saved before effort scales (v2). */
const v2Program = { id: 'main' as const, days: [{ id: 'upper-a', name: 'Upper A', exercises: [] }] }

afterEach(async () => {
  // Closed but still auto-opening, so the next test opens (and upgrades) it on first use.
  db.close({ disableAutoOpen: false })
  await Dexie.delete('logtelligent')
})

describe('database upgrades', () => {
  it('is at version 6; a new version needs an upgrade test from the one before it, then this bump', async () => {
    await db.open()
    expect(db.verno).toBe(6)
  })

  it('opens a v1 database (sessions only) with its sessions intact', async () => {
    const { dayId: _, ...slice1Session } = session
    await saveAtVersion(1, { sessions: [slice1Session] })
    expect(await db.sessions.toArray()).toEqual([slice1Session])
    expect(await db.programs.count()).toBe(0)
  })

  it('gives a v2 program the RPE effort scale (SPEC §5.6)', async () => {
    await saveAtVersion(2, { programs: [v2Program], sessions: [session] })
    const program = await db.programs.get('main')
    expect(program).toEqual({ ...v2Program, effortScale: 'rpe' })
    expect(await db.sessions.toArray()).toEqual([session])
  })

  it('keeps a v3 program’s effort scale', async () => {
    await saveAtVersion(3, { programs: [{ ...v2Program, effortScale: 'perceived' }] })
    expect((await db.programs.get('main'))?.effortScale).toBe('perceived')
  })

  it('opens a v5 database, the version before this one, unchanged (extra sets, notes)', async () => {
    const v5Session: Session = {
      ...session,
      note: 'Felt strong',
      exercises: [
        {
          exerciseId: 'bench',
          sets: [
            { weight: 225, reps: 4, rpe: 8 },
            { weight: 185, reps: 8, extra: true },
          ],
        },
      ],
    }
    const program: Program = { ...v2Program, effortScale: 'rpe' }
    await saveAtVersion(5, { programs: [program], sessions: [v5Session] })
    expect(await db.programs.get('main')).toEqual(program)
    expect(await db.sessions.toArray()).toEqual([v5Session])
  })
})

describe('restoring an old backup into the database', () => {
  it('restores a backup from before effort scales, as RPE', async () => {
    const old = {
      app: 'logtelligent',
      format: 1,
      exportedAt: '2026-10-01T12:00:00Z',
      program: v2Program,
      sessions: [session],
    }
    await restoreBackup(parseBackup(JSON.stringify(old)))
    expect((await db.programs.get('main'))?.effortScale).toBe('rpe')
    expect(await db.sessions.toArray()).toEqual([session])
  })
})
