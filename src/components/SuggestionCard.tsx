import type { ExerciseConfig, RunningE1rm, Suggestion } from '../engine'
import { effortTarget, type EffortScale } from '../program/effort'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { formatBreakNote, formatE1rm, formatLinearReason, formatPlanNote, formatWeight } from '../ui/format'

function e1rmNote(e1rm: RunningE1rm) {
  if (e1rm.basis === 'seed') return 'Based on your starting numbers.'
  if (e1rm.basis === 'returningFromBreak') return formatBreakNote(e1rm.breakFactor)
  return null
}

interface Props {
  config: ExerciseConfig
  suggestion: Suggestion
  heading: string
  effortScale: EffortScale
  /** Opens this exercise's form on the Program tab. */
  onEditExercise: () => void
}

export function SuggestionCard({ config, suggestion, heading, effortScale, onEditExercise }: Props) {
  if (suggestion.kind === 'needsSeed') {
    return (
      <Card>
        <h2>{heading}</h2>
        <p>{config.name} needs starting numbers before you can start a session.</p>
      </Card>
    )
  }

  if (suggestion.scheme === 'linear') {
    const reason = formatLinearReason(suggestion.reason)
    return (
      <Card>
        <h2>{heading}</h2>
        <p className="suggestion">
          {formatWeight(suggestion.weight, config.equipment)} × {suggestion.reps}
        </p>
        <p className="muted">
          {config.equipment === 'dumbbell' && 'Per hand · '}
          {suggestion.sets} sets · {suggestion.reps} reps
          {config.unilateral && ' per side'}
        </p>
        {reason && <p className="note">{reason}</p>}
      </Card>
    )
  }

  // Only the e1RM rule predicts reps (SPEC §6.4).
  const onE1rmRule = suggestion.predictedReps !== undefined
  const basisNote = suggestion.e1rm && onE1rmRule && e1rmNote(suggestion.e1rm)
  const planNote = formatPlanNote(suggestion)
  const { min } = config.repRange
  const max = suggestion.effectiveTop ?? config.repRange.max

  return (
    <Card>
      <h2>
        {heading}
        {suggestion.plan === 'deload' && <span className="tag">Deload</span>}
      </h2>
      <p className="suggestion">
        {formatWeight(suggestion.weight, config.equipment)} × {suggestion.reps}
      </p>
      <p className="muted">
        {config.equipment === 'dumbbell' && 'Per hand · '}
        {suggestion.sets} sets · {min}–{max} reps
        {config.unilateral && ' per side'}
        {suggestion.targetRpe !== undefined && (
          <> · first set{effortTarget(effortScale, suggestion.targetRpe)}</>
        )}
      </p>
      {suggestion.e1rm && <p className="muted">Estimated 1RM {formatE1rm(suggestion.e1rm.value)}</p>}
      {suggestion.stacks > 0 && <p className="muted">Fatigue stacks: {suggestion.stacks} of 2</p>}
      {planNote && <p className="note">{planNote}</p>}
      {/* Failing at the lightest load points to the exercise's starting numbers and loads (SPEC §6.6). */}
      {suggestion.atLightestLoad && (
        <div className="actions">
          <Button onClick={onEditExercise}>Edit exercise</Button>
        </div>
      )}
      {basisNote && <p className="note">{basisNote}</p>}
    </Card>
  )
}
