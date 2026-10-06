import { countedSets, type EquipmentType, type LoggedSet, type RepRange, type Seed } from '../engine'
import { EFFORT_SCALE_IDS, LEGACY_EFFORT_SCALE, type EffortScale } from '../program/effort'
import type { Program, ProgramDay, ProgramExercise } from '../program/types'
import type { ExerciseLog, Session, Substitute } from '../session/types'
import { normalizeNote } from '../session/notes'
import { db } from './db'

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

// Validation. A backup is untrusted input: every field is checked and copied into a fresh
// object, so nothing unexpected (extra fields, wrong types, absurd numbers) reaches the database.

class Damaged extends Error {
  constructor(path: string) {
    super(`That backup is incomplete or damaged (at ${path}).`)
  }
}

type Json = Record<string, unknown>
const MAX_TEXT = 200
const EQUIPMENT: readonly EquipmentType[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']

function obj(v: unknown, path: string): Json {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Damaged(path)
  return v as Json
}

function list(v: unknown, path: string, max = 100_000): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Damaged(path)
  return v
}

function text(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_TEXT) throw new Damaged(path)
  return v
}

function date(v: unknown, path: string): string {
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw new Damaged(path)
  return v
}

function num(v: unknown, path: string, min: number, max: number, integer = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Damaged(path)
  if (integer && !Number.isInteger(v)) throw new Damaged(path)
  return v
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') throw new Damaged(path)
  return v
}

/** Run `check` only when the field is present. */
function optional<T>(v: unknown, check: (v: unknown) => T): T | undefined {
  return v === undefined ? undefined : check(v)
}

/**
 * Every field of T, optional ones included, so a validator that leaves one out fails to compile.
 * Otherwise a new stored field would be silently dropped on restore (ARCHITECTURE.md, checklist).
 */
type AllFields<T> = { [K in keyof Required<T>]: T[K] | undefined }

/** Drop undefined fields so the stored object has only what was in the file. */
function compact<T extends object>(o: AllFields<T>): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

function loggedSet(v: unknown, path: string): LoggedSet {
  const s = obj(v, path)
  return compact<LoggedSet>({
    weight: num(s.weight, `${path}.weight`, 0, 2000),
    reps: num(s.reps, `${path}.reps`, 0, 1000, true),
    rpe: optional(s.rpe, (r) => num(r, `${path}.rpe`, 1, 10)),
    // Extra sets (SPEC §9.2, slice 2). Backups from before them have none: every set counted.
    extra: optional(s.extra, (b) => bool(b, `${path}.extra`)),
  })
}

/** Prescribed sets first, then extras, as the app keeps them, whatever order the file had. */
function sets(v: unknown, path: string): LoggedSet[] {
  const all = list(v, path, 100).map((s, i) => loggedSet(s, `${path}[${i}]`))
  return [...countedSets(all), ...all.filter((s) => s.extra)]
}

function exerciseLog(v: unknown, path: string): ExerciseLog {
  const l = obj(v, path)
  return compact<ExerciseLog>({
    exerciseId: text(l.exerciseId, `${path}.exerciseId`),
    sets: sets(l.sets, `${path}.sets`),
    substitute: optional(l.substitute, (sub) => {
      const s = obj(sub, `${path}.substitute`)
      return compact<Substitute>({
        name: text(s.name, `${path}.substitute.name`),
        sets: sets(s.sets, `${path}.substitute.sets`),
      })
    }),
    skipped: optional(l.skipped, (b) => bool(b, `${path}.skipped`)),
  })
}

function session(v: unknown, path: string): Session {
  const s = obj(v, path)
  return compact<Session>({
    id: num(s.id, `${path}.id`, 1, Number.MAX_SAFE_INTEGER, true),
    dayId: optional(s.dayId, (d) => text(d, `${path}.dayId`)),
    startedAt: date(s.startedAt, `${path}.startedAt`),
    finishedAt: optional(s.finishedAt, (d) => date(d, `${path}.finishedAt`)),
    exercises: list(s.exercises, `${path}.exercises`, 100).map((e, i) =>
      exerciseLog(e, `${path}.exercises[${i}]`),
    ),
    warmupDismissed: optional(s.warmupDismissed, (b) => bool(b, `${path}.warmupDismissed`)),
    // Session notes (SPEC §9.2, slice 3): 1–200 characters. Backups from before them have none.
    note: optional(s.note, (n) => normalizeNote(text(n, `${path}.note`))),
  })
}

function exercise(v: unknown, path: string): ProgramExercise {
  const e = obj(v, path)
  const range = obj(e.repRange, `${path}.repRange`)
  const min = num(range.min, `${path}.repRange.min`, 1, 100, true)
  const tier = e.tier
  if (tier !== 'primary' && tier !== 'accessory') throw new Damaged(`${path}.tier`)
  const equipment = e.equipment as EquipmentType
  if (!EQUIPMENT.includes(equipment)) throw new Damaged(`${path}.equipment`)
  return compact<ProgramExercise>({
    id: text(e.id, `${path}.id`),
    name: text(e.name, `${path}.name`),
    tier,
    repRange: compact<RepRange>({ min, max: num(range.max, `${path}.repRange.max`, min, 100, true) }),
    targetRpe: num(e.targetRpe, `${path}.targetRpe`, 1, 10),
    sets: num(e.sets, `${path}.sets`, 1, 20, true),
    equipment,
    loads: optional(e.loads, (l) =>
      list(l, `${path}.loads`, 500).map((w, i) => num(w, `${path}.loads[${i}]`, 0, 2000)),
    ),
    maxRelativeJump: num(e.maxRelativeJump, `${path}.maxRelativeJump`, 0, 10),
    unilateral: bool(e.unilateral, `${path}.unilateral`),
    seed: optional(e.seed, (sd) => {
      const s = obj(sd, `${path}.seed`)
      return compact<Seed>({
        weight: num(s.weight, `${path}.seed.weight`, 0, 2000),
        reps: num(s.reps, `${path}.seed.reps`, 1, 100, true),
      })
    }),
    archived: optional(e.archived, (b) => bool(b, `${path}.archived`)),
  })
}

function program(v: unknown): Program | null {
  if (v === null) return null
  const p = obj(v, 'program')
  if (p.id !== 'main') throw new Damaged('program.id')
  // Backups from before effort scales have none; those programs used RPE.
  const effortScale = (p.effortScale ?? LEGACY_EFFORT_SCALE) as EffortScale
  if (!EFFORT_SCALE_IDS.includes(effortScale)) throw new Damaged('program.effortScale')
  return compact<Program>({
    id: 'main',
    effortScale,
    days: list(p.days, 'program.days', 50).map((d, i) => {
      const day = obj(d, `program.days[${i}]`)
      return compact<ProgramDay>({
        id: text(day.id, `program.days[${i}].id`),
        name: text(day.name, `program.days[${i}].name`),
        archived: optional(day.archived, (b) => bool(b, `program.days[${i}].archived`)),
        exercises: list(day.exercises, `program.days[${i}].exercises`, 100).map((e, j) =>
          exercise(e, `program.days[${i}].exercises[${j}]`),
        ),
      })
    }),
  })
}

/** Parse and validate a backup file. Throws an Error with a readable message. */
export function parseBackup(raw: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (typeof data !== 'object' || data === null || (data as Json).app !== APP) {
    throw new Error('That file is not a Logtelligent backup.')
  }
  const d = data as Json
  if (typeof d.format !== 'number' || d.format > FORMAT) {
    throw new Error('That backup was made by a newer version of the app.')
  }
  return {
    app: APP,
    format: FORMAT,
    exportedAt: date(d.exportedAt, 'exportedAt'),
    program: program(d.program),
    sessions: list(d.sessions, 'sessions').map((s, i) => session(s, `sessions[${i}]`)),
  }
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
