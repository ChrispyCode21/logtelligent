import type { ExerciseConfig, RunningE1rm, Suggestion } from '../engine'
import { effortTarget, type EffortScale } from '../program/effort'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import {
  formatBreakNote,
  formatE1rm,
  formatLinearReason,
  formatPlanNote,
  formatRepRange,
  formatTrainingMax,
  formatWavesReason,
  formatWavesSet,
  formatWavesWeek,
  formatWeight,
} from '../ui/format'

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

  // Waves shows its week, a weight and rep target per set, its training max and its reason (SPEC §6.11).
  if (suggestion.scheme === 'waves') {
    const reason = formatWavesReason(suggestion.reason)
    return (
      <Card>
        {/* The week line marks week 4 as the deload (SPEC §6.11), so the heading has no tag. */}
        <h2>{heading}</h2>
        <p className="muted">{formatWavesWeek(suggestion.week)}</p>
        <ul className="wave-sets">
          {suggestion.setPlan.map((set, i) => (
            <li key={i}>{formatWavesSet(set)}</li>
          ))}
        </ul>
        <p className="muted">
          {config.equipment === 'dumbbell' && 'Per hand · '}
          {formatTrainingMax(suggestion.tm)}
          {config.unilateral && ' · reps per side'}
        </p>
        {reason && <p className="note">{reason}</p>}
      </Card>
    )
  }

  // Linear shows one rep target, its reason and nothing of Adaptive's (SPEC §6.10).
  const adaptive = suggestion.scheme === undefined ? suggestion : undefined
  const { min } = config.repRange
  const max = adaptive?.effectiveTop ?? config.repRange.max
  const repsText = adaptive ? formatRepRange(min, max) : `${suggestion.reps}`
  const note =
    suggestion.scheme === 'linear'
      ? formatLinearReason(suggestion.reason)
      : adaptive && formatPlanNote(adaptive)
  // Only the e1RM rule predicts reps (SPEC §6.4).
  const onE1rmRule = adaptive?.predictedReps !== undefined
  const basisNote = adaptive?.e1rm && onE1rmRule && e1rmNote(adaptive.e1rm)

  return (
    <Card>
      <h2>
        {heading}
        {adaptive?.plan === 'deload' && <span className="tag">Deload</span>}
      </h2>
      <p className="suggestion">
        {formatWeight(suggestion.weight, config.equipment)} × {suggestion.reps}
      </p>
      <p className="muted">
        {config.equipment === 'dumbbell' && 'Per hand · '}
        {suggestion.sets} {suggestion.sets === 1 ? 'set' : 'sets'} · {repsText} reps
        {config.unilateral && ' per side'}
        {adaptive?.targetRpe !== undefined && (
          <> · first set{effortTarget(effortScale, adaptive.targetRpe)}</>
        )}
      </p>
      {adaptive?.e1rm && <p className="muted">Estimated 1RM {formatE1rm(adaptive.e1rm.value)}</p>}
      {adaptive && adaptive.stacks > 0 && <p className="muted">Fatigue stacks: {adaptive.stacks} of 2</p>}
      {note && <p className="note">{note}</p>}
      {/* Failing at the lightest load points to the exercise's starting numbers and loads (SPEC §6.6). */}
      {adaptive?.atLightestLoad && (
        <div className="actions">
          <Button onClick={onEditExercise}>Edit exercise</Button>
        </div>
      )}
      {basisNote && <p className="note">{basisNote}</p>}
    </Card>
  )
}
