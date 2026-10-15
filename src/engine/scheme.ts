import { evaluateSession } from './progression'
import { suggestNext } from './suggest'
import type { ExerciseConfig, ExerciseSession, LoggedSet, SessionOutcome, Suggestion } from './types'

/**
 * A progression scheme (SPEC §8): how an exercise's finished history becomes its next session.
 * Each replays `history` under its own rules; nothing about its state is stored. `lift` holds the
 * other same-named exercises' sessions (SPEC §6.9), so a scheme can replay across exercises.
 */
export interface ProgressionScheme {
  suggest(
    config: ExerciseConfig,
    history: ExerciseSession[],
    asOf: Date,
    lift?: ExerciseSession[],
  ): Suggestion
  evaluate(config: ExerciseConfig, history: ExerciseSession[], sets: LoggedSet[]): SessionOutcome
}

/** Today's progression (SPEC §6.3–6.7): e1RM for primaries, double progression for accessories. */
export const adaptive: ProgressionScheme = { suggest: suggestNext, evaluate: evaluateSession }

/** The scheme a program exercise uses: Adaptive for all, until a scheme can be chosen. */
export function schemeFor(_config: ExerciseConfig): ProgressionScheme {
  return adaptive
}
