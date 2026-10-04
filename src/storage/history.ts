import type { ExerciseSession } from '../engine'
import type { Session } from './db'

/** Finished sessions for one exercise, in the shape the engine takes. */
export function exerciseHistory(sessions: Session[], exerciseId: string): ExerciseSession[] {
  return sessions
    .filter((s) => s.finishedAt)
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && e.sets.length > 0)
        .map((e) => ({ date: s.startedAt, sets: e.sets })),
    )
}

/** The day of the most recent finished session, which drives the rotation (SPEC §5.1). */
export function lastLoggedDayId(sessions: Session[]): string | undefined {
  return sessions
    .filter((s) => s.finishedAt && s.dayId)
    .toSorted((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .at(-1)?.dayId
}

export function exerciseHasHistory(sessions: Session[], exerciseId: string): boolean {
  return sessions.some((s) => s.exercises.some((e) => e.exerciseId === exerciseId && e.sets.length > 0))
}

export function dayHasHistory(sessions: Session[], dayId: string): boolean {
  return sessions.some((s) => s.dayId === dayId)
}
