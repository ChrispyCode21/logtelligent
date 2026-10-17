import { EFFORT_SCALES, nearestOption, type EffortScale } from '../program/effort'
import { Field } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'

interface Props {
  scale: EffortScale
  /** Stored as RPE whatever the scale (SPEC §5.6). */
  value: number | undefined
  /** Optional effort (Linear, SPEC §6.10) can be cleared by tapping the picked button again. */
  required: boolean
  onChange: (rpe: number | undefined) => void
}

/**
 * Effort for a primary lift's first set, asked in the program's effort scale. Where it's required,
 * a picked value can be changed but not cleared (SPEC §6.3).
 */
export function EffortPicker({ scale, value, required, onChange }: Props) {
  const { question, options } = EFFORT_SCALES[scale]
  // A stored value between this scale's buttons shows as the nearest one (e.g. 8.5 in Reps left).
  const selected = value === undefined ? undefined : nearestOption(scale, value).rpe
  return (
    <Field as="fieldset" label={`${question} (${required ? 'required' : 'optional'})`}>
      <SegmentedControl
        className={`effort-buttons ${scale}`}
        options={options.map(({ rpe, label }) => ({ value: rpe, label }))}
        value={selected}
        onChange={(rpe) => onChange(!required && rpe === selected ? undefined : rpe)}
      />
    </Field>
  )
}
