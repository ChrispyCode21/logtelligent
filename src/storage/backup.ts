import type { Program } from '../program/types'
import { db, type Session } from './db'

// JSON backup (SPEC §2). Bump FORMAT when the shape changes, and teach parseBackup to read old ones.
const APP = 'logtelligent'
const FORMAT = 1

export interface Backup {
  app: typeof APP
  format: typeof FORMAT
  exportedAt: string
  program: Program | null
  sessions: Session[]
}

export function buildBackup(program: Program | undefined, sessions: Session[], now: Date): Backup {
  return { app: APP, format: FORMAT, exportedAt: now.toISOString(), program: program ?? null, sessions }
}

/** logtelligent-YYYY-MM-DD.json, in local time. */
export function backupFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `logtelligent-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Parse and sanity-check a backup file. Throws an Error with a readable message. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isObject(data) || data.app !== APP) throw new Error('That file is not a Logtelligent backup.')
  if (typeof data.format !== 'number' || data.format > FORMAT) {
    throw new Error('That backup was made by a newer version of the app.')
  }
  const sessionsOk =
    Array.isArray(data.sessions) &&
    data.sessions.every((s) => isObject(s) && typeof s.startedAt === 'string' && Array.isArray(s.exercises))
  const programOk = data.program === null || (isObject(data.program) && Array.isArray(data.program.days))
  if (!sessionsOk || !programOk) throw new Error('That backup is incomplete or damaged.')
  return data as unknown as Backup
}

export async function exportBackup(now = new Date()) {
  const [program, sessions] = await Promise.all([db.programs.get('main'), db.sessions.toArray()])
  return { filename: backupFilename(now), json: JSON.stringify(buildBackup(program, sessions, now), null, 2) }
}

/** Replace all data with the backup's, in one transaction. */
export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', db.programs, db.sessions, async () => {
    await db.programs.clear()
    await db.sessions.clear()
    if (backup.program) await db.programs.put(backup.program)
    await db.sessions.bulkPut(backup.sessions)
  })
}
