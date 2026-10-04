import type { ExerciseConfig, PlanKind, Suggestion } from '../engine'

const BASIS_NOTES = {
  history: null,
  seed: 'Based on your starting numbers.',
  returningFromBreak: 'Returning from a break: estimate lowered 10%.',
}

const PLAN_NOTES: Record<PlanKind, string | null> = {
  normal: null,
  revert: 'Last session missed the minimums, so the weight is back to your last successful numbers.',
  retry: 'Retrying the numbers that failed. Hitting them clears the fatigue stack.',
  deload: 'Deload week: fewer sets and less effort. Missing the minimums here does not count.',
  resume: 'Deload done: back to your last successful numbers.',
}

interface Props {
  config: ExerciseConfig
  suggestion: Suggestion
  heading: string
}

export function SuggestionCard({ config, suggestion, heading }: Props) {
  if (suggestion.kind === 'needsSeed') {
    return (
      <section className="card">
        <h2>{heading}</h2>
        <p>{config.name} needs starting numbers before you can start a session.</p>
      </section>
    )
  }

  const basisNote = suggestion.e1rm && suggestion.plan === 'normal' && BASIS_NOTES[suggestion.e1rm.basis]
  const planNote = PLAN_NOTES[suggestion.plan]
  const { min } = config.repRange
  const max = suggestion.effectiveTop ?? config.repRange.max
  const weight =
    config.equipment === 'bodyweight'
      ? suggestion.weight === 0
        ? 'Bodyweight'
        : `BW + ${suggestion.weight} lb`
      : `${suggestion.weight} lb`

  return (
    <section className="card">
      <h2>
        {heading}
        {suggestion.plan === 'deload' && <span className="tag">Deload</span>}
      </h2>
      <p className="suggestion">
        {weight} × {suggestion.reps}
      </p>
      <p className="muted">
        {config.equipment === 'dumbbell' && 'Per hand · '}
        {suggestion.sets} sets · {min}–{max} reps
        {config.unilateral && ' per side'}
        {suggestion.targetRpe !== undefined && <> · first set @ RPE {suggestion.targetRpe}</>}
      </p>
      {suggestion.e1rm && (
        <p className="muted">Estimated 1RM {suggestion.e1rm.value.toFixed(1)} lb</p>
      )}
      {suggestion.stacks > 0 && <p className="muted">Fatigue stacks: {suggestion.stacks} of 2</p>}
      {planNote && <p className="note">{planNote}</p>}
      {basisNote && <p className="note">{basisNote}</p>}
    </section>
  )
}
