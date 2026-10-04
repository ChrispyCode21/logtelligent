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
