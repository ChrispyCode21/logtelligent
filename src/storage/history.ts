import type { ExerciseSession } from '../engine'
import type { Session, Substitute } from './db'

/** An engine session plus what the history view shows for a replaced one. */
export interface LoggedExerciseSession extends ExerciseSession {
  substitute?: Substitute
}

/**
 * Finished sessions for one exercise, in the shape the engine takes.
 * Replaced sessions are included but flagged, so the engine skips them (SPEC §5.2, A6);
 * skipped exercises are left out.
 */
export function exerciseHistory(sessions: Session[], exerciseId: string): LoggedExerciseSession[] {
  return sessions
    .filter((s) => s.finishedAt)
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && !e.skipped)
        .filter((e) => e.sets.length > 0 || (e.substitute?.sets.length ?? 0) > 0)
        .map((e) =>
          e.substitute
            ? { date: s.startedAt, sets: e.sets, replaced: true, substitute: e.substitute }
            : { date: s.startedAt, sets: e.sets },
        ),
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
  return sessions.some((s) =>
    s.exercises.some(
      (e) => e.exerciseId === exerciseId && (e.sets.length > 0 || (e.substitute?.sets.length ?? 0) > 0),
    ),
  )
}

export function dayHasHistory(sessions: Session[], dayId: string): boolean {
  return sessions.some((s) => s.dayId === dayId)
}
