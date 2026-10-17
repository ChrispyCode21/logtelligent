import type { Tier } from '../engine'
import { Field } from '../ui/Field'

interface Props {
  tier: Tier
  /** A weight × reps (an Adaptive primary), else a weight only (`seedHasReps`, SPEC §5.1). */
  withReps: boolean
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
 * Starting numbers (SPEC §5.1): a primary's weight × reps, an accessory's weight for the bottom of
 * its range, or a Linear primary's first weight. Shared by the exercise form and the seed
 * walkthrough; each keeps its own state.
 */
export function SeedFields({
  tier,
  withReps,
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
  const weightInput = (
    <input
      inputMode="decimal"
      value={weight}
      placeholder={weightPlaceholder}
      onChange={(e) => onWeight(e.target.value)}
    />
  )
  if (!withReps && tier === 'primary') {
    return (
      <Field label="Starting weight (lb)" hint="Your first session's weight." className={className}>
        {weightInput}
      </Field>
    )
  }
  return (
    <Field
      as="fieldset"
      label="Starting numbers"
      hint={withReps && "Enter a weight and reps you're confident you could do: hard, but you wouldn't fail."}
      className={className}
    >
      {withReps ? (
        <div className="row">
          <Field label="Weight (lb)">{weightInput}</Field>
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
          {weightInput}
        </Field>
      )}
    </Field>
  )
}
