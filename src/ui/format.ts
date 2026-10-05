// Display formatting shared by the UI. All weights are in pounds.
import type { EquipmentType, LoggedSet } from '../engine'

/** `225 × 4 @ 8`, or `225 × 4` without an RPE. */
export const formatSet = (set: LoggedSet) =>
  `${set.weight} × ${set.reps}${set.rpe !== undefined ? ` @ ${set.rpe}` : ''}`

/** Sets on one line: `225 × 4 @ 8 · 225 × 4 · 225 × 3`. */
export const formatSets = (sets: LoggedSet[]) => sets.map(formatSet).join(' · ')

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
