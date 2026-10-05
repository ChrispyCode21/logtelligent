import { suggestNext, type ExerciseConfig, type Suggestion } from '../engine'
import { exerciseHistory, type LoggedExerciseSession } from '../history/sessions'
import { findExercise } from '../program/program'
import type { Program } from '../program/types'
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
 * Exercises no longer in the program are left out.
 */
export function sessionExercises(
  session: Session,
  program: Program,
  sessions: Session[],
  now: Date,
): SessionExercise[] {
  const finished = session.finishedAt !== undefined
  const asOf = finished ? new Date(session.startedAt) : now
  return session.exercises.flatMap((log) => {
    const config = findExercise(program, log.exerciseId)
    if (!config) return []
    const history = exerciseHistory(sessions, config.id, finished ? session : undefined)
    return [{ log, config, history, suggestion: suggestNext(config, history, asOf) }]
  })
}
