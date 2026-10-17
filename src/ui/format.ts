// Display formatting shared by the UI. All weights are in pounds.
import {
  countedSets,
  type EquipmentType,
  type LoggedSet,
  type PlanKind,
  type RepRange,
  type AdaptiveSuggestion,
  type LinearReason,
  type SchemeId,
  type SchemeSetting,
  type Tier,
} from '../engine'
import { effortSuffix, effortTarget, type EffortScale } from '../program/effort'

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
}

export const TIER_LABELS: Record<Tier, string> = { primary: 'Primary', accessory: 'Accessory' }

export const SCHEME_LABELS: Record<SchemeId, string> = { adaptive: 'Adaptive', linear: 'Linear' }

interface Prescription {
  tier: Tier
  sets: number
  repRange: RepRange
  unilateral: boolean
  equipment: EquipmentType
  targetRpe?: number
  progression?: SchemeSetting
}

/** A rep range, `5–7`, or one number when its ends are equal: `5` (SPEC §5.1). */
export const formatRepRange = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`)

/**
 * What an exercise asks for: `Primary · 3 × 5–7 · Barbell`, `Accessory · 3 × 10–12 per side · Dumbbell`,
 * `Primary · Linear +5 lb · 3 × 5 · Barbell`. With a scale, an Adaptive primary also shows its first-set
 * effort target: `Primary · 3 × 5–7 @ RPE 8 · Barbell` (SPEC §5.1).
 */
export function formatPrescription(e: Prescription, scale?: EffortScale) {
  const target =
    scale && e.tier === 'primary' && !e.progression && e.targetRpe !== undefined
      ? effortTarget(scale, e.targetRpe)
      : ''
  const range = formatRepRange(e.repRange.min, e.repRange.max)
  const reps = `${e.sets} × ${range}${e.unilateral ? ' per side' : ''}${target}`
  const scheme = e.progression
    ? ` · ${SCHEME_LABELS[e.progression.scheme]} +${e.progression.increment} lb`
    : ''
  return `${TIER_LABELS[e.tier]}${scheme} · ${reps} · ${EQUIPMENT_LABELS[e.equipment]}`
}

/** `225 × 4 @ 8` (`225 × 4 · 2 left`, `225 × 4 · Challenging` in other scales), or `225 × 4` without effort. */
export const formatSet = (set: LoggedSet, scale: EffortScale = 'rpe') =>
  `${set.weight} × ${set.reps}${set.rpe !== undefined ? ` ${effortSuffix(scale, set.rpe)}` : ''}`

/**
 * An exercise's set count: `2 of 3 sets`, `3 of 3 sets + 1 extra`. Without a target (a past session,
 * whose prescription isn't stored): `3 sets`, `1 set + 2 extras` (SPEC §5.2, §5.4).
 */
export function formatSetCount(sets: LoggedSet[], target?: number) {
  const counted = countedSets(sets).length
  const extras = sets.length - counted
  const base =
    target === undefined ? `${counted} set${counted === 1 ? '' : 's'}` : `${counted} of ${target} sets`
  return extras > 0 ? `${base} + ${extras} extra${extras === 1 ? '' : 's'}` : base
}

/** Names as a short list: "A", "A and B", "A, B and C", or "A, B, C and 4 more". */
export function formatNameList(names: string[], max = 3): string {
  if (names.length <= 1) return names.join('')
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

/** The prescribed sets on one line, leaving extras out: `225 × 5 @ 8 · 225 × 4`. */
export const formatCountedSets = (sets: LoggedSet[], scale: EffortScale = 'rpe') =>
  formatSets(countedSets(sets), scale)

/** Extra sets on their own line, `Extra: 185 × 8 · 185 × 7`, or undefined without any (SPEC §5.2). */
export function formatExtras(sets: LoggedSet[]): string | undefined {
  const extras = sets.filter((s) => s.extra)
  return extras.length > 0 ? `Extra: ${formatSets(extras)}` : undefined
}

/** All of an exercise's sets on one line, extras last and tagged: `225 × 5 @ 8 · 225 × 4 · Extra: 185 × 8`. */
export const formatSetsWithExtras = (sets: LoggedSet[], scale: EffortScale = 'rpe') =>
  [formatCountedSets(sets, scale), formatExtras(sets)].filter(Boolean).join(' · ')

/** Sets on one line: `225 × 4 @ 8 · 225 × 4 · 225 × 3`. */
export const formatSets = (sets: LoggedSet[], scale: EffortScale = 'rpe') =>
  sets.map((set) => formatSet(set, scale)).join(' · ')

/** Bodyweight loads are added weight (SPEC §6.1): `Bodyweight`, `BW + 10 lb`; otherwise `225 lb`. */
export function formatWeight(weight: number, equipment?: EquipmentType) {
  if (equipment === 'bodyweight') return weight === 0 ? 'Bodyweight' : `BW + ${weight} lb`
  return `${weight} lb`
}

/** An estimated 1RM to one decimal: `271.1 lb`. */
export const formatE1rm = (value: number) => `${value.toFixed(1)} lb`

/** The break note from the share of the e1RM kept (SPEC §6.4): 0.85 → `estimate lowered 15%`. */
export const formatBreakNote = (factor: number) =>
  `Returning from a break: estimate lowered ${Math.round((1 - factor) * 100)}%.`

const PLAN_NOTES: Record<PlanKind, string | null> = {
  normal: null,
  revert: 'Last session missed the minimums, so the weight is back to your last successful numbers.',
  retry: 'Retrying the numbers that failed. Hitting them clears the fatigue stack.',
  deload: 'Deload week: fewer sets and less effort. Missing the minimums here does not count.',
  resume: 'Deload done: back to your last successful numbers.',
}

const LIGHTEST_LOAD_NOTE =
  "You're at the lightest load and still missing the minimums. Check this exercise's starting numbers, or add lighter loads."

/**
 * The suggestion card's note on its plan (SPEC §6.6–6.7). Numbers never lifted are never called
 * successful: a revert to them says the weight dropped, that it couldn't, or nothing when it stays
 * the weight that failed. Primary lifts come back from a deload on the e1RM rule, the only rule
 * that predicts reps.
 */
export function formatPlanNote(
  suggestion: Pick<
    AdaptiveSuggestion,
    'plan' | 'unlifted' | 'steppedDown' | 'atLightestLoad' | 'predictedReps'
  >,
): string | null {
  if (suggestion.plan === 'revert' && suggestion.unlifted) {
    if (suggestion.atLightestLoad) return LIGHTEST_LOAD_NOTE
    return suggestion.steppedDown ? 'Weight lowered one step.' : null
  }
  if (suggestion.plan === 'resume' && suggestion.predictedReps !== undefined)
    return 'Deload done: weight picked from your estimated 1RM.'
  if (suggestion.plan === 'resume' && suggestion.unlifted) return 'Resuming after the deload.'
  return PLAN_NOTES[suggestion.plan]
}

/** Linear's reason line (SPEC §6.10); a fresh start shows none. */
export function formatLinearReason(reason: LinearReason): string | null {
  switch (reason.kind) {
    case 'start':
      return null
    case 'increase':
      return `+${reason.increment} lb`
    case 'topOfLoads':
      return 'Top of the loads: +1 rep'
    case 'repeat':
      return 'Repeat: reps missed last time'
    case 'reset':
      return 'Reset: missed 3 times in a row'
    case 'break':
      return 'Returning from a break: weight lowered 10%.'
  }
}

const DATE_STYLES = {
  /** Sat, Oct 4, 2026 */
  long: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
  /** Oct 4 */
  short: { month: 'short', day: 'numeric' },
  /** 10/4/2026 */
  numeric: {},
} satisfies Record<string, Intl.DateTimeFormatOptions>

/** A date in the device's locale. */
export const formatDate = (iso: string, style: keyof typeof DATE_STYLES = 'long') =>
  new Date(iso).toLocaleDateString(undefined, DATE_STYLES[style])
