import { deriveState, sessionE1rm, type ExerciseConfig, type LoggedSet } from '../engine'
import type { Substitute } from '../session/types'
import type { LoggedExerciseSession } from './sessions'

export interface TimelineEntry {
  sessionId: number
  date: string
  sets: LoggedSet[]
  isDeload: boolean
  /** Set when the exercise was replaced that session; no e1RM then (SPEC §5.2). */
  substitute?: Substitute
  /** That session's e1RM (SPEC §5.3): primary lifts only, none for deloads or replaced sessions. */
  e1rm?: number
}

/** An exercise's finished sessions for the history view, newest first. */
export function exerciseTimeline(config: ExerciseConfig, history: LoggedExerciseSession[]): TimelineEntry[] {
  return deriveState(config, history)
    .sessions.map((s) => ({
      sessionId: s.sessionId,
      date: s.date,
      sets: s.sets,
      isDeload: !!s.isDeload,
      substitute: s.substitute,
      e1rm: config.tier === 'primary' && !s.isDeload && !s.replaced ? sessionE1rm(s) : undefined,
    }))
    .reverse()
}
