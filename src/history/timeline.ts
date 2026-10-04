import { deriveState, sessionE1rm, type ExerciseConfig, type ExerciseSession, type LoggedSet } from '../engine'

export interface TimelineEntry {
  date: string
  sets: LoggedSet[]
  isDeload: boolean
  /** That session's e1RM (SPEC §5.3): primary lifts only, none for deloads. */
  e1rm?: number
}

/** An exercise's finished sessions for the history view, newest first. */
export function exerciseTimeline(config: ExerciseConfig, history: ExerciseSession[]): TimelineEntry[] {
  return deriveState(config, history)
    .sessions.filter((s) => s.sets.length > 0)
    .map((s) => ({
      date: s.date,
      sets: s.sets,
      isDeload: !!s.isDeload,
      e1rm: config.tier === 'primary' && !s.isDeload ? sessionE1rm(s) : undefined,
    }))
    .reverse()
}
