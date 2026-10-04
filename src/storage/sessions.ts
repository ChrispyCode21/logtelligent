import type { LoggedSet } from '../engine'
import { db, type ExerciseLog } from './db'

export async function startSession(dayId: string, exerciseIds: string[]) {
  await db.sessions.add({
    dayId,
    startedAt: new Date().toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({ exerciseId, sets: [] })),
  })
}

async function updateLog(sessionId: number, exerciseId: string, edit: (log: ExerciseLog) => void) {
  await db.sessions.where('id').equals(sessionId).modify((session) => {
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

export async function finishSession(sessionId: number) {
  await db.sessions.update(sessionId, { finishedAt: new Date().toISOString() })
}

export async function discardSession(sessionId: number) {
  await db.sessions.delete(sessionId)
}
