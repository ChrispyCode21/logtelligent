import { EFFORT_SCALES, nearestOption, type EffortScale } from '../program/effort'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'

interface Props {
  scale: EffortScale
  /** Stored as RPE whatever the scale (SPEC §9.1, slice 1). */
  value: number | undefined
  onChange: (rpe: number) => void
}

/**
 * Effort for a primary lift's first set, asked in the program's effort scale. It's only asked
 * where it's required, so a picked value can be changed but not cleared (SPEC §6.3, §9.3).
 */
export function EffortPicker({ scale, value, onChange }: Props) {
  const { question, options } = EFFORT_SCALES[scale]
  // A stored value between this scale's buttons shows as the nearest one (e.g. 8.5 in Reps left).
  const selected = value === undefined ? undefined : nearestOption(scale, value).rpe
  return (
    <Field as="fieldset" label={`${question} (required)`}>
      <div className={`effort-buttons ${scale}`}>
        {options.map(({ rpe, label }) => (
          <Button key={rpe} aria-pressed={selected === rpe} onClick={() => onChange(rpe)}>
            {label}
          </Button>
        ))}
      </div>
    </Field>
  )
}
