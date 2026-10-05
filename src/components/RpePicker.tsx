import { RPE_SCALE } from '../ui/rpe'

interface Props {
  value: number | undefined
  required: boolean
  onChange: (rpe: number | undefined) => void
}

export function RpePicker({ value, required, onChange }: Props) {
  return (
    <fieldset className="rpe">
      <legend>RPE {required ? '(required on set 1)' : '(optional)'}</legend>
      <div className="rpe-buttons">
        {RPE_SCALE.map((rpe) => (
          <button
            key={rpe}
            type="button"
            aria-pressed={value === rpe}
            // Tapping the selected value clears it, unless RPE is required.
            onClick={() => onChange(value === rpe && !required ? undefined : rpe)}
          >
            {rpe}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
