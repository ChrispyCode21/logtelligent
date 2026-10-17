import { evaluateLinear, replayLinear, suggestLinear } from './linear'
import { deriveState, evaluateSession } from './progression'
import { suggestNext } from './suggest'
import type {
  ExerciseConfig,
  ExerciseSession,
  LoggedSet,
  SchemeId,
  SessionOutcome,
  Suggestion,
} from './types'

/**
 * A progression scheme (SPEC §8): how an exercise's finished history becomes its next session.
 * Each replays `history` under its own rules; nothing about its state is stored. `lift` holds the
 * other same-named exercises' sessions (SPEC §6.9), so a scheme can replay across exercises.
 */
export interface ProgressionScheme {
  suggest(config: ExerciseConfig, history: ExerciseSession[], asOf: Date, lift: ExerciseSession[]): Suggestion
  /** Judge a session on `date` (when it started) after `history`, as the replay will judge it. */
  evaluate(config: ExerciseConfig, history: ExerciseSession[], sets: LoggedSet[], date: Date): SessionOutcome
  /** The history with each session marked as a deload or not, for History's deload marking (SPEC §8). */
  replay<S extends ExerciseSession>(config: ExerciseConfig, history: S[]): S[]
}

/** Today's progression (SPEC §6.3–6.7): e1RM for primaries, double progression for accessories. */
export const adaptive: ProgressionScheme = {
  suggest: suggestNext,
  // Adaptive judges a session the same whatever its date, so it takes none.
  evaluate: evaluateSession,
  replay: (config, history) => deriveState(config, history).sessions,
}

/** A fixed increase each successful session (SPEC §6.10). */
export const linear: ProgressionScheme = {
  suggest: suggestLinear,
  evaluate: evaluateLinear,
  replay: replayLinear,
}

/** The name of the scheme a program exercise uses. */
export const schemeId = (config: Pick<ExerciseConfig, 'progression'>): SchemeId =>
  config.progression?.scheme ?? 'adaptive'

/** The scheme a program exercise uses: Adaptive unless it sets another (SPEC §6). */
export function schemeFor(config: ExerciseConfig): ProgressionScheme {
  return config.progression?.scheme === 'linear' ? linear : adaptive
}
