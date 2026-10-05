import type { ExerciseSession } from '../engine'
import type { Session, Substitute } from '../session/types'

/** An engine session plus what the history view needs: which session it was, and any substitute. */
export interface LoggedExerciseSession extends ExerciseSession {
  /** The stored session's id, so History can act on it (SPEC §9.2, slices 1 and 3). */
  sessionId: number
  substitute?: Substitute
}

/**
 * Finished sessions for one exercise, in the shape the engine takes.
 * Replaced sessions are included but flagged, so the engine skips them (SPEC §5.2, A6);
 * skipped exercises are left out.
 *
 * With `before`, only sessions that came before it are included: the history that session
 * was judged against. Editing a finished session needs this, or it would be validated
 * against itself and every later session (SPEC §9.2, slice 1).
 */
export function exerciseHistory(
  sessions: Session[],
  exerciseId: string,
  before?: Session,
): LoggedExerciseSession[] {
  return sessions
    .filter((s) => s.finishedAt)
    .filter((s) => !before || cameBefore(s, before))
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && !e.skipped)
        .filter((e) => e.sets.length > 0 || (e.substitute?.sets.length ?? 0) > 0)
        .map((e) =>
          e.substitute
            ? { sessionId: s.id, date: s.startedAt, sets: e.sets, replaced: true, substitute: e.substitute }
            : { sessionId: s.id, date: s.startedAt, sets: e.sets },
        ),
    )
}

/**
 * Replay's order: by start time, and by id for the same start time, since sessions are read in
 * id order and the replay's sort is stable.
 */
function cameBefore(a: Session, b: Session): boolean {
  const ta = Date.parse(a.startedAt)
  const tb = Date.parse(b.startedAt)
  return ta < tb || (ta === tb && a.id < b.id)
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
