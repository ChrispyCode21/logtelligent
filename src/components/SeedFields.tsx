import type { Tier } from '../engine'
import { Field } from '../ui/Field'

interface Props {
  tier: Tier
  /** For the accessory question: the exercise's name and the bottom of its rep range, as far as known. */
  name: string
  minReps: string
  unilateral: boolean
  weight: string
  reps: string
  weightPlaceholder?: string
  onWeight: (weight: string) => void
  onReps: (reps: string) => void
  className?: string
}

/**
 * Starting numbers (SPEC §5.1): a primary's weight × reps, or an accessory's weight for the bottom
 * of its range. Shared by the exercise form and the seed walkthrough; each keeps its own state.
 */
export function SeedFields({
  tier,
  name,
  minReps,
  unilateral,
  weight,
  reps,
  weightPlaceholder,
  onWeight,
  onReps,
  className,
}: Props) {
  const primary = tier === 'primary'
  return (
    <Field
      as="fieldset"
      label="Starting numbers"
      hint={primary && "Enter a weight and reps you're confident you could do: hard, but you wouldn't fail."}
      className={className}
    >
      {primary ? (
        <div className="row">
          <Field label="Weight (lb)">
            <input
              inputMode="decimal"
              value={weight}
              placeholder={weightPlaceholder}
              onChange={(e) => onWeight(e.target.value)}
            />
          </Field>
          <Field label="Reps">
            <input inputMode="numeric" value={reps} onChange={(e) => onReps(e.target.value)} />
          </Field>
        </div>
      ) : (
        <Field
          label={
            <span className="muted">
              What&apos;s a weight you can do {minReps || 'the bottom of the range'}{' '}
              {unilateral ? 'reps (per side)' : 'reps'} of {name.trim() || 'this exercise'} with that would be
              hard, but achievable?
            </span>
          }
        >
          <input
            inputMode="decimal"
            value={weight}
            placeholder={weightPlaceholder}
            onChange={(e) => onWeight(e.target.value)}
          />
        </Field>
      )}
    </Field>
  )
}
