import {
  deriveState,
  LOW_REP_MAX,
  sessionE1rm,
  sessionEffectiveReps,
  type ExerciseConfig,
  type LoggedSet,
} from '../engine'
import { liftExercises } from '../program/lifts'
import type { Program } from '../program/types'
import type { Session, Substitute } from '../session/types'
import { exerciseHistory, type LoggedExerciseSession } from './sessions'

export interface TimelineEntry {
  sessionId: number
  /** Which exercise of the lift this was (SPEC §9.4 slice 2). */
  exerciseId: string
  date: string
  sets: LoggedSet[]
  isDeload: boolean
  /** Set when the exercise was replaced that session; no e1RM then (SPEC §5.2). */
  substitute?: Substitute
  /** The session's note for next time (SPEC §9.2, slice 3). */
  note?: string
  /** That session's e1RM (SPEC §5.3): primary lifts only, none for deloads or replaced sessions. */
  e1rm?: number
  /** Over 10 effective reps: counted toward the running e1RM only when nothing lower is (SPEC §6.4). */
  highReps?: boolean
  unilateral: boolean
}

/** An exercise's finished sessions for the history view, newest first. */
export function exerciseTimeline(config: ExerciseConfig, history: LoggedExerciseSession[]): TimelineEntry[] {
  return deriveState(config, history)
    .sessions.map((s) => {
      const e1rm = config.tier === 'primary' && !s.isDeload && !s.replaced ? sessionE1rm(s) : undefined
      return {
        sessionId: s.sessionId,
        exerciseId: config.id,
        date: s.date,
        sets: s.sets,
        isDeload: !!s.isDeload,
        substitute: s.substitute,
        note: s.note,
        e1rm,
        highReps: e1rm !== undefined && (sessionEffectiveReps(s) ?? 0) > LOW_REP_MAX,
        unilateral: config.unilateral,
      }
    })
    .reverse()
}

/**
 * A lift's finished sessions on every day, newest first (SPEC §5.3, §9.4 slice 2). Each exercise is
 * replayed on its own, so deloads and stacks stay per exercise.
 */
export function liftTimeline(
  program: Program,
  sessions: Session[],
  name: string,
): (TimelineEntry & { dayName?: string })[] {
  const dayOf = (sessionId: number) => {
    const dayId = sessions.find((s) => s.id === sessionId)?.dayId
    return program.days.find((d) => d.id === dayId)?.name
  }
  return liftExercises(program, name)
    .flatMap((e) => exerciseTimeline(e, exerciseHistory(sessions, e.id)))
    .map((entry) => ({ ...entry, dayName: dayOf(entry.sessionId) }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.sessionId - a.sessionId)
}
