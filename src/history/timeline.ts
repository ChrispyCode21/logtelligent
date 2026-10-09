import { deriveState, sessionE1rm, type ExerciseConfig, type LoggedSet } from '../engine'
import { liftExercises } from '../program/lifts'
import type { Program } from '../program/types'
import type { Session, Substitute } from '../session/types'
import { exerciseHistory, type LoggedExerciseSession } from './sessions'

export interface TimelineEntry {
  sessionId: number
  /** Which exercise of the lift this was (SPEC §6.9). */
  exerciseId: string
  date: string
  sets: LoggedSet[]
  isDeload: boolean
  /** Set when the exercise was replaced that session; no e1RM then (SPEC §5.2). */
  substitute?: Substitute
  /** The session's note for next time (SPEC §5.2). */
  note?: string
  /** That session's e1RM (SPEC §5.3): primary lifts only, none for deloads or replaced sessions. */
  e1rm?: number
  /** Over 10 effective reps: counted toward the running e1RM only when nothing lower is (SPEC §6.4). */
  highReps?: boolean
  unilateral: boolean
  /** The day it was logged on, in a lift's timeline (SPEC §6.9). */
  dayName?: string
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
        highReps: e1rm !== undefined && !!s.highReps,
        unilateral: config.unilateral,
      }
    })
    .reverse()
}

/**
 * A lift's finished sessions on every day, newest first (SPEC §5.3, §6.9). Each exercise is
 * replayed on its own, so deloads and stacks stay per exercise.
 */
export function liftTimeline(program: Program, sessions: Session[], name: string): TimelineEntry[] {
  const dayNames = new Map(program.days.map((d) => [d.id, d.name]))
  const dayOf = new Map(sessions.map((s) => [s.id, s.dayId && dayNames.get(s.dayId)]))
  return liftExercises(program, name)
    .flatMap((e) => exerciseTimeline(e, exerciseHistory(sessions, e.id)))
    .map((entry) => ({ ...entry, dayName: dayOf.get(entry.sessionId) }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.sessionId - a.sessionId)
}
