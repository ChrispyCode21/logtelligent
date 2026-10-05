import { EFFORT_SCALES, nearestOption, type EffortScale } from '../program/effort'
import { Button } from '../ui/Button'

interface Props {
  scale: EffortScale
  /** Stored as RPE whatever the scale (SPEC §9.1, slice 1). */
  value: number | undefined
  required: boolean
  onChange: (rpe: number | undefined) => void
}

/** Effort for a set, asked in the program's effort scale. */
export function EffortPicker({ scale, value, required, onChange }: Props) {
  const { question, options } = EFFORT_SCALES[scale]
  // A stored value between this scale's buttons shows as the nearest one (e.g. 8.5 in Reps left).
  const selected = value === undefined ? undefined : nearestOption(scale, value).rpe
  return (
    <fieldset className="effort">
      <legend>
        {question} {required ? '(required on set 1)' : '(optional)'}
      </legend>
      <div className={`effort-buttons ${scale}`}>
        {options.map(({ rpe, label }) => (
          <Button
            key={rpe}
            aria-pressed={selected === rpe}
            // Tapping the selected value clears it, unless effort is required.
            onClick={() => onChange(selected === rpe && !required ? undefined : rpe)}
          >
            {label}
          </Button>
        ))}
      </div>
    </fieldset>
  )
}
