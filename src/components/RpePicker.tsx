// Half steps from 6 to 10 (SPEC §6.3).
const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

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
        {RPE_VALUES.map((rpe) => (
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
