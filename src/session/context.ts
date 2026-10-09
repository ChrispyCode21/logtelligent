import { suggestNext, type ExerciseConfig, type Suggestion } from '../engine'
import { otherLiftSessions } from '../history/lifts'
import { exerciseHistory, type LoggedExerciseSession } from '../history/sessions'
import { findExercise } from '../program/program'
import type { Program } from '../program/types'
import { prescribedConfig } from './prescription'
import type { ExerciseLog, Session } from './types'

export interface SessionExercise {
  log: ExerciseLog
  config: ExerciseConfig
  /** The finished history this session is judged against. */
  history: LoggedExerciseSession[]
  suggestion: Suggestion
}

/**
 * Each exercise in a session, with what it's judged against. A live session uses all finished
 * history and today's suggestion. A finished one uses only the history before it, and the
 * suggestion as of when it started, so editing it recomputes it as it was (SPEC §9.2, slice 1).
 * A finished one is judged by its saved prescription, if it has one (SPEC §9.4 slice 1).
 * Exercises no longer in the program are left out. `now` matters only for a live session; App
 * captures it in its query so renders stay pure.
 */
export function sessionExercises(
  session: Session,
  program: Program,
  sessions: Session[],
  now?: Date,
): SessionExercise[] {
  const finished = session.finishedAt !== undefined
  const asOf = finished ? new Date(session.startedAt) : (now ?? new Date())
  return session.exercises.flatMap((log) => {
    const current = findExercise(program, log.exerciseId)
    if (!current) return []
    const config = finished ? prescribedConfig(current, log) : current
    // Earlier sessions with no saved range are judged by today's range, as everywhere else, not
    // by the one this session saved (the engine falls back to the config it's given).
    const history = exerciseHistory(sessions, config.id, finished ? session : undefined).map((h) =>
      h.repRange ? h : { ...h, repRange: current.repRange },
    )
    // The lift's other exercises share the e1RM (SPEC §9.4 slice 2).
    const lift = otherLiftSessions(program, sessions, current, finished ? session : undefined)
    return [{ log, config, history, suggestion: suggestNext(config, history, asOf, lift) }]
  })
}
