import type { LoggedSet } from '../engine'
import { db } from './db'

export async function startSession(dayId: string, exerciseIds: string[]) {
  await db.sessions.add({
    dayId,
    startedAt: new Date().toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({ exerciseId, sets: [] })),
  })
}

export async function saveSets(sessionId: number, exerciseId: string, sets: LoggedSet[]) {
  await db.sessions.where('id').equals(sessionId).modify((session) => {
    const log = session.exercises.find((e) => e.exerciseId === exerciseId)
    if (log) log.sets = sets
  })
}

export async function finishSession(sessionId: number) {
  await db.sessions.update(sessionId, { finishedAt: new Date().toISOString() })
}

export async function discardSession(sessionId: number) {
  await db.sessions.delete(sessionId)
}
