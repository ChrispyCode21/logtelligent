import type { ExerciseSession } from '../engine'
import type { Session, Substitute } from '../session/types'

/** An engine session plus what the history view needs: which session it was, and any substitute. */
export interface LoggedExerciseSession extends ExerciseSession {
  /** The stored session's id, so History can act on it (SPEC §9.2, slices 1 and 3). */
  sessionId: number
  substitute?: Substitute
  /** The session's note for next time, shown on each of its History rows (SPEC §9.2, slice 3). */
  note?: string
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
            ? {
                sessionId: s.id,
                date: s.startedAt,
                sets: e.sets,
                replaced: true,
                substitute: e.substitute,
                note: s.note,
              }
            : { sessionId: s.id, date: s.startedAt, sets: e.sets, note: s.note },
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

/** The most recent finished session with a day (that day, if given), in replay order. */
function lastFinished(sessions: Session[], dayId?: string): Session | undefined {
  return sessions
    .filter((s) => s.finishedAt && s.dayId && (dayId === undefined || s.dayId === dayId))
    .reduce<Session | undefined>((last, s) => (!last || cameBefore(last, s) ? s : last), undefined)
}

/** The day of the most recent finished session, which drives the rotation (SPEC §5.1). */
export function lastLoggedDayId(sessions: Session[]): string | undefined {
  return lastFinished(sessions)?.dayId
}

/**
 * "Last time: …" for a training day (SPEC §9.2, slice 3): the note of that day's most recent
 * finished session, if it has one. Older sessions aren't searched.
 */
export function lastNoteFor(sessions: Session[], dayId: string): string | undefined {
  return lastFinished(sessions, dayId)?.note
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
