import type { ExerciseConfig, Suggestion } from '../engine'

const BASIS_NOTES = {
  history: null,
  seed: 'Based on your starting numbers.',
  returningFromBreak: 'Returning from a break: estimate lowered 10%.',
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

  const note = BASIS_NOTES[suggestion.e1rm.basis]
  const { min, max } = config.repRange

  return (
    <section className="card">
      <h2>{heading}</h2>
      <p className="suggestion">
        {suggestion.weight} lb × {suggestion.reps}
      </p>
      <p className="muted">
        {suggestion.sets} sets · {min}–{max} reps · first set @ RPE {suggestion.targetRpe}
      </p>
      <p className="muted">Estimated 1RM {suggestion.e1rm.value.toFixed(1)} lb</p>
      {note && <p className="note">{note}</p>}
    </section>
  )
}
