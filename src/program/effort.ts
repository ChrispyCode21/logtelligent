// How effort is entered and shown (SPEC §5.6). Every scale is stored as an RPE number,
// so the engine and the logged sets are the same whichever scale the program uses.

export type EffortScale = 'rpe' | 'repsLeft' | 'perceived'

export interface EffortOption {
  rpe: number
  label: string
}

/** RPE is entered in half steps from 6 to 10 (SPEC §6.3). */
export const RPE_SCALE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const

interface ScaleInfo {
  name: string
  /** What the scale asks, shown above its buttons. */
  question: string
  /** One line describing the scale, for choosing between them. */
  description: string
  /** Lightest effort first. */
  options: EffortOption[]
}

export const EFFORT_SCALES: Record<EffortScale, ScaleInfo> = {
  rpe: {
    name: 'RPE',
    question: 'RPE',
    description: 'Rate of perceived exertion, 6 to 10 in half steps.',
    options: RPE_SCALE.map((rpe) => ({ rpe, label: String(rpe) })),
  },
  repsLeft: {
    name: 'Reps left',
    question: 'How many more reps could you have done?',
    description: 'How many more reps you could have done: 0 to 4+.',
    options: [
      { rpe: 6, label: '4+' },
      { rpe: 7, label: '3' },
      { rpe: 8, label: '2' },
      { rpe: 9, label: '1' },
      { rpe: 10, label: '0' },
    ],
  },
  perceived: {
    name: 'Perceived effort',
    question: 'How hard was it?',
    description: 'From Easy to Failed on the last rep.',
    options: [
      { rpe: 6, label: 'Easy' },
      { rpe: 7, label: 'Moderate' },
      { rpe: 8, label: 'Challenging' },
      { rpe: 9, label: 'Very hard' },
      { rpe: 10, label: 'Failed on the last rep' },
    ],
  },
}

export const EFFORT_SCALE_IDS = Object.keys(EFFORT_SCALES) as EffortScale[]

/** Programs saved before effort scales existed used RPE; a new program starts on Reps left. */
export const LEGACY_EFFORT_SCALE: EffortScale = 'rpe'
export const DEFAULT_EFFORT_SCALE: EffortScale = 'repsLeft'

/** The option for a stored RPE: an exact match, else the nearest, rounding toward harder on a tie. */
export function nearestOption(scale: EffortScale, rpe: number): EffortOption {
  let best = EFFORT_SCALES[scale].options[0]
  for (const option of EFFORT_SCALES[scale].options) {
    // Options run lightest first, so `<=` lets a harder option win a tie.
    if (Math.abs(option.rpe - rpe) <= Math.abs(best.rpe - rpe)) best = option
  }
  return best
}

/** A set's effort as shown after its weight and reps: `@ 8`, `· 2 left` or `· Challenging`. */
export function effortSuffix(scale: EffortScale, rpe: number): string {
  if (scale === 'rpe') return `@ ${rpe}`
  const { label } = nearestOption(scale, rpe)
  return scale === 'repsLeft' ? `· ${label} left` : `· ${label}`
}

/**
 * A first-set target, to append directly after what it describes ("first set", "3 × 3–5"):
 * ` @ RPE 8`, ` with 2 reps left` or `: Challenging`.
 */
export function effortTarget(scale: EffortScale, rpe: number): string {
  if (scale === 'rpe') return ` @ RPE ${rpe}`
  const { label } = nearestOption(scale, rpe)
  return scale === 'repsLeft' ? ` with ${label} ${label === '1' ? 'rep' : 'reps'} left` : `: ${label}`
}
