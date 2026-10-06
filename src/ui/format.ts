// Display formatting shared by the UI. All weights are in pounds.
import { countedSets, type EquipmentType, type LoggedSet, type RepRange, type Tier } from '../engine'
import { effortSuffix, effortTarget, type EffortScale } from '../program/effort'

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
}

export const TIER_LABELS: Record<Tier, string> = { primary: 'Primary', accessory: 'Accessory' }

interface Prescription {
  tier: Tier
  sets: number
  repRange: RepRange
  unilateral: boolean
  equipment: EquipmentType
  targetRpe?: number
}

/**
 * What an exercise asks for: `Primary · 3 × 5–7 · Barbell`, `Accessory · 3 × 10–12 per side · Dumbbell`.
 * With a scale, a primary also shows its first-set effort target: `Primary · 3 × 5–7 @ RPE 8 · Barbell`.
 */
export function formatPrescription(e: Prescription, scale?: EffortScale) {
  const target =
    scale && e.tier === 'primary' && e.targetRpe !== undefined ? effortTarget(scale, e.targetRpe) : ''
  const reps = `${e.sets} × ${e.repRange.min}–${e.repRange.max}${e.unilateral ? ' per side' : ''}${target}`
  return `${TIER_LABELS[e.tier]} · ${reps} · ${EQUIPMENT_LABELS[e.equipment]}`
}

/** `225 × 4 @ 8` (`225 × 4 · 2 left`, `225 × 4 · Challenging` in other scales), or `225 × 4` without effort. */
export const formatSet = (set: LoggedSet, scale: EffortScale = 'rpe') =>
  `${set.weight} × ${set.reps}${set.rpe !== undefined ? ` ${effortSuffix(scale, set.rpe)}` : ''}`

/**
 * An exercise's set count: `2 of 3 sets`, `3 of 3 sets + 1 extra`. Without a target (a past session,
 * whose prescription isn't stored): `3 sets`, `1 set + 2 extras` (SPEC §9.2, slices 1 and 2).
 */
export function formatSetCount(sets: LoggedSet[], target?: number) {
  const counted = countedSets(sets).length
  const extras = sets.length - counted
  const base =
    target === undefined ? `${counted} set${counted === 1 ? '' : 's'}` : `${counted} of ${target} sets`
  return extras > 0 ? `${base} + ${extras} extra${extras === 1 ? '' : 's'}` : base
}

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
