import type { LoggedSet } from '../engine'
import type { ExerciseLog } from '../session/types'
import { EMPTY_PROGRAM, findExercise } from '../program/program'
import { withPrescriptions } from '../session/prescription'
import { db } from './db'

export async function startSession(dayId: string, exerciseIds: string[]) {
  await db.sessions.add({
    dayId,
    startedAt: new Date().toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({ exerciseId, sets: [] })),
  })
}

async function updateLog(sessionId: number, exerciseId: string, edit: (log: ExerciseLog) => void) {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((session) => {
      const log = session.exercises.find((e) => e.exerciseId === exerciseId)
      if (log) edit(log)
    })
}

export function saveSets(sessionId: number, exerciseId: string, sets: LoggedSet[]) {
  return updateLog(sessionId, exerciseId, (log) => {
    log.sets = sets
  })
}

// Exercise menu (SPEC §5.2).

export function replaceExercise(sessionId: number, exerciseId: string, name: string) {
  return updateLog(sessionId, exerciseId, (log) => {
    log.substitute = { name, sets: [] }
  })
}

export function saveSubstituteSets(sessionId: number, exerciseId: string, sets: LoggedSet[]) {
  return updateLog(sessionId, exerciseId, (log) => {
    if (log.substitute) log.substitute.sets = sets
  })
}

/** Undo a replace, discarding the substitute's sets. */
export function undoReplace(sessionId: number, exerciseId: string) {
  return updateLog(sessionId, exerciseId, (log) => {
    delete log.substitute
  })
}

/** Skip for today, discarding anything logged for it today. */
export function skipExercise(sessionId: number, exerciseId: string) {
  return updateLog(sessionId, exerciseId, (log) => {
    log.skipped = true
    log.sets = []
    delete log.substitute
  })
}

export function restoreExercise(sessionId: number, exerciseId: string) {
  return updateLog(sessionId, exerciseId, (log) => {
    delete log.skipped
  })
}

export async function dismissWarmup(sessionId: number) {
  await db.sessions.update(sessionId, { warmupDismissed: true })
}

/** Save the note for next time, or clear it (SPEC §5.2). */
export async function saveNote(sessionId: number, note: string | undefined) {
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((session) => {
      if (note === undefined) delete session.note
      else session.note = note
    })
}

/**
 * Finish a session, saving each exercise's prescription from the program as stored right now
 * (SPEC §6.8). One transaction, so a program edit can't land in between.
 */
export async function finishSession(sessionId: number) {
  await db.transaction('rw', db.sessions, db.programs, async () => {
    const program = (await db.programs.get('main')) ?? EMPTY_PROGRAM
    await db.sessions
      .where('id')
      .equals(sessionId)
      .modify((session) => {
        session.finishedAt = new Date().toISOString()
        session.exercises = withPrescriptions(session.exercises, (id) => findExercise(program, id))
      })
  })
}

export async function discardSession(sessionId: number) {
  await db.sessions.delete(sessionId)
}
